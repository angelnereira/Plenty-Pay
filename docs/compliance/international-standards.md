# Estándares internacionales aplicados

Complementa a [`regulatory-framework.md`](regulatory-framework.md) (normas de Panamá). Aquí está **cada estándar internacional que afecta la lógica de negocio o los formatos**, la edición consultada, y las reglas `N-STD-<nn>` en que se convierte. Usa las mismas marcas: ✔ confirmado en la fuente del organismo, ◐ fuente secundaria, ⚠ sin confirmar.

Investigado el 2026-10-12. Los textos de ISO, EMVCo y PCI son de pago o de acceso restringido: donde no se pudo leer el texto oficial, la regla se apoya en una especificación pública derivada y queda marcada ◐.

## 1. Resumen: qué estándar gobierna qué

| Tema | Estándar | Edición | Dueño en PlentyPay |
|---|---|---|---|
| Moneda | ISO 4217 | lista vigente (agencia de mantenimiento: SIX) | ledger, todos |
| Fecha y hora | ISO 8601-1:2019 (+ enmienda 2022), RFC 3339 | — | todos |
| País y subdivisión | ISO 3166-1, ISO 3166-2 | — | identity, fiscal-invoicing |
| Formato regional | Unicode CLDR, BCP 47 | versión de `intl` de la app | flutter_app |
| Teléfono | UIT-T E.164 | — | identity, notifications |
| Unidades de medida | SI; UN/CEFACT Rec. 20 (rev. 11e) | — | catalog, inventory |
| Código de producto | GS1 General Specifications | — | catalog, pos |
| Datos de tarjeta | PCI DSS | v4.0.1 | payments-core, flutter_app, web |
| Código QR de pago | EMV QRCPS, modo presentado por el comercio | v1.0 y posteriores | payments-core |
| Categoría de comercio | ISO 18245 (MCC) | — | identity, payments-core |
| Mensajería financiera | ISO 20022 | — | settlement |
| Autenticación | NIST SP 800-63B-4; FIDO2 / WebAuthn | 2025 | identity |
| Accesibilidad | WCAG | 2.2, nivel AA | flutter_app, web |
| Seguridad de aplicación | OWASP ASVS, OWASP MASVS | ASVS 5.0.0 | todos |
| Gestión de seguridad | ISO/IEC 27001:2022 | — | organización |
| Errores HTTP | RFC 9457 (Problem Details) | — | api-gateway |
| Trazas y telemetría | W3C Trace Context; OpenTelemetry | nivel 1; convenciones semánticas vigentes | todos |
| QR y NFC | ISO/IEC 18004; NFC Forum NDEF | — | flutter_app |

## 2. Dinero — ISO 4217

Datos confirmados: `USD` tiene código numérico **840** y **2** decimales; `PAB` (balboa) tiene código numérico **590** y **2** decimales (subunidad: centésimo).

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-01** | La moneda se guarda como código alfabético de 3 letras mayúsculas. Solo se aceptan códigos de la lista vigente; el MVP acepta `USD` | B `CURRENCY_MISMATCH` | ✔ |
| **N-STD-02** | El número de decimales de un monto **sale de la tabla ISO 4217**, no se asume 2. `amount_minor` es el monto en la unidad menor de esa moneda. La tabla (código, numérico, decimales) es un dato de plataforma | — | ✔ |
| **N-STD-03** | El código **numérico** (`840`) se usa donde un estándar externo lo exige: campo 53 del QR EMV y mensajes de rieles. La conversión alfabético ↔ numérico usa la misma tabla | — | ✔ |
| **N-STD-04** | `PAB` no es una moneda del ledger: es una **presentación** de `USD` a la par. Si un tercero envía `PAB`/`590`, se acepta y se registra como `USD` con el mismo monto, guardando el código original en el intento | — | ✔ paridad · ◐ tratamiento |
| **N-STD-05** | No se suman ni comparan montos de monedas distintas (invariante I1 por moneda). No hay conversión implícita | B | ✔ |

## 3. Fecha y hora — ISO 8601, RFC 3339, CLDR

