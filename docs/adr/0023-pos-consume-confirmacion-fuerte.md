# ADR 0023 — pos consume la confirmación fuerte de sus devoluciones en identity

- **Estado**: Aceptada
- **Fecha**: 2026-10-22
- **Decisores**: agente de código, a pedido del dueño del producto (continuar el módulo de caja)

## Contexto
Una devolución en caja (F17.9, S-POS-08) exige confirmación fuerte: el estándar de seguridad
(`security-standards.md` §4.1) ya asigna la operación `pos.sale.void` («anular o devolver una venta de
caja») a `pos`. Para consumir ese token, `pos` debe llamar a `identity.ConsumeStepUp`, pero la matriz de
`service-dependencies.md` no tiene la arista `pos → identity`, y agregar una arista exige un ADR.

La alternativa de delegar la confirmación en `payments-core` no sirve: la parte en efectivo de una
devolución nunca pasa por `payments-core`, y cuando `pos` pide un reembolso a la billetera actúa como
servicio interno (sin persona y sin token).

## Decisión
1. Se agrega la arista **`pos → identity`**, solo para `ConsumeStepUp` con la operación
   `pos.sale.void`. `pos` no lee perfiles, contactos ni permisos de identity (los permisos siguen
   llegando del gateway en los metadatos, ADR 0011/0014).
2. `identity` admite a `pos` entre sus llamantes (SPIFFE, `AllowedIdentityCallers`).
3. `pos` consume el token **después** de validar la devolución y **antes** de escribirla; un reintento
   con la misma clave de idempotencia devuelve la devolución ya hecha sin pedir otro token (igual que
   `payments-core` en R1/R5).
4. La parte en saldo PlentyPay la reintegra `payments-core` (`RefundPayment`) llamado por `pos` como
   servicio interno (`is_internal_charger`), con el split del propio negocio; esa arista ya existía.

## Consecuencias
+ La devolución exige la misma confirmación fuerte que el resto de operaciones con dinero.
+ Ninguna arista nueva hacia datos de personas: solo el consumo de un token de un solo uso.
− `pos` depende de identity para devolver: si identity no responde, la devolución responde
  `DEPENDENCY_UNAVAILABLE` y no se escribe nada (nunca una devolución sin confirmación).

## Alternativas consideradas
- **Confirmación solo en el gateway**: el gateway no consume tokens de step-up (lo hace el servicio
  dueño de la operación, ADR 0020); cambiarlo afectaría a todos los servicios.
- **PIN de supervisor local en pos**: contradice ADR 0020 (factor guardado y verificado por identity) y
  la regla de no usar PIN compartidos.
