# ADR 0022 — PAC seleccionable y desacoplado; The Factory HKA como primer proveedor

- **Estado**: Aceptada (responde en parte Q-11)
- **Fecha**: 2026-10-21
- **Decisores**: dueño del producto

## Contexto
fiscal-invoicing (F13) emitía con un simulador mientras no se eligiera un PAC (Q-11). El dueño del
producto decide que la emisión tenga un **selector de PAC configurable** y que el primer proveedor sea
**The Factory HKA**, por su SDK propio [`github.com/angelnereira/hka-sdk`](https://github.com/angelnereira/HKA-SDK)
(Go, MIT, sin dependencias externas), ya probado por el dueño con credenciales reales de HKA. HKA es
**un proveedor más**: PlentyPay no debe quedar atado a él (sin *vendor lock-in*), y otro PAC debe poder
sumarse o reemplazarlo sin tocar el resto del sistema.

## Decisión
1. **Tres capas, una sola con nombre de proveedor.**
   - `internal/pac`: puerto neutral. Interfaz `Client` (`Info`, `Check`, `Send`; opcional
     `FolioCounter`), `Registry` (el selector), `Document` (lo que se emite, en centavos) y los errores
     (`RetryError`, `ErrInvalidDocument`). No conoce a ningún proveedor.
   - `internal/pac/dgi`: el contenido de la factura electrónica de la DGI (SFEP), común a todo PAC de
     Panamá: códigos del catálogo, receptor, líneas y totales como texto decimal exacto, y las reglas del
     formato que no dependen del proveedor. Un PAC nuevo lo reutiliza.
   - `internal/pac/<proveedor>`: un subpaquete por PAC (`hka`, `simulator`). Solo traduce el documento DGI
     al formato de su servicio, lo transporta y traduce sus respuestas. Es el único lugar donde aparece el
     proveedor o su SDK.
2. **Nada fuera del adaptador conoce al proveedor.** Dominio, base de datos, servicio, servidor gRPC,
   contrato y app trabajan con un id opaco (`pac_provider`) y con lo que el adaptador declara en
   `ListPacProviders`: nombre, ambientes y **qué credenciales pide** (clave, etiqueta y si es secreta;
   `PacCredentialField`). La app arma el formulario con eso. La prueba `TestR10_VendorNeutralPackages`
   falla si un paquete de proveedor o su SDK se importa fuera de su adaptador.
3. **Sumar o quitar un PAC** = escribir `internal/pac/<id>` (implementa `pac.Client` sobre `pac/dgi`),
   registrarlo en el mapa `pacAdapters` de `main.go` y nombrarlo en `PP_PAC_PROVIDERS`. Su configuración
   usa el prefijo `PP_PAC_<ID>_`. Sin migraciones, sin cambios de contrato ni de pantallas.
4. **Selector configurable.** `PP_PAC_PROVIDERS` (por defecto `simulator,hka`) decide qué adaptadores se
   ofrecen y en qué orden. Cada negocio elige el suyo en el perfil fiscal. Cada documento guarda con qué
   adaptador y en qué sucursal se emitió (migración 0002): cambiar de PAC no altera lo ya numerado, y las
   notas van al mismo PAC que su factura.
5. **Ambientes.** `DEMO` usa el ambiente de integración del PAC (sin validez fiscal, R9). `PROD` solo se
   ofrece con el interruptor operativo `FISCAL_PROD_ENABLED=true`, que se enciende tras la validación legal
   (F28.7, F30.3); mientras tanto responde `PAC_NOT_CONFIGURED`. Un adaptador simulado nunca atiende
   `PROD`.
6. **Credenciales** por negocio en security (`fiscal/<tenant>/pac`, lectura solo para fiscal-invoicing),
   como JSON con exactamente las claves que declara el adaptador. Se leen al enviar y nunca se registran
   (AGENTS.md §2.10, §2.16).
7. **Dinero sin `float`** (ADR 0013): `pac/dgi` escribe los montos desde los centavos del dominio (R1). No
   se usa el `docbuilder` del SDK de HKA, que recibe montos `float64`; la validación previa del SDK sí.
8. **Catálogo de la DGI** (en `pac/dgi`): tasa por clase (`legal.pa.itbms.standard_bps` → `01`, `alcohol`
   → `02`, `tobacco` → `03`, exento → `00`); forma de pago (`CASH` → `02`, `CREDIT_CARD` → `03`,
   `DEBIT_CARD` → `04`, `TRANSFER` → `08`, `CHECK` → `09`, `CREDIT` → `01`; `CARD` sin distinguir y
   `WALLET` → `99` con descripción, para no declarar un tipo de tarjeta que no se conoce); receptor según
   `tax_id_type` (RUC jurídico o natural → contribuyente `01`; `GOBIERNO` → `03`; cédula → consumidor final
   `02`; pasaporte o identificación extranjera → extranjero `04`), con `location_code`
   (provincia-distrito-corregimiento). Reglas del formato: solo USD; una sola forma de pago (la DGI exige el
   monto de cada una y el contrato aún no lo trae); contribuyente y gobierno con dirección de 5 a 100
   caracteres; gobierno con código CPBS y unidad por línea; una nota lleva el CUFE de su factura.
9. **Validación previa sin red.** Antes de numerar, el servicio pide al adaptador `Check`: `pac/dgi` más
   las reglas propias del proveedor (con HKA, la validación del SDK). Un folio no se gasta en un documento
   que el PAC rechazaría por formato. Los errores del receptor responden `INVALID_TAXPAYER`; el resto,
   `INVALID_REQUEST`.
10. **Respuestas del PAC** (cada adaptador las traduce a `pac.Result` o `pac.RetryError`). Con HKA: `200`
    → aceptado con CUFE y QR; `102` (duplicado) → se consulta el estado y se recupera el CUFE; `300` y
    fallos de red → reintento (R3); `119` (sin folios), `401` y otros códigos → reintento con alerta;
    `109` → rechazado con el mensaje del PAC; error de validación previa al enviar → defecto de PlentyPay.
11. El SDK de cada proveedor se fija a una versión exacta en `go.mod` (HKA: commit `6a8ebe6`) y se
    actualiza con un cambio revisado.

## Consecuencias
- Q-11 queda resuelta en cuanto al primer proveedor; siguen abiertos los detalles normativos del SFEP.
- El SDK de HKA fue probado por el dueño con credenciales reales, fuera de PlentyPay. El envío desde
  fiscal-invoicing al ambiente de integración de HKA necesita los tokens del negocio en el perfil fiscal
  (S-FIN-09) y queda por ejecutar.
- fiscal-invoicing es el único servicio interno con salida a internet (red `pac-egress`).
- PDF y XML se obtendrán del PAC (con HKA, `DescargaPDF`/`DescargaXML`) en el bloque C, como capacidad
  opcional del adaptador, y se guardan en `pp-fiscal` con su hash (N-FIS-15).
