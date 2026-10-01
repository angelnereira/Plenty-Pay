# Arquitectura de Infraestructura Híbrida para PlentyPay (500,000+ usuarios/día)

> Continúa del documento 01. Hoy el sistema base corre 100% en Vercel + Neon + Upstash (serverless, sin contenedores). Esto propone la infraestructura híbrida self-hosted + cloud, 100% open source, para escalar a 500k+ DAU — y el modelo de arquitectura definitivo de PlentyPay: cliente nativo + backend 100% contenerizado (sección siguiente).

## Modelo de arquitectura: cliente nativo + contenedores

PlentyPay se divide en exactamente dos capas, sin zonas grises entre ellas:

**Capa de cliente — aplicación nativa.** Un único código fuente se compila a
binarios instalables para Android, iOS, Windows y macOS. Es literalmente lo
único que el usuario instala en su dispositivo: no hay una "versión web" ni
una "versión de escritorio" distintas manteniéndose por separado — es un solo
proyecto, cuatro salidas de compilación. Esta capa contiene toda la interfaz
y el flujo de uso; no contiene lógica de negocio propia ni acceso directo a
datos — todo lo que necesita se lo pide al backend.

**Capa de servidor — 100% contenedores.** Todo lo que corre del lado del
servidor vive en un contenedor Docker, sin excepción — ni un proceso "aparte"
ni un script que corra fuera de esa disciplina. Cada contenedor es, según lo
que le corresponda, o bien un módulo de negocio completo (el ejemplo en este
repo: el monolito modular que sirve facturación/inventario/POS/logística/
payday/BI) o bien un servicio dedicado a una responsabilidad específica (los
ejemplos en este repo: el orquestador de pagos, el ledger). Ambas formas son
válidas — lo que no es válido es cualquier pieza de servidor que no esté
contenerizada.

**Comunicación entre contenedores: gRPC.** Ningún contenedor le habla a otro
adivinando su forma interna — cada uno expone un contrato explícito (qué
operaciones ofrece, qué datos espera, qué devuelve) y los demás contenedores
hablan contra ese contrato, nunca contra su base de datos ni su código
directamente. Es el mismo principio por el que el orquestador de pagos nunca
integra un riel de pago "a mano" dentro de otro servicio: expone un contrato,
y quien lo consume no necesita saber qué hay detrás.

**El principio de diseño detrás de todo esto: SOLID, aplicado a nivel de
contenedor, no solo dentro de una clase.** Concretamente, en el código de
este repositorio:

| Principio | Cómo se aplica aquí |
|---|---|
| **S** — Responsabilidad única | Cada contenedor tiene un solo motivo para cambiar: el ledger no sabe nada de Yappy; el orquestador de pagos no sabe nada de doble entrada contable. |
| **O** — Abierto/cerrado | Agregar un riel de pago nuevo (Nequi, Kuara) es agregar un adaptador nuevo — el orquestador no se modifica. |
| **L** — Sustitución de Liskov | Cualquier adaptador de riel (Yappy, TELERED, tarjetas) es intercambiable donde el orquestador espera "un adaptador de pago" — todos cumplen exactamente el mismo contrato. |
| **I** — Segregación de interfaces | Cada contrato gRPC expone solo lo que su consumidor necesita — el ledger no hereda ni arrastra operaciones del orquestador de pagos, ni viceversa. |
| **D** — Inversión de dependencias | El orquestador depende de la idea abstracta de "un adaptador de pago", nunca de la implementación concreta de un riel específico — por eso un riel se reemplaza sin tocar el core. |

Esto **no es una capa nueva que agregar** — es exactamente el patrón *Adapter*
+ contratos gRPC ya descrito en el resto de este documento (secciones 3 y 7).
Esta sección existe para dejar explícito, en un solo lugar, el principio que
lo organiza todo.

## 1. Primero, una advertencia útil sobre "open source" en 2026

Varias herramientas que la industria sigue llamando "open source" **ya no lo son estrictamente** — cambiaron de licencia entre 2023-2024 a licencias de código disponible (BSL/SSPL) que no son OSI-approved. Si el requisito de "solo tecnología open source" es estricto (por ejemplo, para evitar riesgo legal/de vendor lock-in, o por convicción), esto importa:

| Herramienta popular | Licencia real hoy | Alternativa 100% open source |
|---|---|---|
| Terraform | BSL (HashiCorp, 2023) | **OpenTofu** (Linux Foundation, MPL 2.0, fork casi 100% compatible en CLI y HCL) |
| HashiCorp Vault | BSL (2023) | **OpenBao** (Linux Foundation, fork de Vault) |
| Redis (v7.4+/8.x) | RSALv2/SSPLv1 (2024) | **Valkey** (Linux Foundation, BSD-3, respaldado por AWS/Google/Oracle) |
| Elasticsearch | Elastic License/SSPL (2021) | **OpenSearch** (Apache 2.0, fork liderado por AWS) |
| Sentry (self-hosted actual) | Functional Source License | **GlitchTip** (MIT, compatible con el SDK de Sentry) |
| MinIO | Servidor AGPLv3, pero la consola/UI y binarios históricos se han ido restringiendo hacia el plan enterprise | Vale la pena evaluar **Garage** o **SeaweedFS** (Apache 2.0) si esto es un problema para ti |

Grafana y Loki son AGPLv3 (Grafana Labs) — **sí siguen siendo open source** (AGPL es una licencia OSI-approved, solo que copyleft), no necesitan reemplazo. El resto de este documento usa las alternativas de la columna derecha donde aplica.

## 2. Dimensionamiento: de dónde salen los números para 500k DAU

Metodología (ajusta los multiplicadores con tus datos reales de uso cuando los tengas):

- 500,000 usuarios activos/día × ~25 acciones/usuario/día (ver catálogo, checkout, saldo, notificaciones) ≈ **12.5M requests/día**.
- Concentración en hora pico (típico en apps de comercio/pagos en LatAm, almuerzo + noche) ≈ 10-12% del tráfico diario en la hora más cargada → **~1.4M requests/hora pico ≈ 390 req/s sostenidos**.
- Ráfagas dentro de la hora pico (quincena, promociones, caída de otro rail de pago) ×3 → **diseñar para ~1,200-1,500 req/s en ráfaga**.
- Pagos específicamente: si ~10% del DAU transacciona/día = 50,000 tx/día → en hora pico, decenas de tx/s sostenidas con capacidad de ráfaga a 100-300 TPS.
- Crecimiento de datos: 50,000 tx/día × 365 ≈ 18M filas/año en el ledger — perfectamente manejable en PostgreSQL con particionado, **no necesitas sharding a este volumen**.
- Recibos/PDFs: 50k/día × ~150KB ≈ 7.5GB/día ≈ 2.7TB/año → **object storage, no filesystem**.

**Conclusión de dimensionamiento**: 500k DAU es un problema de *buena arquitectura y particionado*, no de "big data". Un clúster de Postgres bien indexado con 2-3 réplicas de lectura y un puñado de nodos de aplicación resuelve esto con margen. Cuidado con sobre-construir microservicios/sharding prematuro para una escala que Postgres maneja bien.

## 3. Principio rector: monolito modular + extracción quirúrgica

El sistema base ya está organizado por `features/*` (facturación, inventario, POS, logística, payday, BI...) con buenos límites internos. **No reescribas todo en microservicios el día uno.** Recomendación (patrón *strangler fig*):

1. El backend Next.js actual se queda como el **monolito modular** que sigue sirviendo facturación, inventario, POS, logística, payday, BI, soporte — se re-empaqueta en contenedor y se despliega en Kubernetes en vez de Vercel.
2. Se extraen como **servicios nuevos e independientes, en gRPC, desde el día uno** solo los tres componentes que son (a) 100% nuevos, (b) de alto riesgo regulatorio/transaccional, y (c) los que necesitas escalar de forma independiente:
   - `payments-orchestrator` (orquesta Yappy/TELERED/adquirente de tarjetas — documento 03)
   - `wallet-ledger` (evolución de `MotorLedgerEntry` a un ledger de wallet real)
   - `marketplace-catalog` (catálogo público multi-tenant + búsqueda)
3. Todo lo demás se extrae **después**, solo si se convierte en cuello de botella real (medido, no adivinado).

Esto reduce drásticamente el riesgo y el tiempo para salir a producción con PlentyPay, sin sacrificar la posibilidad de escalar cada pieza de forma independiente cuando haga falta.

## 4. Topología híbrida

```
                         ┌─────────────────────────┐
                         │   DNS + GSLB (failover)  │
                         └────────────┬────────────┘
              ┌────────────────────────────────────────────┐
              │                                              │
   ┌──────────▼───────────┐                       ┌──────────▼───────────┐
   │  CLÚSTER PRIMARIO      │                       │  CLÚSTER CLOUD        │
   │  (self-hosted, Panamá  │◄──── réplica async ──►│  (burst + DR + backup)│
   │  o colocation LatAm)   │       PostgreSQL       │  ej. OCI / cualquier  │
   │  K3s / Talos Linux     │                       │  VM con K8s propio    │
   └───────────────────────┘                       └───────────────────────┘
```