Hallazgos que cambian reglas ya escritas:
- ISO 8601 exige la `T` entre fecha y hora y prohíbe el desfase `-00:00`; RFC 3339 es un perfil más estricto en casi todo y más laxo en esos dos puntos. Se usa la intersección.
- La semana ISO empieza en **lunes** y la semana 01 es la que contiene el 4 de enero; el año de la semana puede diferir del año calendario.
- En ISO 8601, `P1M` es un mes y `PT1M` es un minuto.
- **Los datos regionales de Unicode para `es-PA` dan fecha corta con el mes primero (`MM/dd/yy`) y hora de 12 horas con `a. m.` / `p. m.`** Una fecha solo con números es ambigua en Panamá.

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-06** | Instantes en API, eventos y logs: `AAAA-MM-DDThh:mm:ss.sssZ`, siempre UTC con `Z`, siempre con `T`, milisegundos fijos. Nunca desfase local ni `-00:00` | B (validación de entrada) | ✔ |
| **N-STD-07** | Fecha de negocio sin hora: `AAAA-MM-DD`, interpretada en `America/Panama`. Nunca se convierte a instante sin declarar la zona | — | ✔ |
| **N-STD-08** | Duraciones en configuración y contratos: segundos enteros en campos `*_seconds`, o ISO 8601 (`PT15M`) donde un tercero lo pida. Nunca "15m" ni texto libre | — | ✔ |
| **N-STD-09** | Rangos de tiempo: inicio inclusivo, fin exclusivo (`common.TimeRange`). Un "día de negocio" es `[00:00, 24:00)` en `America/Panama` | — | ✔ |
| **N-STD-10** | **La interfaz nunca muestra una fecha solo con números.** El mes va siempre en texto: `10 oct 2026`. Aplica también a recibos, facturas en PDF, exportes en PDF y campos de fecha (el selector muestra el mes con nombre) | B (revisión de pantalla) | ✔ dato CLDR · decisión propia |
| **N-STD-11** | Hora en la interfaz según el formato regional del dispositivo y, por defecto en `es_PA`, 12 horas: `2:03 p. m.` Los archivos CSV usan siempre ISO 8601 | — | ◐ Q-23 |
| **N-STD-12** | Semanas en reportes y nómina: de **lunes a domingo**, numeradas por ISO 8601. El reporte indica el rango de fechas, no solo el número de semana | — | ✔ |
| **N-STD-13** | Formato de números en la interfaz por `intl` con el locale: punto decimal y coma de miles en `es_PA` (`1,234.56`). No se construyen números con concatenación de texto | — | ◐ |

## 4. Geografía y contacto

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-14** | País: ISO 3166-1 alfa-2 en mayúsculas (`PA`). Provincias y comarcas: ISO 3166-2 (`PA-8`). Nacionalidad en verificación de identidad: misma lista | B | ◐ |
| **N-STD-15** | Teléfono guardado en E.164: `+` y solo dígitos, máximo 15. Panamá: `+507` seguido de **8 dígitos si es móvil (empieza por 6)** o **7 si es fijo**; no hay códigos de área ni prefijo troncal | B "Escribe un número válido." | ◐ |
| **N-STD-16** | Un número de otro país se acepta si es E.164 válido; SMS y WhatsApp solo se envían a números verificados por código | B | ✔ regla interna |
| **N-STD-17** | Idioma como etiqueta BCP 47 (`es-PA`, `en`); la app negocia con `Accept-Language` y cae a `es-PA` | — | ✔ |
| **N-STD-18** | Coordenadas en WGS 84, grados decimales, latitud antes que longitud; 6 decimales al guardar | — | ✔ |

