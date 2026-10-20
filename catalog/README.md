# catalog

Productos, categorías y tasas de ITBMS vigentes; listados del marketplace y búsqueda llegan con F15.4–F15.5. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go 1.26 |
| Puerto | gRPC `50065`, administración `9100` (`/healthz`, `/readyz`, `/metrics`) |
| Fase del roadmap | F15 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Dominio: R1 (SKU y GTIN con dígito de control), R2 (precio entero ≥ 0), N-FIS-01 (tasa legal vigente y tratamiento explícito), árbol ≤ 4 niveles | ✅ L1 | `internal/domain/product_test.go` (7 pruebas) |
| Productos: alta, cambio con máscara y bloqueo optimista, archivo, lectura, búsqueda y keyset, código de barras (F15.1) | ✅ L2 | `internal/store/catalog_l2_test.go`: 9 pruebas contra PostgreSQL efímero (`./catalog/test/test_l2.sh`, 2026-10-20) |
| Categorías (F15.2, sin imágenes prefirmadas) | ✅ L2 | `TestCategories_TreeDepthAndTenantScope` |
| Tasas de ITBMS desde `legal.pa.itbms.*` (`ListTaxRates`, AGENTS §2.13) | ✅ L1 | cliente de infra-management con caché de 60 s; sin respuesta → `DEPENDENCY_UNAVAILABLE` |
| Atomicidad: producto y `ProductChanged` en la misma transacción; alta fallida sin evento | ✅ L2 | `TestAtomicity_ProductAndOutboxCommitTogether` |
| RLS por `app.tenant_id` y rol sin DELETE | ✅ L2 | `TestRLS_TenantCannotSeeOthersProducts`, `TestPrivileges_ServiceRoleCannotDelete` |
| Relay del outbox a `PP_COMMERCE` | ✅ L1 · ⏳ en vivo | `TestADR0012_EnvelopeCarriesTypedPayload` |
| Importación masiva, URL prefirmadas, listados, vitrina y búsqueda del marketplace (F15.3–F15.5) | 📋 | responden `UNIMPLEMENTED` |
| Variantes múltiples y precio por sucursal | 📋 | el contrato es plano (una variante por producto) |
| Observabilidad | ◐ | interceptor con request_id, pánico y defecto sin fuga; métricas `pp_rpc_*`, `pp_outbox_*`. **Faltan** `pp_catalog_search_duration_seconds` y `pp_catalog_import_rows_total` (con F15.3/F15.5) |
| Imagen Docker | ✅ | distroless `static-debian12:nonroot` |
| Despliegue en producción | ⏳ | requiere quitar las tablas de esbozo vacías: `~/plentypay-backups/commerce-reset.sh` (respalda antes) |

## Pruebas
```bash
cd catalog && go vet ./... && go test -race ./...   # L1
./catalog/test/test_l2.sh                            # desde la raíz: L2 en una base efímera que se borra al terminar
```

## Arranque
```bash
docker compose build catalog
docker compose run --rm --no-deps catalog migrate   # migrator_catalog, conexión directa
docker compose up -d --no-deps catalog              # nunca reinicia tunnel
```

## Limitaciones conocidas
- Las fotos guardan la ruta relativa `/media/<tenant>/…` del gateway; el antivirus y la verificación por magic bytes al publicar (R6) llegan con F15.2b.
- `UpsertCategory` no lleva clave de idempotencia en el contrato: una alta repetida responde `ALREADY_EXISTS` por el nombre único.
