# ADR 0022 — PAC seleccionable por adaptador; The Factory HKA como primer PAC

- **Estado**: Aceptada (responde en parte Q-11)
- **Fecha**: 2026-10-21
- **Decisores**: dueño del producto

## Contexto
fiscal-invoicing (F13) emite con un simulador mientras no se elija un PAC (Q-11). El dueño del
producto decide que la emisión tenga un **selector de PAC configurable** y que el primero sea
**The Factory HKA**, usando su SDK propio [`github.com/angelnereira/hka-sdk`](https://github.com/angelnereira/HKA-SDK)
(Go, MIT, sin dependencias externas). El SDK cubre emisión (`Enviar`), estado, anulación, descarga de
XML y PDF (CAFE), correo, folios restantes y consulta de RUC/DV ante la DGI.

## Decisión
1. **Selector por adaptador.** fiscal-invoicing tiene un registro de adaptadores (`pac.Client`, SPEC
   R10). Cada uno declara su id, nombre, ambientes que admite y qué credenciales pide. El perfil fiscal
   guarda el adaptador elegido (`pac_provider`) y la app lo elige de `ListPacProviders`. Agregar un PAC
   = escribir su adaptador; el resto del servicio no cambia.
2. **Adaptadores iniciales**: `hka` (The Factory HKA, por el SDK) y `simulator` (sin red; pruebas y
   negocios que aún no contratan PAC).
3. **Ambientes de HKA**: `DEMO` usa el endpoint de integración de HKA (`demoemision`): documentos de
   prueba, sin validez fiscal (R9). `PROD` usa el endpoint de producción y solo se habilita con el
   interruptor operativo `FISCAL_PROD_ENABLED=true`, que se enciende tras la validación legal (F28.7,
   F30.3); mientras tanto `PROD` responde `PAC_NOT_CONFIGURED`.
4. **Credenciales**: `TokenEmpresa` y `TokenPassword` de HKA, por negocio, se guardan en security
   (`fiscal/<tenant>/pac`, lectura solo para fiscal-invoicing); fiscal-invoicing las lee al enviar y
   nunca las registra (AGENTS.md §2.10, §2.16).
5. **Dinero sin `float`** (ADR 0013): el documento HKA se arma con `types.DocumentoElectronico`
   (montos como texto) a partir de los centavos enteros calculados por el dominio (R1); no se usa el
   `docbuilder` del SDK, que recibe montos `float64`. La validación previa del SDK se conserva.
6. **Códigos del catálogo DGI**: tasa por clase (`legal.pa.itbms.standard_bps` → `01`, `alcohol` →
   `02`, `tobacco` → `03`, exento → `00`); forma de pago (`CASH` → `02`, `CREDIT_CARD` → `03`,
   `DEBIT_CARD` → `04`, `TRANSFER` → `08`, `CHECK` → `09`, `CREDIT` → `01`; `CARD` sin distinguir y `WALLET` → `99` con
   descripción, para no declarar un tipo de tarjeta que no se conoce). Con HKA el documento lleva una sola forma de pago: la
   DGI exige el monto de cada una y el contrato aún no lo trae; con varias, la emisión responde `INVALID_REQUEST`; receptor según `tax_id_type` (RUC jurídico/natural →
   contribuyente `01`; gobierno → `03`; cédula → consumidor final `02`; pasaporte o identificación
   extranjera → extranjero `04`). El número del documento es el folio de R2 (`PadDocNumber`).
7. **Validación previa sin red.** Antes de numerar, el adaptador arma el documento y aplica la validación del SDK
   (`Check`): un folio no se gasta en un documento que el PAC rechazaría por formato. Los campos del receptor se
   responden como `INVALID_TAXPAYER`; el resto, `INVALID_REQUEST`. Solo se emite en USD (balboas).
8. **Respuestas de HKA**: `200` → aceptado con CUFE y QR; `102` (duplicado) → se consulta el estado y
   se recupera el CUFE; `300`, `119` (sin folios), `401` y fallos de red → reintento con backoff (R3) y
   alerta; error de validación previa o `109` → rechazado con el mensaje (el de validación previa es un
   defecto de PlentyPay y se registra como tal).
9. **Datos del receptor**: HKA exige dirección (5–100 caracteres) a contribuyentes y gobierno; el
   contrato `Taxpayer` agrega `address` y `location_code` (provincia-distrito-corregimiento).
10. El SDK se fija a un commit exacto en `go.mod` y se actualiza con un cambio revisado.

## Consecuencias
- Q-11 queda resuelta en cuanto al proveedor (HKA); siguen abiertos los detalles normativos del SFEP.
- Probar en `DEMO` con HKA necesita los tokens de integración del negocio, que el dueño carga en el
  perfil fiscal (S-FIN-09).
- Cada documento guarda su adaptador y su sucursal (migración 0002): cambiar de PAC no altera lo ya numerado, y las
  notas van al mismo PAC que su factura.
- PDF y XML se obtienen del PAC (`DescargaPDF`/`DescargaXML`) en el bloque C, y se guardan en
  `pp-fiscal` con su hash (N-FIS-15).