## 5. Unidades de medida — SI y UN/CEFACT Rec. 20

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-19** | La unidad de un producto es un código de la Recomendación 20: `KGM` kilogramo, `GRM` gramo, `LTR` litro, `MLT` mililitro, `MTR` metro, `CMT` centímetro, `MTK` metro cuadrado, `H87` pieza. Lista cerrada en catalog | B | ◐ (códigos por confirmar contra el anexo: Q-24) |
| **N-STD-20** | Unidades no SI (`LBR` libra, galón, onza) **no se almacenan**: se convierten al guardar con factor exacto (1 lb = 0.45359237 kg; 1 gal EE. UU. = 3.785411784 L) y se redondea half-up a milésimas | — | ✔ factores de definición |
| **N-STD-21** | Símbolos SI exactos en pantalla y documentos: `kg`, `g`, `L`, `mL`, `m`, `cm`, `m²`; sin punto, sin plural, con espacio entre número y símbolo (`2.5 kg`) | — | ✔ |
| **N-STD-22** | Precio por unidad de medida en productos a granel: siempre se muestra el precio por unidad SI (`$4.40 por kg`), con la equivalencia tradicional como dato secundario | — | ✔ (regulatory-framework N-LOG-01) |

## 6. Código de producto — GS1

Algoritmo del dígito de control (módulo 10): desde el dígito más a la derecha **sin contar el de control**, se multiplica alternando por 3 y por 1, se suman los productos, y el dígito de control es lo que falta para el siguiente múltiplo de 10 (0 si ya lo es).

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-23** | Un código de barras se acepta como GTIN solo con 8, 12, 13 o 14 dígitos y dígito de control correcto. Internamente se guarda normalizado a 14 dígitos con ceros a la izquierda; se muestra como se capturó | B "El código de barras no es válido." | ◐ algoritmo (fuente GS1 no accesible) |
| **N-STD-24** | Los prefijos **02 y 20–29** son números de circulación restringida: códigos internos de tienda y **productos de peso variable**. No son GTIN globales: no se usan para identificar el producto en el marketplace ni entre comercios | B (no publicable como identificador global) | ✔ |
| **N-STD-25** | Etiqueta de balanza (peso variable): el comercio configura la estructura de su código de 13 dígitos (prefijo, dígitos de artículo, dígitos de peso o de precio, y decimales). La caja extrae artículo y cantidad al escanear; sin configuración, el código se trata como desconocido | — | ◐ estructura local: Q-24 |
| **N-STD-26** | Un producto sin código de barras del fabricante recibe un código interno con prefijo `2`, único dentro del negocio | — | ✔ |
| **N-STD-27** | Códigos `978` y `979` (libros) y `977` (publicaciones periódicas) son válidos como GTIN-13 | — | ◐ |

## 7. Datos de tarjeta — PCI DSS v4.0.1

Confirmado en la FAQ 1588 del PCI SSC (febrero de 2025): para declarar **SAQ A**, un comercio electrónico que **incrusta** la página o el formulario de pago de un tercero (por ejemplo en un iframe) debe confirmar que su sitio no es vulnerable a ataques por scripts. Lo cumple aplicando técnicas como las de los requisitos 6.4.3 y 11.6.1, o con la confirmación del proveedor de pagos de que su solución incrustada protege la página. El criterio **no aplica** si el comercio **redirige** al cliente al proveedor.

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-28** | PlentyPay nunca ve el número de tarjeta, el código de seguridad, la banda ni el PIN: ni en campos de la app, ni en el gateway, ni en logs, ni en trazas, ni en capturas de error | B | ✔ |
| **N-STD-29** | **Integración por redirección o por componente nativo del PSP**, no por iframe dentro de una página propia. Así el criterio de scripts de SAQ A no aplica a PlentyPay | — | ✔ FAQ 1588 |
| **N-STD-30** | Si en `web` se incrusta alguna vez un formulario de pago: inventario de todos los scripts de esa página, autorización y verificación de integridad de cada uno, política CSP estricta sin scripts de terceros, y detección de cambios en la página | B (no se despliega sin esto) | ✔ |
| **N-STD-31** | Lo único que se guarda de una tarjeta: token del PSP, marca, últimos 4 dígitos y vencimiento. Para mostrar: `Visa •••• 4242` | — | ✔ |
| **N-STD-32** | El detector de fugas de la suite de pruebas (observabilidad §15.4) incluye el patrón de número de tarjeta con validación de Luhn | B (CI) | ✔ regla interna |
| **N-STD-33** | PlentyPay y cada comercio confirman con su adquirente qué cuestionario les corresponde; la app lo recuerda en la pantalla de integraciones | G | ✔ |

