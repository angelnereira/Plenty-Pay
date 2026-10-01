# Hoja de Ruta — Fases e Hitos hasta Operación 100%

Complemento ejecutivo de `docs/10-PLAN-DE-IMPLEMENTACION.md`: el camino completo, fase por fase e hito por hito, con criterios de aceptación **verificables** (comandos reales, no declaraciones) y gates explícitos. Cadencia: cada hito se desarrolla con PRs pequeños, `./scripts/dev.sh all` verde en cada cambio, commit+push por cambio (práctica acordada con el dueño) y actualización de `docs/40-ESTADO-IMPLEMENTACION.md`.

## Leyenda

- Estados de pieza (§22): `IMPLEMENTED · PARTIAL · MOCK · STUB · TODO · BLOCKED-*`.
- **Gates duros** (no negociables, bloquean hitos aguas abajo):
  - `GATE-LEGAL` — registro SBP (Emisor Medios de Pago y Dinero Electrónico) + programa AML/CFT con abogado fintech (doc 03 §9).
  - `GATE-EXT` — integraciones externas reales (Yappy/TELERED/PSP/HKA) requieren acuerdos+credenciales; mientras: `BLOCKED-UNVERIFIED`.
  - `GATE-TOOLCHAIN` — builds Flutter/APK requieren runner x64 (host local arm64 sin release Flutter arm64).
- Semanas = estimación de esfuerzo relativo, no fechas comprometidas.

---

## FASE 0 — Diagnóstico y Contratos ✅ (completada con pendiente menor)

| Hito | Alcance | Aceptación | Estado |
|---|---|---|---|
| M0.1 Diagnóstico + ADRs 0001-0010 | Auditoría, contradicciones C-1..C-8, decisiones ratificadas | docs/00, docs/20 revisados por dueño | ✅ |
| M0.2 Estructura de repo (mandato §5) | apps/services/contracts/deployment/infra/scripts/tests/output/docs | árbol = docs/30 | ✅ |
| M0.3 Contratos v1 | common/identity/ledger/payments/wallet/notifications | `buf lint` OK + stubs Go compilando | ✅ |
| M0.4 Dominio ledger (núcleo) | Doble partida, idempotencia, reversos, dinero exacto | `cargo test` 15/15, clippy -D warnings | ✅ |
| M0.5 CI inicial | GH Actions: fmt+vet+test (Go), fmt+clippy+test (Rust), buf lint+breaking | pipeline verde en main | ⬜ M1.1 |

## FASE 1 — Foundation (semanas 1-4)

**Objetivo**: app instalable + backend ejecutable E2E de identidad (mandato §25 Etapa 1).

| Hito | Alcance | Criterios de aceptación | Dependencia |
|---|---|---|---|
| M1.1 CI base | GH Actions: jobs go, rust, buf, flutter(x64) | CI verde; badges en README | M0.3 |
| M1.2 identity→PostgreSQL | esquema `identity.*`, migraciones, sqlc (ADR-0010), auditoría de accesos, TLS interno | `go test ./...` incl. integración contra Postgres del compose; auditoría registra login/logout | M1.1 |
| M1.3 api-gateway v1 | proxy gRPC, validación de sesión por llamada, rate limit, correlación ADR-0004 | prueba E2E: cliente→gateway→identity; sesión inválida ⇒ 401 en gateway sin llegar a identity | M1.2 |
| M1.4 Flutter base + CI x64 | toolchain en CI; design system (grises+rojo, tokens); shell dinámico por AuthorizationContext; pantallas auth reales | `flutter analyze/test` en CI; **APK firmado en `output/android/`** (§19) | M1.1 |
| M1.5 Compose completo dev | postgres+identity+gateway; health/readiness; logs JSON estructurados | `docker compose up --build` → flujo registro→auth→contexto E2E; `dev.sh all` verde | M1.2, M1.3 |

**DoD Fase 1** (§30): app APK instalable; backend funcional; tests unit+integration+contract; docs actualizados; cero secretos; correlación E2E demostrada.

## FASE 2 — Core Financiero (semanas 5-10)

**Objetivo**: flujos de dinero básicos de extremo a extremo, con integridad contable demostrada (mandato §25 Etapa 2; prioridad 3: integridad financiera).

