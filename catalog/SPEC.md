# SPEC — catalog

## 1. Responsabilidad
**Hace**: productos, variantes, códigos de barras, precios por lista/sucursal, categorías, imágenes (URLs prefirmadas), importación masiva, listados del marketplace, búsqueda del marketplace, vitrinas (storefronts) de comercios.
**No hace**: existencias (inventory; catalog solo proyecta `in_stock`), pedidos (orders), precios dinámicos por cliente (fuera de alcance MVP).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go |
| Puerto / admin | 50065 / 9100 |
| Contrato | `catalog.proto` |
| Esquema | `catalog`; ScyllaDB keyspace `catalog_attrs` (atributos variables) |
| Otros | object-storage `catalog/<tenant>/...`; NATS |
| Fase | F15 (F15.1–F15.5) |
| Capa | L3 |

## 3. Modelo de datos
```sql
CREATE TABLE catalog.categories (id uuid PRIMARY KEY, tenant_id uuid,        -- NULL = taxonomía global del marketplace
  parent_id uuid, name text NOT NULL, slug text NOT NULL, position int NOT NULL DEFAULT 0, UNIQUE (tenant_id, slug));
CREATE TABLE catalog.products (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text, category_id uuid, global_category_id uuid, status smallint NOT NULL,
  tax_rate_bps int NOT NULL DEFAULT 700, tax_included boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT true, unit text NOT NULL DEFAULT 'unit',  -- unit|kg|l|m
  images text[] NOT NULL DEFAULT '{}', search_vector tsvector,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE INDEX products_search ON catalog.products USING gin (search_vector);
CREATE TABLE catalog.variants (id uuid PRIMARY KEY, product_id uuid NOT NULL, tenant_id uuid NOT NULL,
  sku text NOT NULL, barcode text, option_values jsonb NOT NULL DEFAULT '{}',
  price_minor bigint NOT NULL CHECK (price_minor >= 0), cost_minor bigint, currency char(3) NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true, UNIQUE (tenant_id, sku));
CREATE UNIQUE INDEX variants_barcode ON catalog.variants (tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE TABLE catalog.branch_prices (variant_id uuid, branch_id uuid, price_minor bigint NOT NULL, PRIMARY KEY (variant_id, branch_id));
CREATE TABLE catalog.listings (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, product_id uuid NOT NULL UNIQUE,
  published boolean NOT NULL, fulfillment text[] NOT NULL, in_stock boolean NOT NULL DEFAULT false,
  published_at timestamptz, rank_score int NOT NULL DEFAULT 0);
CREATE TABLE catalog.storefronts (tenant_id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, display_name text NOT NULL,
  logo_url text, banner_url text, description text, location geography(Point), delivery_radius_m int, open_hours jsonb);
-- + outbox, processed_events, idempotency_keys
```
Scylla `catalog_attrs.product_attributes (tenant_id, product_id, attr_key, attr_value, PRIMARY KEY ((tenant_id, product_id), attr_key))`.