## 8. QR de pago — EMV QRCPS (modo presentado por el comercio)

Estructura confirmada en una especificación nacional pública basada en EMVCo: cada objeto de datos es **identificador de 2 dígitos + longitud de 2 dígitos + valor** (de 1 a 99 caracteres).

| Id | Nombre | Presencia | Contenido |
|---|---|---|---|
| `00` | Indicador de formato | Obligatorio | `01` |
| `01` | Método de iniciación | Opcional | `11` QR estático (reutilizable), `12` dinámico (un solo cobro) |
| `02`–`51` | Cuenta del comercio | Al menos uno | `02`–`25` redes EMVCo; `26`–`51` otros operadores (aquí iría PlentyPay o un esquema nacional) |
| `52` | Categoría del comercio | Obligatorio | MCC de ISO 18245, 4 dígitos |
| `53` | Moneda | Obligatorio | ISO 4217 **numérico** (`840`) |
| `54` | Monto | Condicional | Distinto de cero; punto como separador decimal; ausente si lo escribe el pagador |
| `55` | Indicador de propina o cargo | Opcional | — |
| `58` | País | Obligatorio | ISO 3166-1 alfa-2 |
| `59` | Nombre del comercio | Obligatorio | — |
| `60` | Ciudad | Obligatorio | — |
| `61` | Código postal | Opcional | — |
| `62` | Datos adicionales | Opcional | Referencia de factura, terminal, etc. |
| `63` | CRC | Obligatorio, último | CRC-16 según ISO/IEC 13239, polinomio `1021` hex, valor inicial `FFFF` hex, calculado sobre todo el contenido incluido el identificador y la longitud del propio CRC; 4 caracteres hexadecimales en mayúsculas |

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-34** | El QR propio (`https://<host>/t/<code>`) sigue siendo el formato por defecto. El terminal guarda `qr_format` = `PP_URL` o `EMV_MPM` | — | ✔ |
| **N-STD-35** | Para generar `EMV_MPM`, el comercio necesita un **MCC** (ISO 18245) y una **ciudad**: ambos se piden en el alta de negocio desde ahora, aunque el QR EMV no esté activo | — | ◐ |
| **N-STD-36** | Al leer un QR: si empieza por `000201` se trata como EMV; se valida el CRC antes de cualquier otra cosa y se rechaza si no coincide. El nombre mostrado al pagador sigue viniendo del servidor, nunca del campo `59` | B "Este código no es válido." | ◐ |
| **N-STD-37** | QR estático (`11`) no lleva monto fijo y puede imprimirse; QR dinámico (`12`) lleva monto, vence con el intent (15 min) y no se imprime | — | ◐ |

Qué esquema interoperable existe en Panamá sigue abierto (Q-05).

## 9. Autenticación — NIST SP 800-63B-4 y FIDO2

Confirmado en el texto de NIST: contraseña como **único factor**, mínimo **15** caracteres; como parte de autenticación multifactor, mínimo **8**; aceptar al menos **64**; **sin reglas de composición** (no exigir mayúsculas o símbolos); **sin cambio periódico** obligatorio; comparar contra lista de contraseñas comunes o filtradas; permitir gestores de contraseñas y pegado; como máximo **100** intentos fallidos consecutivos antes de deshabilitar el autenticador.

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-38** | Sin reglas de composición ni caducidad de contraseña; lista de bloqueo de contraseñas comunes; cada carácter Unicode cuenta como uno | — | ✔ (ya vigente en `security-standards.md` §2) |
| **N-STD-39** | Los campos de contraseña permiten pegar y autocompletar; nunca se bloquea el gestor de contraseñas | B (revisión de pantalla) | ✔ |
| **N-STD-40** | **Discrepancia abierta**: hoy la contraseña mínima es de 12 caracteres y es el único factor en el inicio de sesión; NIST pide 15 en ese caso. Opciones: subir a 15, o hacer obligatorio un segundo factor | pendiente | ✔ dato · decisión: Q-25 |
| **N-STD-41** | Toda operación de dinero sobre el umbral exige un segundo factor resistente a suplantación cuando el dispositivo lo permite (passkey o biometría ligada al dispositivo); el PIN es el respaldo | B `STEP_UP_REQUIRED` | ✔ |
| **N-STD-42** | Referencia de sesión de NIST para nivel AAL2: reautenticar como máximo cada 24 horas y tras 1 hora de inactividad. PlentyPay mantiene sesiones de lectura más largas (refresh de 30 días) y lo compensa exigiendo confirmación fuerte en cada operación sensible y bloqueo por inactividad de 5 minutos en móvil. Queda como diferencia documentada, a revisar en F28 | — | ✔ dato · decisión propia |

