# tests/ (integración y contrato a nivel repo)

Reglas §20: todo servicio con unit + integration + contract tests. El estado detallado por servicio vive en cada `services/*/README.md`; aquí vive lo cruzado.

| Suite | Estado |
|---|---|
| Contract tests (buf lint + breaking changes en CI) | TODO — scripts listos, CI pendiente |
| Integración gateway→identity→ledger (compose) | TODO (Etapa 2) |
| Matriz financiera: idempotencia, concurrencia, rollback, duplicación, timeout, retry, límites, permisos, auth | TODO (Etapa 2) — dominio ledger ya cubre idempotencia/balanceo/reversos a nivel unit |
