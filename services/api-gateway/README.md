# api-gateway (BFF)

Único punto de entrada del cliente Flutter; agrega llamadas gRPC hacia los servicios y valida sesión antes de reenviar (doc 04 §2 #2).

**Estado: PLANNED (Etapa 1)**

| Pieza | Estado |
|---|---|
| Proxy/agregación gRPC hacia identity | TODO |
| Validación de sesión en cada llamada (autorización real en backend) | TODO |
| Rate limiting (mandato §13) | TODO |
| Propagación de correlación (ADR-0004) | TODO |
| Health/readiness propios | TODO |

Tecnología: **Go**. Sin lógica de negocio propia: solo coordinación.