| Hito | Alcance | Criterios de aceptación | Dependencia |
|---|---|---|---|
| M2.1 ledger persistente | PostgreSQL+sqlx (tonic gRPC); trigger de balanceo; `REVOKE UPDATE/DELETE` a roles de app; particionado por fecha; migraciones | suite financiera §20: idempotencia (replay parallel), concurrencia (2 writers mismos fondos), rollback, duplicación, overflow; reconciliación SUM(debit)=SUM(credit) nocturna en CI | M1.5 |
| M2.2 payments core (Rust) | PaymentIntent→Attempt; rail `WALLET_INTERNAL`; estados con **UNDETERMINED**; idempotencia; jamás toca BD del ledger (solo contrato) | doble confirmación ⇒ un solo cargo; crash-test: kill -9 entre intent/capture ⇒ estado coherente o UNDETERMINED; pruebas de reverso | M2.1 |
| M2.3 wallet (ADR-0006) | GetWallet (available/held/pending); InternalTransfer idempotente; holds open/captured/released | saldo disponible = ledger; hold→capture→asiento real; hold→release→sin movimiento definitivo | M2.1, M2.2 |
| M2.4 notifications v1 | canales console + colas con retry; email `BLOCKED-UNVERIFIED` (sin proveedor aún) | reintento con backoff; idempotencia de envío; correlación propagada | M1.5 |
| M2.5 app: módulos consumidor | Wallet/Enviar/Recibir/Historial/PagosQR reales contra backend (sin mocks) | E2E en CI: envío persona→persona visible en historial de ambos | M1.4, M2.3 |
| M2.6 Carga financiera básica | pruebas k6/ghz (OSS) | ≥500 TPS sostenidos y ≥1200 ráfaga en dev (doc 02 §2); sin violación de invariantes | M2.2 |

**Gates de salida Fase 2**: revisión contable independiente (doble entrada + reversos + auditoría); matriz financiera §20 completa documentada.

## FASE 3 — Commerce (semanas 11-18)

| Hito | Alcance | Criterios de aceptación | Dependencia |
|---|---|---|---|
| M3.1 catálogo+inventario (Go+sqlc) | productos, variantes, lotes, bodegas, reorder, compras a proveedores | multi-tenant aislado; descuento de stock atómico con la venta | M1.5 |
| M3.2 POS offline-first | sesiones de caja, carrito, cola offline local (Drift/SQLite solo-local, ADR-0010), sync al reconectar; impresión térmica `UNVERIFIED` (plugins) | corte de red durante venta ⇒ venta persiste y sincroniza sin duplicar (idempotencia) | M3.1, M2.3 |
| M3.3 invoicing fiscal | adaptador DGI/HKA con XMLDSig + folios — **GATE-EXT**: credenciales PAC reales; modo interno (recibos no-fiscales) mientras | con credenciales: CUFE/QR/PDF validados en sandbox; sin credenciales: recibos internos IMPLEMENTADO, fiscal BLOCKED-UNVERIFIED | GATE-EXT |
| M3.4 settlement | lotes de liquidación, comisiones plataforma, reconciliación | liquidación cuadra contra ledger al centavo (reconciliación 100%) | M2.3 |
| M3.5 equipo/nómina v1 | asistencia PIN/QR/kiosco; turnos; nómina básica | marcaje→turno→nómina E2E; biométrica facial PLANNED (UNVERIFIED) | M1.5 |
| M3.6 app: módulos empresa | Dashboard/POS/Ventas/Catálogo/Inventario/Facturación/Empleados/Nómina/Reportes/Sucursales/Configuración — pantallas reales por feature flags | E2E venta completa: catálogo→POS→pago wallet→recibo→stock descontado→reporte | M3.1-M3.5 |

**Gates de salida Fase 3**: pilot con 1-3 comercios semilla (internos), datos reales de uso.

## FASE 4 — Integraciones y Regulatorio (semanas 19-30) — GATES DUROS

| Hito | Alcance | Gate | Criterios de aceptación |
|---|---|---|---|
| M4.1 Registro SBP + AML/CFT | abogado fintech; registro Emisor Medios de Pago y Dinero Electrónico (Ley 23-2015 art.22 g; Acuerdo 5-2015; doc 03 §9) | **GATE-LEGAL** | expediente radicado; KYC/KYB definidos; dictamen sobre módulo créditos |
| M4.2 Yappy adapter | alta como comercio afiliado + API de cobro | GATE-EXT (acuerdo+sandbox) | webhooks firmados, idempotencia, reversos en sandbox; reconciliación 100% |
| M4.3 TELERED adapter | ACH Xpress / Clave vía banco patrocinador | GATE-EXT | ídem |
| M4.4 PSP tarjetas | adquirente certificado; Apple Pay/Google Pay vía SDK PSP; **nunca PAN** (doc 03 §3) | GATE-EXT | token-only E2E; alcance PCI mantenido en SAQ A (auditoría externa) |
| M4.5 Pases wallet | recibos/cupones en Apple Wallet/Google Wallet | — | pase emitido e instalado en dispositivos de prueba |
| M4.6 web-public | tracking QR público + landing (Go, SSR estático, ADR-0007) | — | tracking sin login por token QR; sin lógica financiera |
| M4.7 marketplace | multi-vendedor con holds + settlement; KYB comercios | GATE-LEGAL (flujo de fondos) | compra multi-comercio en un pago; liquidación por comercio al centavo |

