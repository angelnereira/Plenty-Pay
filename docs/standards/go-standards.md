# Estándares Go

Aplica a: identity, api-gateway, security, infra-management, geolocation, fiscal-invoicing, catalog, inventory, orders, pos, logistics, payroll, notifications, analytics-bi, web (servidor estático) y a los "sidecars" Go de observability si los hubiera. Referencia viva: `identity/` y `api-gateway/`.

## 1. Versión y módulos
- Go ≥ 1.23 en `go.mod` (`go 1.23`); imagen de build `golang:1.24-alpine` o superior.
- Nombre del módulo = `plentypay/<carpeta>` (lo verifica `check-isolation.sh`).
- **Prohibido** `replace` hacia rutas locales en el `go.mod` versionado.
- Dependencias permitidas por defecto: `google.golang.org/grpc`, `google.golang.org/protobuf`, `github.com/jackc/pgx/v5`, `github.com/nats-io/nats.go`, `github.com/google/uuid`, `github.com/golang-jwt/jwt/v5`, `golang.org/x/crypto`, `go.opentelemetry.io/otel/...`, `github.com/prometheus/client_golang`, `github.com/gocql/gocql` (solo quien use Scylla), `github.com/stretchr/testify` (solo pruebas), `github.com/testcontainers/testcontainers-go` (solo pruebas). Cualquier otra requiere justificación en el SPEC (§Dependencias) y licencia OSI compatible.

## 2. Estructura de carpetas (obligatoria)
```
<contenedor>/
├── main.go                 # solo cableado: config → dependencias → servidor → apagado
├── go.mod / go.sum
├── Dockerfile
├── .env.example
├── README.md / SPEC.md
├── migrations/             # NNNN_descripcion.up.sql / .down.sql  (data-standards.md §5)
├── queries/                # SQL nombrado si se usa sqlc
└── internal/
    ├── config/             # carga y valida env; falla al arrancar si falta algo
    ├── pb/                 # GENERADO por scripts/sync-protos.sh — no editar
    ├── server/             # adaptador gRPC: traduce pb ↔ dominio y errores → status
    ├── service/            # casos de uso (orquesta dominio + store + clientes + eventos)
    ├── domain/             # tipos y reglas puras; sin imports de pb, sql, grpc, net
    ├── store/              # repositorios (interfaces en service, implementación pgx aquí)
    ├── client/             # clientes gRPC a otros contenedores (interfaces + impl)
    ├── events/             # outbox writer, relay, consumidores
    ├── observability/      # logger, métricas, trazas, interceptores
    └── testutil/           # fábricas, reloj falso, BD de prueba
```
Dependencias permitidas entre paquetes: `server → service → domain`; `service → store/client/events (por interfaz)`; `domain` no importa nada interno. Un `server` jamás habla con `store` directo.

## 3. Reglas de código
1. **Errores**: el dominio devuelve errores tipados (`domain.ErrInsufficientFunds`); **solo `server`** los traduce a `status.Error` con `ErrorInfo.reason` (tabla en `grpc-conventions.md` §4). Envolver con `fmt.Errorf("...: %w", err)`; comparar con `errors.Is/As`.
2. **Contexto**: todo método de E/S recibe `ctx context.Context` como primer argumento; nunca `context.Background()` dentro de un handler.
3. **Tiempo e ids inyectados**: interfaces `Clock{Now() time.Time}` e `IDGenerator{New() string}` (UUIDv7). `time.Now()` está prohibido fuera de `main.go`/`observability` (lint `forbidigo`).
4. **Dinero**: `domain.Money{AmountMinor int64; Currency string}` con operaciones que devuelven error ante desbordamiento o mezcla de monedas. Prohibido `float32/float64` en dominio de dinero (lint).
5. **SQL**: pgx v5 con `pgxpool`; consultas parametrizadas; preferente **sqlc** para generar código desde `queries/*.sql`. Cada consulta lleva nombre estable para métricas. Transacciones con `pgx.BeginTxFunc`; nivel `READ COMMITTED` salvo que el SPEC exija otro; bloqueo `SELECT ... FOR UPDATE` en orden de id para evitar deadlocks.
6. **Tenant**: helper `tenancy.FromContext(ctx)` lee metadatos; el store recibe el tenant explícito y además ejecuta `SET LOCAL app.tenant_id = $1` en cada transacción (RLS).
7. **Logs**: `log/slog` con handler JSON y los campos de `observability-standards.md` §1.
8. **Concurrencia**: nada de goroutines sueltas sin dueño; usar `errgroup` con contexto; canales con tamaño justificado.
9. **Configuración**: solo variables de entorno con prefijo `PP_`/nombres del `.env.example`; validación al arrancar (falla rápido con mensaje claro, sin imprimir valores secretos).
10. **Apagado ordenado**: SIGTERM → `ready=false` → `GracefulStop` gRPC con tope de **25 s** → cerrar consumidores → vaciar outbox relay → cerrar pool.
11. **Interceptores (orden)**: recuperación de pánico → request-id/traza → logging de acceso → métricas → autenticación de servicio (mTLS/metadatos) → autorización por RPC → validación.
12. **Clientes gRPC**: deadline por defecto 3 s (o el del SPEC), reintentos solo para `UNAVAILABLE` y solo en RPC idempotentes, circuit breaker por destino (`grpc-conventions.md` §5).
13. Nombres en inglés; comentarios de paquete y de reglas en español con referencia `R<n>`.

## 4. Pruebas
- `go test -race ./...` debe pasar siempre.
- Tablas de casos para máquinas de estado; `t.Parallel()` cuando no comparten estado.
- L2 con testcontainers (PostgreSQL 16, NATS 2.10).
- Ver `testing-strategy.md`.

## 5. Lint (`.golangci.yml` en cada contenedor)
```yaml
run: { timeout: 5m }
linters:
  enable: [errcheck, govet, staticcheck, gosec, revive, forbidigo, bodyclose, sqlclosecheck, rowserrcheck, contextcheck, nilerr, exhaustive, gocritic]
linters-settings:
  forbidigo:
    forbid:
      - p: '^time\.Now$'
        msg: "usa Clock inyectado (go-standards §3.3)"
      - p: '^fmt\.Print'
        msg: "usa slog"
  exhaustive: { default-signifies-exhaustive: false }
issues:
  exclude-rules:
    - path: main\.go
      linters: [forbidigo]
    - path: internal/observability/
      linters: [forbidigo]
```

## 6. Dockerfile (plantilla)
```dockerfile
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION:-dev}" -o /out/app .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
USER nonroot:nonroot
EXPOSE 500xx 9100
ENTRYPOINT ["/app"]
```
Solo `COPY` desde la propia carpeta (contexto de build = carpeta del contenedor).
Las migraciones se aplican con el subcomando `/app migrate up` (mismo binario, `golang-migrate` embebido con `embed.FS`) como job previo al despliegue; el servidor nunca migra en caliente salvo en entorno `local`.
