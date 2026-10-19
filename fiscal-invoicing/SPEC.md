# SPEC — fiscal-invoicing

**Estado**: 📝 F13.1/F13.2/F13.3 en curso — dominio (totales, impuestos, políticas) + migraciones + perfil fiscal con validación. Go tests OK. Marcado 📝 por AGENTS.md §2.11.

## 1. Responsabilidad
**Hace**: facturación electrónica de Panamá (DGI, Sistema de Factura Electrónica — SFEP) a través de un **PAC** (proveedor autorizado de certificación): perfil fiscal del comercio, decisión de qué documento emitir (fiscal o recibo interno), emisión de facturas, notas de crédito y débito, folios, CUFE y QR, almacenamiento de XML/PDF por ≥ 5 años, contribuyentes frecuentes.
**No hace**: cobrar, calcular precios (recibe líneas con impuestos ya calculados por pos/orders), enviar correos (notifications envía el PDF).

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go |
| Puerto / admin | 50064 / 9100 |
| Contrato | `fiscal_invoicing.proto` |
| Esquema | `fiscal` |
| Otros | object-storage (`fiscal/<tenant>/<año>/<cufe>.{xml,pdf}`), NATS |
| Fase | F13 |
| Capa | L3 |

## 3. Modelo de datos
```sql
CREATE TABLE fiscal.profiles (
  tenant_id uuid PRIMARY KEY, ruc text NOT NULL, dv text NOT NULL, legal_name text NOT NULL,
  branch_code text NOT NULL DEFAULT '0000', point_of_sale_code text NOT NULL DEFAULT '001',
  pac_provider text NOT NULL,              -- adaptador (p. ej. 'hka', 'generic')
  pac_credentials_secret text NOT NULL,    -- NOMBRE del secreto en security, nunca el valor
  checkout_preference smallint NOT NULL, auto_threshold_minor bigint,
  environment text NOT NULL CHECK (environment IN ('TEST','PRODUCTION')),
  updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1
);
CREATE TABLE fiscal.folio_ranges (tenant_id uuid, doc_type smallint, next_number bigint NOT NULL, last_number bigint NOT NULL,
  PRIMARY KEY (tenant_id, doc_type));      -- SELECT ... FOR UPDATE al asignar número (sección corta justificada)
CREATE TABLE fiscal.invoices (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, doc_type smallint NOT NULL, status smallint NOT NULL,
  number bigint, cufe text UNIQUE, qr_url text, related_invoice_id uuid,      -- notas apuntan a la factura
  source_type text NOT NULL, source_id text NOT NULL,                           -- sale | sub_order | manual | platform_fee
  customer_taxpayer_id uuid, customer_snapshot jsonb,
  lines jsonb NOT NULL,                     -- [{sku, description, qty_milli, unit_price_minor, discount_minor, tax_rate_bps, tax_minor, total_minor}]
  subtotal_minor bigint NOT NULL, tax_minor bigint NOT NULL, total_minor bigint NOT NULL, currency char(3) NOT NULL,
  payment_methods jsonb NOT NULL,           -- forma de pago DGI por tender
  pac_attempts int NOT NULL DEFAULT 0, last_error text, xml_object_key text, pdf_object_key text,
  idempotency_key text NOT NULL, issued_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE (tenant_id, idempotency_key), UNIQUE (tenant_id, source_type, source_id, doc_type)
);
CREATE TABLE fiscal.taxpayers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, kind text NOT NULL,  -- CONTRIBUYENTE|CONSUMIDOR_FINAL|EXTRANJERO|GOBIERNO
  ruc_or_id text NOT NULL, dv text, name text NOT NULL, email text, address jsonb, UNIQUE (tenant_id, ruc_or_id));
-- + outbox, idempotency_keys
```

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento | Errores |
|---|---|---|---|---|
| EvaluateDocumentPolicy | `fiscal:issue` / servicios pos, orders | — | aplica `CheckoutPreference` (domain-model §8.8) y devuelve FISCAL_INVOICE o INTERNAL_RECEIPT (o "preguntar") | `PROFILE_MISSING` |
| IssueInvoice | `fiscal:issue` / pos, orders | sí | valida líneas y totales, asigna número, `DRAFT→QUEUED`, encola envío al PAC (worker) | `TOTALS_MISMATCH`, `PROFILE_MISSING`, `INVALID_TAXPAYER` |
| IssueCreditNote / IssueDebitNote | `fiscal:note:issue` | sí | referencia a factura ACCEPTED; nota de crédito por el total → original VOIDED | `RELATED_NOT_ACCEPTED`, `EXCEEDS_ORIGINAL` |
| GetInvoice / ListInvoices | `fiscal:read` | — | | `NOT_FOUND` |
| RefreshInvoiceStatus | worker / webhook PAC | — | consulta al PAC y actualiza | |
| GetInvoiceDocument | `fiscal:read` o el cliente del recibo (enlace firmado) | — | URL prefirmada 10 min a PDF/XML | `NOT_READY` |
| ConfigureFiscalProfile | `fiscal:profile:manage` + step-up | sí | guarda perfil; **credenciales del PAC van a `security.PutSecret`** (nombre `fiscal/<tenant>/pac`), aquí solo el nombre | `INVALID_RUC`, `PAC_AUTH_FAILED` (prueba de conexión) |
| GetFiscalProfile / GetFolioStatus | `fiscal:read` | — | folios restantes; `FolioLow` si < 10 % | |
| UpsertTaxpayer / SearchTaxpayers | `fiscal:issue` | sí / — | contribuyentes frecuentes del tenant | `INVALID_RUC` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-FIS-04 a N-FIS-11, N-FIS-14 y N-FIS-15. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Totales: `Σ line.total = subtotal + tax` exacto; cada `tax_minor = half_up(base_línea, tax_rate_bps)`; tasas ITBMS permitidas 0, 700, 1000, 1500 bps (validar contra catálogo DGI vigente — Q-11).
- **R2** Numeración consecutiva sin huecos por `(tenant, doc_type, punto de facturación)`; un número asignado nunca se reutiliza (un rechazo conserva su número y se reemite con nota según normativa — Q-11).
- **R3** Envío al PAC fuera de la transacción de BD; reintentos con backoff hasta 24 h; pendiente > 1 h → alerta; el plazo legal de transmisión se respeta (Q-11).
- **R4** ACCEPTED requiere CUFE + QR; el PDF incluye el QR de verificación de la DGI.
- **R5** XML firmado y PDF se guardan inmutables en object-storage con retención ≥ 5 años (bloqueo de objeto si el backend lo soporta).
- **R6** Una venta/sub-pedido genera como máximo un documento por tipo (`UNIQUE source+doc_type`).
- **R7** Nota de crédito: suma de notas ≤ total de la factura; por el total → factura VOIDED.
- **R8** Consumidor final sin datos: permitido hasta el límite que fije la DGI (configurable); por encima exige identificación (Q-11).
- **R9** Entorno TEST nunca transmite a producción; facturas de pagos `sandbox` solo en TEST.
- **R10** Adaptador PAC por interfaz (`PacClient`: Send, Query, Cancel); implementaciones por proveedor; doble de pruebas que simula aceptación/rechazo/timeout.