## FASE 5 — Escalabilidad y Operación (semanas 31-40)

| Hito | Alcance | Criterios de aceptación |
|---|---|---|
| M5.1 Kubernetes | manifiestos (Deployment/Service/HPA/NetworkPolicy); sin código nuevo de negocio | `ledger×3, payments×10, identity×4, notifications×5` escalando; rollouts sin caída (doc 04 §5) |
| M5.2 IaC OpenTofu | módulos network/compute/database/storage/security/observability/secrets/messaging; self-hosted primario + DR cloud | mismo HCL despliega en 2 entornos sin cambios de dominio |
| M5.3 Observabilidad completa | Prometheus/Grafana/Loki/Tempo/GlitchTip; SLOs y alertas; trazas Flutter→ledger (ADR-0004) | una transacción rastreable E2E por trace-id; SLOs definidos y visibles |
| M5.4 Seguridad dura | mTLS inter-servicios, OpenBao+rotación, scanning de dependencias+SBOM en CI, pentest externo | pentest sin hallazgos críticos; rotación probada; WORM del ledger verificado (UPDATE/DELETE bloqueados) |
| M5.5 DR | backups WAL continuos; RPO minutos/RTO definido; simulacros | simulacro trimestral documentado: primario caído → DR arriba con reconciliación limpia |
| M5.6 Carga objetivo | pruebas a perfil 500k DAU (doc 02 §2) | 390 req/s sostenido / 1500 ráfaga; ledger 18M filas/año con particionado probado |
| M5.7 CDC/analytics (opcional) | Debezium+Kafka+ClickHouse **solo si** métricas reales lo justifican (doc 04 §4) | gate: volumen medido; si no: exportes programados suficientes |

## FASE 6 — Producción y Go-Live (semanas 41+)

| Hito | Alcance | Criterios de aceptación |
|---|---|---|
| M6.1 Pilot privado | comercios semilla con dinero real limitado; soporte/tickets; runbooks | 30 días sin incidentes críticos; NPS pilot medido |
| M6.2 Go-live público | rails según gates aprobados; límites por tier; comunicación | SBP vigente (GATE-LEGAL); rails activos con reconciliación 100% |
| M6.3 Operación continua | on-call, postmortems, auditoría trimestral, simulacros DR | SLOs 99.9% pagos; auditoría contable trimestral |

---

## Matriz de dependencias (camino crítico)

```
M1.1 CI ──► M1.2 identity/PG ──► M1.3 gateway ──► M1.5 compose-full ─┐
        └──► M1.4 Flutter/APK ────────────────────────────────────────┤
                                                                     ▼
                          M2.1 ledger/PG ──► M2.2 payments ──► M2.3 wallet ──► M2.5 app-consumidor
                                  └──► M2.4 notifications        └──► M2.6 carga
                                                                     ▼
             M3.1 catálogo/inventario ──► M3.2 POS ──► M3.6 app-empresa
             M3.3 invoicing (GATE-EXT)    M3.4 settlement   M3.5 nómina
                                                                     ▼
  GATE-LEGAL M4.1 ─┬─► M4.2/3/4 rails ──► M4.7 marketplace ──► FASE 5 ──► FASE 6
                   └─► (créditos regulados: dictamen)
```

## Riesgos y mitigaciones (vivos; revisar por fase)

| Riesgo | Mitigación | Vigilancia |
|---|---|---|
| Flutter bloqueado local (arm64) | CI x64 desde M1.1; artefactos a output/ | gate M1.4 |
| Regulatorio SBP/AML | GATE-LEGAL antes de dinero real; dictamen créditos | Fase 4 |
| Proveedor PSP/Yappy sin API pública estable | patrón Adapter (contrato estable); sandbox primero | M4.x |
| Pérdida de integridad contable | invariantes en 3 capas (dominio, trigger DB, reconciliación nocturna CI) | continuo |
| Sobre-ingeniería temprana (K8s/CDC antes de métricas) | gates por métricas reales (§33; doc 02 §2) | Fase 5 |
| Web público vs prohibición frontend | ADR-0007: solo superficies públicas; sin TS | M4.6 |
| Dependencias OSS con licencias cambiadas | tabla licencias doc 02 §1; revisión en cada fase | continuo |

## Regla de progresión

Un hito se cierra SOLO con: código + tests + lint + build + integración verificada + Docker OK + contratos/docs actualizados + push (§26/§30). Nunca dos fases abiertas a la vez; los gates marcados NO se saltan.