- **Por qué self-hosted como primario**: baja latencia hacia HKA/DGI, TELERED y bancos locales (todos con endpoints en Panamá), soberanía de datos financieros (relevante para el registro ante la SBP, ver documento 03), y costo operativo predecible a 500k DAU (el egress y el cómputo constante en la nube salen caros a este volumen).
- **Por qué un leg cloud igual**: burst capacity, disaster recovery, y — dado tu interés ya documentado en Oracle Cloud — **OCI es una opción concreta**: su capa "Always Free" + cómputo ARM (Ampere) es barata para el clúster de respaldo, y OKE (Kubernetes gestionado de Oracle) tiene control plane gratuito. Ojo: un *control plane gestionado* (OKE/EKS/GKE) es un servicio propietario del proveedor aunque corra software open source encima — si la pureza "open source" es sobre el software que operas (no sobre quién te vende la VM), usar OKE/EKS/GKE es perfectamente compatible; si además quieres evitar el control plane propietario, monta K3s o Talos tú mismo sobre las VMs planas.
- **Distribución de carga entre clústers**: no necesitas activo-activo multi-región desde el día 1. Empieza con primario self-hosted + réplica cloud fría/tibia (RPO de minutos vía streaming replication de Postgres), y evoluciona a activo-activo solo si la demanda real lo justifica.

## 5. Kubernetes: piezas concretas (todas CNCF / Apache 2.0 o MIT)

| Capa | Herramienta | Rol |
|---|---|---|
| Distro K8s | **K3s** (clúster pequeño/edge) o **Talos Linux** (inmutable, más "banking-grade") | Control plane + nodos |
| CNI + red | **Cilium** | Redes, `NetworkPolicy`, observabilidad eBPF, cluster mesh multi-clúster |
| Ingress / Gateway | **Envoy Gateway** o **Traefik** | Terminación TLS, HTTP/2, traducción gRPC-Web para Flutter Web/browser |
| Service mesh (opcional, fase 2) | **Linkerd** | mTLS automático entre servicios, retries, observabilidad |
| Registro de contenedores | **Harbor** | Registro privado + escaneo de vulnerabilidades (Trivy integrado) |
| GitOps / CD | **Argo CD** | Sincroniza el estado del clúster con un repo Git (despliegues auditable y reproducible) |
| Certificados | **cert-manager** + Let's Encrypt | TLS automático |
| Autoscaling | **KEDA** | Autoescala pods por eventos (cola de pagos, no solo CPU) |
| Secretos | **OpenBao** + **Sealed Secrets/SOPS** | Gestión de secretos y llaves de cifrado (AES-256 de HKA, llaves de firma de PlentyPay) |

## 6. Datos: PostgreSQL a escala (sin abandonar Prisma)

- **Alta disponibilidad self-hosted**: operador **CloudNativePG** (CNCF) sobre Kubernetes — 1 primario + 2 réplicas síncronas/asíncronas, failover automático, backups continuos a object storage (WAL-G/Barman integrado).
- **Pooling**: **PgBouncer** delante de Postgres (Prisma abre muchas conexiones; esto es obligatorio a este volumen).
- **Particionado por rango de fecha** en las tablas de alto volumen (`Invoice`, `MotorLedgerEntry`, `POSOfflineTransaction`, la futura tabla de transacciones de pago):

```sql
CREATE TABLE motor_ledger_entries (
  -- columnas existentes...
) PARTITION BY RANGE (created_at);

CREATE TABLE motor_ledger_entries_2026_10
  PARTITION OF motor_ledger_entries
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
```

- **Lecturas analíticas**: seguir con el patrón ya existente de vistas materializadas (`mv_bi_*`) refrescadas por cron — funciona bien y es 100% Postgres nativo.
- **Cache / rate limiting**: reemplazar Upstash por **Valkey** en modo Sentinel (HA) dentro del clúster.
- **Cola de trabajos**: BullMQ (que ya conoces) sigue siendo válida — es MIT licensed y el problema original no era BullMQ sino que Vercel serverless no permite workers de larga duración. En Kubernetes, un `Deployment` de workers BullMQ+Valkey funciona perfecto. Para los flujos nuevos de pagos (webhooks de Yappy/TELERED/adquirente, donde importa *reintento con garantías de entrega* y *replay*), usa **NATS JetStream** (más liviano de operar que Kafka, CNCF) como bus de eventos dedicado.

## 7. gRPC como protocolo interno

Ejemplo de contrato para el servicio más crítico (nota el `idempotency_key`, imprescindible en pagos para no duplicar cargos en reintentos):

