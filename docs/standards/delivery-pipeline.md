# Entrega continua, entornos e infraestructura

## 1. Flujo de trabajo en git
- **Trunk-based sin ramas**: se trabaja directamente sobre `main`, que debe quedar siempre desplegable; no se crean ramas adicionales.
- **Conventional Commits** con el contenedor como scope: `feat(ledger): ...`, `fix(api-gateway): ...`, `docs(adr): ...`, `chore(ci): ...`. Referencia al paso del roadmap y regla: `(F10.3, R1)`.
- Sin PR: cada commit a `main` corresponde a un paso del roadmap y lleva en el mensaje la verificación ejecutada (L0–L4); el checklist DoD de `.github/pull_request_template.md` se cumple antes de cada push.
- Cambios de contrato (`.proto`) o de ADR requieren revisión de los dueños de los contenedores consumidores (`consumers.txt`).

## 2. CI (pipeline por PR; solo se ejecuta lo afectado)
Detección de cambios por carpeta: un cambio en `ledger/` corre solo el pipeline de ledger; un cambio en `network-contracts/` corre todos los consumidores.

| Etapa | Qué hace | Bloquea |
|---|---|---|
| 1. repo-checks | `check-isolation.sh`, `check-docs.sh`, `sync-protos.sh --check`, gitleaks, lint de Markdown, licencias de dependencias | sí |
| 2. build-test | L0 + L1 por contenedor afectado (Go/Rust/Flutter) | sí |
| 3. integration | L2/L3 con testcontainers | sí |
| 4. security | Trivy/Grype sobre dependencias e imagen, gosec, cargo-audit, cargo-deny | CRITICAL sí |
| 5. image | build multi-arch (amd64/arm64), SBOM (Syft), firma cosign, push al registro por **digest** | sí (en main) |
| 6. e2e | `docker compose up` + `scripts/e2e-*.sh` | sí (en main y antes de release) |
| 7. flutter-build | APK/AAB, Linux, Windows, Web (iOS/macOS en runner macOS) → artefactos; en release se copian a `output/` del paquete de release | en release |

Motor de CI: cualquiera OSS o agnóstico (Forgejo Actions, Woodpecker, GitLab CI, GitHub Actions). Los pasos son scripts del repo (`scripts/ci/*.sh`) para no atarse al motor.

## 3. Versionado y artefactos
- Imagen: `registry/<org>/plentypay-<contenedor>:<semver>` + digest; `pp_build_info` expone versión y commit.
- SemVer por contenedor (independiente). Contratos versionados por paquete proto (`v1`).
- Releases de la app: `MAJOR.MINOR.PATCH+build`; la app consulta `infra-management.GetClientConfig` (vía gateway) para versión mínima soportada y fuerza actualización si es menor.

## 4. Entornos
| Entorno | Dónde | Datos | Rieles | Propósito |
|---|---|---|---|---|
| local | Docker Compose en la máquina del dev | sintéticos | sandbox | desarrollo |
| ci | Compose efímero | sintéticos | mocks | pruebas |
| staging | Kubernetes (mismo IaC que prod, más pequeño) | sintéticos/anonimizados | sandbox de proveedores | aceptación, carga |
| prod | Kubernetes self-hosted primario + nube DR (híbrido, doc 02) | reales | producción | clientes |
Nunca datos reales fuera de prod. Promoción por el **mismo digest** de imagen.