## 10. Accesibilidad — WCAG 2.2 nivel AA

Criterios nuevos de la versión 2.2, confirmados en W3C. Se cumplen los de nivel A y AA.

| Criterio | Nivel | Qué exige | Cómo se cumple en PlentyPay |
|---|---|---|---|
| 2.4.11 Foco no oculto | AA | El elemento con foco no queda totalmente tapado | Barras fijas y franjas de aviso nunca cubren el campo activo; la pantalla se desplaza |
| 2.5.7 Movimientos de arrastre | AA | Todo lo que se hace arrastrando se puede hacer con un solo toque | **Regla nueva N-STD-43** |
| 2.5.8 Tamaño del objetivo | AA | Al menos 24 × 24 px CSS | Objetivos de 48 dp (más estricto) |
| 3.2.6 Ayuda consistente | A | La ayuda aparece en el mismo lugar relativo en todas las pantallas | **Regla nueva N-STD-44** |
| 3.3.7 Entrada redundante | A | No volver a pedir un dato ya dado en el mismo proceso | **Regla nueva N-STD-45** |
| 3.3.8 Autenticación accesible | AA | No depender de memorizar o resolver un acertijo sin alternativa | Biometría y passkeys como alternativa; pegado permitido (N-STD-39); sin CAPTCHA de acertijo |

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-43** | Toda acción de arrastrar tiene alternativa de un toque: en turnos (S-PAY-04), "Asignar turno" desde la celda; en tableros (S-ANA-03), botones "Mover arriba / abajo"; en listas deslizables (quitar línea en caja), botón de eliminar visible | B (revisión de pantalla) | ✔ |
| **N-STD-44** | El acceso a ayuda está siempre en el mismo sitio: última entrada del menú "Más" y fila "Ayuda y reclamos" en Mi cuenta | B | ✔ |
| **N-STD-45** | Un asistente nunca vuelve a pedir un dato ya capturado en ese proceso: se precarga o se ofrece para elegir (representante legal en el alta de negocio, dirección de entrega guardada, datos fiscales) | B | ✔ |
| **N-STD-46** | Contraste mínimo 4.5:1 en texto y 3:1 en componentes e iconos significativos; el estado nunca se comunica solo con color | B | ✔ (WCAG 2.1, vigente en 2.2) |
| **N-STD-47** | Todo se puede operar con teclado y con lector de pantalla; el orden de lectura coincide con el visual; los mensajes de error se anuncian | B | ✔ |
| **N-STD-48** | Ninguna acción con límite de tiempo sin aviso ni prórroga, salvo las de seguridad o las que dependen de un tercero (QR de 15 min, cuenta regresiva de aceptación): estas muestran el tiempo restante en texto | A | ✔ |

## 11. Errores de API — RFC 9457

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-49** | El cuerpo de error del gateway adopta Problem Details, tipo de contenido `application/problem+json`, con los miembros estándar `type`, `title`, `status`, `detail`, `instance` y las extensiones `reason` y `request_id`. Los campos actuales `error` y `reason` se conservan (contrato aditivo); `error` y `detail` llevan el mismo texto | — | ✔ estándar · adopción en F09.4 |
| **N-STD-50** | `type` es una URI estable por `reason` (`https://<host>/problems/<reason en minúsculas>`); `instance` es `urn:uuid:<request_id>`. Los clientes ignoran extensiones que no conocen | — | ✔ |