```protobuf
syntax = "proto3";
package plentypay.payments.v1;

service PaymentOrchestrator {
  rpc CreateChargeIntent(CreateChargeIntentRequest) returns (ChargeIntent);
  rpc ConfirmChargeIntent(ConfirmChargeIntentRequest) returns (ChargeResult);
  rpc GetChargeStatus(GetChargeStatusRequest) returns (ChargeResult);
}

message CreateChargeIntentRequest {
  string tenant_id = 1;
  int64 amount_cents = 2;
  string currency = 3;          // "USD" | "PAB"
  string rail = 4;               // "YAPPY" | "TELERED_CLAVE" | "CARD_NETWORK" | "WALLET_INTERNAL"
  string idempotency_key = 5;
}
```

Usa **Buf** (OSS) para lint y detección de *breaking changes* en los `.proto` dentro de CI. Para que Flutter Web y navegadores hablen gRPC (que es HTTP/2 puro y los navegadores no exponen streams HTTP/2 crudos), usa **gRPC-Web** con el proxy de Envoy — Flutter móvil/desktop sí puede hablar gRPC nativo directo.

## 8. Observabilidad (100% OSS)

**Prometheus** (métricas) + **Grafana** (dashboards, AGPLv3 pero legítimamente open source) + **Loki** (logs) + **Tempo** (trazas distribuidas) + **OpenTelemetry** como capa de instrumentación común en todos los servicios gRPC + **Alertmanager**. Para error tracking de aplicación, **GlitchTip** (MIT, compatible con el SDK de Sentry que ya usas — migración de bajo esfuerzo).

## 9. CI/CD

Ya usas GitHub Actions — se mantiene. Pipeline: test (Jest/Playwright, ya existen) → build de imagen de contenedor → push a Harbor → Argo CD detecta el cambio en el repo de manifiestos y sincroniza al clúster (self-hosted y cloud). Cero SSH manual a producción.

## 10. Terraform/OpenTofu: estructura de módulos

```
infra/
├── modules/
│   ├── k8s-cluster/       # provisión de nodos (bare-metal/VM) + K3s o Talos
│   ├── postgres-ha/       # CloudNativePG + backups a object storage
│   ├── networking/        # Cilium, ingress, cert-manager
│   └── observability/     # stack Prometheus/Grafana/Loki
├── environments/
│   ├── self-hosted-primary/
│   └── cloud-dr/
```

Usa **OpenTofu** en vez de Terraform (ver sección 1) para mantener el stack 100% open source de punta a punta.

## 11. Seguridad de infraestructura y alcance PCI-DSS

Punto crítico: **si PlentyPay nunca almacena ni transmite el número de tarjeta (PAN) directamente** — porque delega la captura de la tarjeta a un adquirente/PSP certificado vía SDK o redirect tokenizado (ver documento 03) — el alcance PCI-DSS de tu propia infraestructura se reduce enormemente (de un `SAQ D` completo a algo cercano a un `SAQ A`). Esto **no es un detalle menor**: define si tu clúster necesita segmentación de red tipo "Cardholder Data Environment" (CDE) completa o no. Diseña la arquitectura de pagos (documento 03) para nunca tocar el PAN en texto plano, y la carga de cumplimiento de infraestructura baja de orden de magnitud.

Controles base independientemente del alcance PCI: `NetworkPolicy`/Cilium para segmentar namespaces (el namespace de `payments-orchestrator` y `wallet-ledger` no debe tener red abierta hacia BI o marketing), secretos en OpenBao con rotación, mTLS interno, y logging inmutable (WORM) de todo movimiento del ledger — ya tienes el patrón correcto con `compensatesEntryId` en `MotorLedgerEntry`, solo hay que asegurarse de que esa tabla nunca permita `UPDATE`/`DELETE` a nivel de rol de base de datos (solo `INSERT`), replicando el mismo principio que ya aplicaste en `DataExchangeRecord`.

## 12. Disaster recovery

- **RPO objetivo**: minutos (streaming replication continua primario → réplica cloud).
- **RTO objetivo**: definir según criticidad — para el ledger de pagos, minutos; para BI, horas es aceptable.
- Backups WAL continuos a object storage (Valkey no necesita backup de estado crítico si se trata como cache puro; si se usa para colas con datos no reproducibles, sí necesita persistencia AOF).
- Simulacros de failover trimestrales — un ledger financiero que nunca probó su recuperación no es confiable, sin importar cuán buena sea la arquitectura en el papel.

El documento 03 construye sobre esta base la capa de pagos, wallet y cumplimiento regulatorio.