## 6. Eventos
Publica: `InvoiceAccepted`, `InvoiceRejected`, `FolioLow`, `AuditRecorded`. Consume: ninguno (pos/orders llaman por gRPC para tener el número en el recibo).

## 7. Dependencias
security (GetSecret de credenciales PAC; Encrypt no requerido). PAC externo por HTTPS (fuera de la red interna, egress controlado).

## 8. Configuración
`FISCAL_GRPC_ADDR`, `DATABASE_URL`, `NATS_URL`, `SECURITY_ADDR`, `OBJECT_STORAGE_*`, `PAC_TIMEOUT_MS` (10000), `PAC_DEFAULT_PROVIDER`.

## 9. Observabilidad
`pp_invoices_total{doc_type,status}`, `pp_pac_latency_seconds{provider}`, `pp_invoices_pending_age_seconds_max`, `pp_folios_remaining{doc_type}` (sin tenant como etiqueta; detalle en logs).

## 10. Seguridad
Credenciales del PAC solo en security; datos del cliente (RUC/cédula) visibles solo con `fiscal:read`; enlaces a documentos prefirmados y de corta duración.

## 11. Pruebas de aceptación
1. Venta de 3 líneas con ITBMS 7 % → factura ACCEPTED con CUFE (PAC simulado), PDF con QR en object-storage.
2. PAC devuelve timeout 3 veces y luego acepta → una sola factura, número sin huecos.
3. Nota de crédito por el total → factura VOIDED.
4. Preferencia AUTO_THRESHOLD 50.00: venta de 30.00 → recibo interno; de 80.00 → fiscal.

## 12. Plan
F13.1 dominio (totales, políticas) → F13.2 migraciones + folios → F13.3 perfil + credenciales en security → F13.4 PacClient + simulador → F13.5 IssueInvoice + worker → F13.6 PDF/XML + object-storage → F13.7 notas → F13.8 facturación de comisiones de PlentyPay a comercios (tenant = PLATFORM) → F13.9 pantallas Flutter (perfil fiscal, facturas, notas, contribuyentes).

## 13. Riesgos
Q-11 (detalles normativos SFEP vigentes y del PAC elegido), Q-07 (ITBMS sobre comisiones).