## 4. RPCs
| RPC | Permiso | Comportamiento clave | Errores (`reason`) |
|---|---|---|---|
| CreateProduct / UpdateProduct / ArchiveProduct | `catalog:write` | variantes en la misma operación; archivar despublica el listado; `ProductChanged` | `SKU_TAKEN`, `BARCODE_TAKEN`, `INVALID_BARCODE`, `INVALID_UNIT`, `INVALID_TAX_RATE`, `TAX_TREATMENT_MISSING`, `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED` |
| GetProduct / ListProducts / LookupByBarcode | `catalog:read` | filtros por categoría, texto, estado; barcode exacto por tenant | `NOT_FOUND` |
| BulkImportProducts (stream) | `catalog:import` | CSV normalizado fila a fila; resultado por fila (creado/actualizado/error) sin abortar el lote; máx. 50 000 filas | `RATE_LIMITED` |
| UpsertCategory / ListCategories | `catalog:write` / `catalog:read` | árbol ≤ 4 niveles | `CATEGORY_DEPTH_EXCEEDED`, `NOT_FOUND` |
| CreateUploadUrl (hoy la subida pasa por el gateway, ADR 0021) | `catalog:write` (o `admin:business:manage` con propósito `kyb`) | URL PUT prefirmada 10 min, tipo y tamaño máximos (imagen ≤ 5 MB jpg/png/webp; kyb ≤ 10 MB pdf/jpg/png) | `UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE` |
| SetListing | `catalog:listing:manage` | publicar en marketplace requiere tenant ACTIVE, ≥ 1 imagen, precio > 0, categoría global | `TENANT_NOT_ACTIVE`, `LISTING_INCOMPLETE`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| SearchMarketplace | autenticado | texto (tsvector es) + categoría + cercanía (`near` lat/lng con radio de entrega) + solo `in_stock`; keyset por `rank_score` | `RATE_LIMITED` |
| GetMarketplaceProduct / GetStorefront | autenticado | datos públicos del listado/comercio | `NOT_FOUND` |
| UpdateStorefront | `catalog:listing:manage` | slug único `^[a-z0-9-]{3,40}$` | `SLUG_TAKEN`, `IDEMPOTENCY_KEY_REUSED` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-FIS-01, N-FIS-02, N-FIS-13, N-CON-02, N-CON-03, N-CON-07, N-CON-09, N-LOG-01, N-LOG-04, N-LOG-05, N-FMT-08 y N-FMT-09. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** SKU único por tenant; barcode único por tenant si existe.
- **R2** Precios enteros ≥ 0; precio por sucursal sobrescribe al base.
- **R3** Cambios de precio no afectan ventas/pedidos existentes (instantáneas en pos/orders).
- **R4** Listado publicado solo si tenant ACTIVE (consumir `TenantStatusChanged`: SUSPENDED → despublicar todo). `Product.listed_in_marketplace` es de solo lectura (sale de `listings`; se cambia solo con `SetListing`) y el `ProductChanged` de una edición lleva la publicación vigente: editar un producto nunca lo despublica.
- **R5** `in_stock` se proyecta desde `inventory.StockChanged` (eventual, ≤ 30 s); productos sin `track_inventory` siempre `in_stock`.
- **R6** Imágenes: el servidor genera la clave; tipo verificado por magic bytes al confirmar (job) y antivirus antes de publicarse.
- **R7** Búsqueda nunca expone productos de tenants no ACTIVE ni archivados.

## 6. Eventos
Publica `ProductChanged`. Consume `TenantStatusChanged`, `StockChanged`.

## 7. Dependencias
inventory (lectura de disponibilidad para detalle de producto; 500 ms, opcional). Llamado por gateway, orders, pos, inventory.

## 8. Configuración
`CATALOG_GRPC_ADDR`, `DATABASE_URL`, `SCYLLA_HOSTS`, `NATS_URL`, `INVENTORY_ADDR`, `OBJECT_STORAGE_*`, `PUBLIC_MEDIA_BASE_URL`.

## 9. Observabilidad
`pp_catalog_search_duration_seconds`, `pp_catalog_import_rows_total{result}`.

## 11. Pruebas de aceptación
Importación de 10 000 filas con 3 % errores → resultado por fila y productos válidos creados; búsqueda "arroz" cerca de Colón devuelve solo comercios ACTIVE con stock.

## 12. Plan
F15.1 productos/variantes → F15.2 categorías + imágenes → F15.3 importación → F15.4 listados + storefront → F15.5 búsqueda marketplace (+ Scylla atributos). Pantallas: F15.10 (compartido con orders).

## 13. Estado de implementación (2026-10-20)
- **Implementado**: CreateProduct, UpdateProduct (máscara de campos y bloqueo optimista por `version`), ArchiveProduct, GetProduct, ListProducts (texto en `tsvector` español + SKU/código exacto, keyset por nombre), LookupByBarcode (solo activos), UpsertCategory, ListCategories, `ListTaxRates`. El resto responde `UNIMPLEMENTED`.
- **Contrato (aditivo)**: `Product.tax_exempt = 19` (proto3 no distingue tasa 0 de «sin tasa»: el exento se declara; exento con tasa > 0 → `INVALID_TAX_RATE`) y `rpc ListTaxRates` (`TaxRate{kind, rate_bps}`), para que la app nunca lleve tasas legales en su código (AGENTS §2.13).
- **N-FIS-01**: la tasa de un producto debe ser 0 o una de `legal.pa.itbms.standard_bps|alcohol_bps|tobacco_bps` vigentes (infra-management, caché 60 s); sin tratamiento explícito → `TAX_TREATMENT_MISSING`; sin infra-management → `DEPENDENCY_UNAVAILABLE`.
- **Modelo**: una variante por producto en la misma fila (`sku`, `barcode`, `price_minor`); `variants` y `branch_prices` llegan con F15.1b. La categoría de un producto se verifica bajo RLS en la misma transacción (la FK no ve la RLS).
- **Errores agregados**: `INVALID_TAX_RATE`, `DEPENDENCY_UNAVAILABLE`, `VERSION_CONFLICT`, `TENANT_REQUIRED`.