## 12. Seguridad de aplicación y mensajería

| Id | Regla | Efecto | Estado |
|---|---|---|---|
| **N-STD-51** | OWASP ASVS 5.0.0 es la lista de verificación del backend y MASVS la de la app; el nivel objetivo se fija en F28.5. Cada requisito aplicable se enlaza a una prueba o control | G | ◐ versión confirmada; capítulos sin revisar |
| **N-STD-52** | ISO 20022: los archivos y APIs de liquidación guardan un identificador de extremo a extremo por pago (máximo 35 caracteres, sin espacios al inicio o al final) y la referencia de remesa, para no perder datos al integrar con bancos | — | ⚠ sin texto consultado: Q-10 |
| **N-STD-53** | MCC (ISO 18245) del comercio: 4 dígitos, de la lista vigente; se usa en el QR EMV y en reglas de riesgo y de comisión por rubro | B | ⚠ sin texto consultado |

## 13. Qué cambia en documentos ya escritos

| Cambio | Documento |
|---|---|
| Fechas siempre con mes en texto; hora de 12 horas por defecto | `design-system.md` §5, `functional-spec/README.md` C-09, `regulatory-framework.md` N-FMT-02 |
| Decimales de la moneda desde la tabla ISO 4217 | `domain-model.md` §10, glosario §2 |
| MCC y ciudad en el alta de negocio | `functional-spec/00-transversal.md` S-GEN-15 |
| Alternativa a arrastrar; ayuda en lugar fijo | `functional-spec/README.md` C-21, C-22 |
| Códigos de balanza y prefijos restringidos | `functional-spec/04-catalog-inventory.md` S-CAT-02, `03-pos.md` S-POS-11 |
| Cuerpo de error Problem Details | `api-gateway/SPEC.md` §3.11 (al implementar F09.4) |

## 14. Fuentes

Organismos (reglas ✔):
- W3C — [Novedades de WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) · [Trace Context](https://www.w3.org/TR/trace-context/)
- PCI SSC — [FAQ 1588: criterio de scripts para SAQ A](https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/how-does-an-e-commerce-merchant-meet-the-saq-a-eligibility-criteria-for-scripts/)
- NIST — [SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)
- IETF — [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)
- OpenTelemetry — [registro de errores](https://opentelemetry.io/docs/specs/semconv/general/recording-errors/) · [excepciones como logs](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/)
- GS1 — [GSCN 23-006, números de circulación restringida](https://www.gs1.org/docs/barcodes/GSCN-23-006-RCN.pdf)
- OWASP — [ASVS](https://owasp.org/www-project-application-security-verification-standard/)

Derivadas y secundarias (reglas ◐):
- Autoridad Monetaria de Hong Kong — [Common QR Code Specification](https://www.hkma.gov.hk/media/chi/doc/key-functions/financial-infrastructure/infrastructure/retail-payment-initiatives/Common_QR_Code_Specification.pdf), basada en EMV QRCPS
- [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217) e [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) en Wikipedia (los textos de ISO son de pago)
- [Numeración telefónica de Panamá](https://en.wikipedia.org/wiki/Telephone_numbers_in_Panama)
- [ICU, locale es-PA](https://www.localeplanet.com/icu/es-PA/index.html)
- [UNECE Rec. 20, lista de códigos rev. 11e](https://docs.peppol.eu/poacc/upgrade-3/codelist/UNECERec20/)
- [Adyen, elegibilidad para SAQ A](https://docs.adyen.com/development-resources/pci-dss-compliance-guide/saq-a-eligibility) · [Akamai, cambios de PCI DSS v4.0.1 para SAQ A](https://www.akamai.com/blog/security/pci-dss-v4-0-1-changes-qualify-saq-a)

No se pudo leer: la página de GS1 con el cálculo del dígito de control y la tabla de prefijos por país (acceso denegado); los textos de ISO 20022 e ISO 18245; el texto de EMVCo (se usó la especificación derivada).
