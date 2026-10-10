# SPEC — <contenedor>

> Especificación ejecutable del contenedor. Lo que no está aquí (ni en los estándares/dominio que referencia) no se implementa. Mantener sincronizado con el `.proto`.

## 1. Responsabilidad
Una o dos frases. **Hace**: … **No hace** (y quién sí): …

## 2. Ficha
| Campo | Valor |
|---|---|
| Lenguaje | Go / Rust |
| Puerto gRPC / admin | 500xx / 9100 |
| Contrato | `network-contracts/proto/<x>.proto` (`plentypay.<x>.v1`) |
| Esquema PostgreSQL | `<schema>` (rol `<schema>_svc`) |
| Otros almacenes | Scylla / NATS / object-storage |
| Fase de implementación | F<nn> |
| Capa de arranque | L<n> (`service-dependencies.md` §5) |

## 3. Modelo de datos
Tablas (DDL resumido con tipos, PK, índices, RLS) + tablas estándar (`idempotency_keys`, `outbox`, `processed_events`) si aplica.

## 4. RPCs
| RPC | Permiso | Idempotente | Comportamiento | Errores (`reason`) |
|---|---|---|---|---|

## 5. Reglas de negocio
- **R1** …
- **R2** …
(cada regla tiene al menos una prueba con su id en el nombre)

## 6. Eventos
Publica: subject → mensaje → cuándo. Consume: subject → efecto (idempotente).

## 7. Dependencias
Llama a (RPC, deadline, qué pasa si falla). Es llamado por.

## 8. Configuración
| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|

## 9. Observabilidad
Métricas de negocio, logs relevantes, alertas propias.

## 10. Seguridad
Datos sensibles y cómo se protegen; step-up; límites de tasa.

## 11. Pruebas de aceptación
Escenarios Given/When/Then que cierran la fase.

## 12. Plan de implementación
Pasos F<nn>.<m> de la hoja de ruta que tocan este contenedor, en orden.

## 13. Riesgos y preguntas abiertas
Referencias a `docs/open-questions.md`.
