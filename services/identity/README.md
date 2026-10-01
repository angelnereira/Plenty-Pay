# identity-service

Autenticación, sesiones y contexto de autorización para la app dinámica (mandato §7). Contrato: `plentypay.identity.v1` + `plentypay.common.v1.HealthService`.

**Estado: PARTIAL**

| Componente | Estado |
|---|---|
| Contrato gRPC (`contracts/proto/plentypay/identity/v1`) | IMPLEMENTADO (lint OK) |
| Hash de contraseñas Argon2id (PHC, salt por hash) | IMPLEMENTADO (tests) |
| Sesiones: token opaco 256-bit, SHA-256 en store, expiración, revocación | IMPLEMENTADO (tests) |
| Anti-enumeración de usuarios (error uniforme) | IMPLEMENTADO (test) |
| Contexto de autorización roles→permisos→features | IMPLEMENTADO (tests) |
| Interceptor de correlación x-correlation-id/x-request-id (ADR-0004) | IMPLEMENTADO (test) |
| Store en memoria (interfaz `store.Storage`) | PARTIAL — sustituir por PostgreSQL+sqlc (ADR-0010) |
| TLS server-side (mTLS interno) | TODO — plaintext SOLO dentro de red interna Compose |
| WebAuthn/passkeys | PLANNED (UNVERIFIED en plataformas Flutter; doc 03 §8) |
| Registro de auditoría de accesos | TODO (etapa siguiente) |

## Decisiones registradas

- **Email global único v1**: `AuthenticatePassword` no lleva tenant ⇒ un email pertenece a un tenant. Revise `ADR` futuro si el login pasa a tenant-scoped.
- **Roles built-in** (`OWNER/CASHIER/CONSUMER/DRIVER`) en `authz`; roles custom por tenant con la persistencia.
- **Fail secure**: hash malformado ⇒ `false`; sesión inválida ⇒ `Unauthenticated`; campos vacíos ⇒ `InvalidArgument`.

## Ejecutar

```bash
# Local
go test ./...
go run .

# Docker (desde deployment/compose)
docker compose up --build identity
```

## Límites de autocontención (mandato §4)

Todo lo necesario vive aquí: `internal/` (auth, authz, store, server), `main.go`, `Dockerfile`, `go.mod`, tests. Al eliminar esta carpeta se pierde solo identidad/sesiones/autorización — nada más del sistema depende de este código interno: solo del contrato `.proto`.