## 5. Docker Compose (fases 1–26)
Archivo raíz `docker-compose.yml` (+ `docker-compose.observability.yml`, `docker-compose.test.yml`).
1. Cada servicio: `build.context: ./<contenedor>` (verificado por `check-isolation.sh`), `env_file: ./<contenedor>/.env`, `restart: unless-stopped`, `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, usuario no root.
2. **Solo se publican** `api-gateway` (8080) y `web` (8081). Observability (Grafana 3000) solo en el perfil `observability` y ligado a `127.0.0.1`.
3. Redes: `edge` (gateway, web), `services` (todos los servicios), `data` (servicios con BD + postgres-db, nosql-db, event-bus, object-storage). Los datos nunca están en `edge`.
4. `healthcheck` contra `:9100/healthz/ready` — como las imágenes distroless no tienen shell ni curl, cada binario Go/Rust incluye el subcomando `/app healthcheck` que hace la petición localmente.
5. `depends_on: condition: service_healthy` siguiendo las capas de arranque de `service-dependencies.md` §5.
6. Volúmenes con nombre para datos; nunca bind-mounts de datos en prod.
7. Remover un contenedor = borrar su carpeta + su bloque en compose + su fila en `consumers.txt` (y los consumidores degradan según `service-dependencies.md` §6).

## 6. Kubernetes (Fase 27+)
- Manifiestos por contenedor en `infra/kubernetes/<contenedor>/` (Kustomize base + overlays `staging`/`prod`) — generados a partir del bloque Compose y los requisitos del SPEC (réplicas, recursos, PDB).
- Por servicio: `Deployment` (≥ 2 réplicas en prod, `topologySpreadConstraints` por zona), `Service`, `PodDisruptionBudget` (`minAvailable: 1`), `HorizontalPodAutoscaler` (CPU 70 % + métrica RPS), `NetworkPolicy` deny-all + permitidos según la matriz de llamadas, `ServiceAccount` propia, `securityContext` (runAsNonRoot, readOnlyRootFilesystem, drop ALL, seccomp RuntimeDefault), probes `live`/`ready` en `:9100`, `terminationGracePeriodSeconds: 30`.
- Migraciones: `Job` (hook PreSync de Argo CD) con `/app migrate up`.
- Datos: PostgreSQL con **CloudNativePG** (1 primario + 2 réplicas síncronas/asíncronas, backups a object-storage con PITR); ScyllaDB con **Scylla Operator**; NATS con chart oficial (3 nodos JetStream); object-storage Garage (3 nodos).
- Entrega: **Argo CD** (GitOps) apuntando a `infra/kubernetes/overlays/<entorno>`; certificados con **cert-manager**; ingreso con **ingress-nginx** o Gateway API (Envoy Gateway).
- Secretos: External Secrets Operator ← OpenBao.

## 7. OpenTofu (Terraform OSS) — multi-proveedor (ADR 0007)
Estructura en `infra/opentofu/`:
```
infra/opentofu/
├── modules/
│   ├── cluster-self-hosted/   # k3s/kubeadm sobre servidores propios (Ansible/cloud-init)
│   ├── cluster-gcp/           # GKE
│   ├── cluster-aws/           # EKS
│   ├── cluster-azure/         # AKS
│   ├── cluster-railway/       # ver nota: Railway NO es Kubernetes
│   └── platform/              # todo lo que va DENTRO del clúster (operadores, Argo CD, cert-manager, observabilidad)
└── environments/
    ├── staging/
    ├── prod-primary-self-hosted/
    └── prod-dr-<proveedor>/
```
**Contrato de módulo `cluster-*`** (idéntico en todos; cambiar de nube = cambiar el módulo, no el resto):

| Entradas | Tipo |
|---|---|
| `name` | string |
| `region` | string |
| `node_count` | number |
| `node_size_class` | `"small" \| "medium" \| "large"` (cada módulo traduce a su tipo de máquina) |
| `kubernetes_version` | string |

| Salidas | Uso |
|---|---|
| `kubeconfig` (sensible) | proveedor `kubernetes`/`helm` del módulo `platform` |
| `cluster_endpoint` | |
| `ingress_ip_or_hostname` | DNS |
| `storage_class` | volúmenes de BD |

| Proveedor | Módulo | Notas |
|---|---|---|
| Self-hosted (primario) | `cluster-self-hosted` | k3s HA (3 control-plane), MetalLB, Longhorn o local-path + réplicas de BD |
| GCP | `cluster-gcp` | GKE Standard regional |
| AWS | `cluster-aws` | EKS + managed node groups |
| Azure | `cluster-azure` | AKS |
| Railway | `cluster-railway` | **Railway no es Kubernetes**: este módulo despliega cada contenedor como servicio Railway desde su imagen (sin operadores). Útil para staging o demos; no cumple los requisitos de prod (red privada estricta, PDB, operadores de BD). Documentado como limitación, no como paridad. |

Estado remoto de OpenTofu en backend S3-compatible (object-storage propio o del proveedor) con bloqueo; nunca en el repo.

## 8. Despliegue a producción
1. Estrategia: rolling update con `maxUnavailable: 0`; payments-core/ledger con **canary** (Argo Rollouts) 5 % → 25 % → 100 % guiado por métricas de error y latencia.
2. Feature flags (infra-management) para todo lo incompleto; un despliegue nunca exige activar un flag.
3. Rollback = volver al digest anterior (migraciones expand/contract garantizan compatibilidad N-1, `data-standards.md` §5).
4. Ventanas: cambios de ledger/payments fuera de horas pico (Panamá: evitar 11:00–14:00 y 17:00–20:00, quincenas 15 y 30).

## 9. Documentación operativa exigida antes de producción
`docs/runbooks/` con: arranque/parada del sistema, restauración de BD (probada), rotación de secretos, pausa de un riel, resolución de pagos UNKNOWN, discrepancia de conciliación, incidente de seguridad, escalado manual, recuperación ante desastre (RPO ≤ 5 min, RTO ≤ 1 h). Cada alerta crítica tiene su runbook.
