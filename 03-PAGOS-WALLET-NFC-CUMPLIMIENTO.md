# Pagos, Wallet, NFC e Integraciones para PlentyPay

> **Documento de contexto (serie 00–04).** Recoge el análisis y el razonamiento previos a las decisiones vigentes. Donde contradiga un ADR (`docs/adr/`), `docs/domain/domain-model.md`, `docs/standards/` o un `SPEC.md`, **prevalecen esos** (ADR 0010). En particular: el stack definitivo es solo Rust + Go + Flutter (ADR 0001) — cualquier mención a TypeScript/Next.js/Prisma aquí es histórica.

> Este es el documento más sensible de la serie: mezcla ingeniería con regulación financiera real de Panamá. No es asesoría legal — es la información técnica y regulatoria que necesitas para hablar con un abogado especializado en fintech panameño sabiendo exactamente qué preguntar.

## 1. El modelo mental correcto: orquestador sobre rieles existentes

El error más caro que puedes cometer es intentar **reconstruir** Visa, Mastercard, Yappy o TELERED. Nadie hace eso. Lo que hacen las fintech panameñas exitosas (Zinli, Kuara, Tip Tap) es **integrarse como comercio/emisor autorizado sobre la infraestructura bancaria que ya existe**, no competir con ella. El contexto de mercado 2026 confirma que esta es exactamente la dirección: la Cámara Fintech de Panamá reportó más de 145 fintech operando en el país con un crecimiento superior al 140% en afiliados durante 2026, en un entorno donde la propia Superintendencia de Bancos está empujando más interoperabilidad entre billeteras — el espacio que se abre es para plataformas que trabajan **sobre** los rieles existentes, no en competencia frontal con ellos. PlentyPay debería posicionarse igual: capa de experiencia + orquestación, no reinvención de infraestructura de pagos.

## 2. NFC: son dos features completamente distintas — sepáralas

| | Emitir pases NFC/Wallet (loyalty, recibos, cupones) | Aceptar pagos NFC contactless (ser el "POS") |
|---|---|---|
| Tecnología | Apple Wallet (PassKit, `.pkpass`) / Google Wallet API | Tap to Pay / SoftPOS (kernel EMV Contactless) |
| ¿Se construye internamente? | **Sí**, directo — cuenta de desarrollador Apple + certificado Pass Type ID, y API de Google Wallet | **No** — requiere un PSP/adquirente ya certificado por Visa/Mastercard (ej. vía su SDK Tap to Pay) |
| Certificación de marca requerida | No | Sí, y la tiene el PSP, no tú |
| Esfuerzo | Semanas | Se integra el SDK del PSP; construir el kernel EMV desde cero son años y millones de dólares — nadie fuera de Visa/Mastercard/PSPs grandes lo hace |
| Encaja con | Tarjeta de fidelidad PlentyPay, recibo digital, cupón de marketplace | POS físico de comercios PlentyPay aceptando tarjetas de clientes |

**Recomendación concreta**: construye pases de Apple/Google Wallet tú mismo desde el inicio (bajo esfuerzo, alto valor — reemplaza el recibo PDF actual por algo interactivo en el wallet del cliente). Para aceptar NFC contactless en el POS, integra el SDK Tap to Pay de un PSP/adquirente (confirma cobertura en Panamá con ellos primero — la disponibilidad por país cambia).

Una tercera variante — que tu propia app **emita** una tarjeta virtual que el usuario pueda usar tocando el teléfono en *otros* comercios (HCE como emisor) — solo es posible si te asocias con un procesador/banco patrocinador que soporte tokenización de marca (Visa Token Service / Mastercard Digital Enablement Service). Es la misma tecnología detrás de "agregar tarjeta al teléfono" en la app de cualquier banco.

## 3. Apple Pay, Google Pay, Google Wallet, Visa, Mastercard: el patrón de integración real

Ninguno de estos se "integra" como una librería aislada de pagos propia. El patrón estándar de la industria:

1. Te asocias con un **adquirente/PSP** (procesador de pagos) que ya está habilitado con Visa/Mastercard y soporta Apple Pay/Google Pay como método de pago en su SDK.
2. El SDK del PSP muestra el botón "Pagar con Apple Pay / Google Pay". Cuando el usuario confirma, el **token** (nunca el PAN real) viaja del dispositivo → red de la marca (Visa/Mastercard tokeniza) → PSP → tu backend.
3. Tu backend **nunca ve ni almacena el número de tarjeta real** — solo un token y el resultado (aprobado/rechazado). Esto es lo que mantiene tu infraestructura fuera del alcance PCI-DSS pesado (ver documento 02, sección 11).
4. Google Pay **ya está habilitado en Panamá** desde hace un par de años vía varios bancos locales para pagos sin contacto — esto valida que el ecosistema ya está listo para que PlentyPay lo ofrezca como método de pago del lado comercio también.

## 4. Ecosistema panameño real (lo que hay que integrar de verdad)

| Rail | Qué es | Cómo se integra típicamente |
|---|---|---|
| **Yappy** | Billetera de Banco General, ~1.5M usuarios y 25,000+ comercios, con interoperabilidad ya activa hacia clientes de Caja de Ahorro, Banisi, Credicorp Bank, Davivienda y St. Georges Bank | Alta como comercio afiliado a Yappy Comercios; API de cobro (botón de pago / QR) |
| **TELERED** | La "autopista transaccional" de Panamá: opera **ACH Xpress** (transferencias interbancarias instantáneas por número de celular) y la red de **Tarjeta Clave** (débito interbancario, evolucionando hacia pagos sin contacto). Es el punto donde confluyen bancos, facturadores y comercios | Integración como comercio/facturador vía TELERED directamente o a través de tu banco patrocinador |
| **"Clave"** | No es una app aparte — es la marca de la tarjeta de débito interbancaria que opera TELERED | Se acepta como cualquier tarjeta de débito local vía tu adquirente |
| **Nequi (Panamá)** | Billetera de Banistmo (grupo Bancolombia) — marca compartida con el Nequi colombiano pero es una operación panameña separada | Vía acuerdo comercial con Banistmo |
| **Zinli, Kuara** | Otras billeteras interoperables (Banco Mercantil; y Global Bank+Banesco+MMG respectivamente) | Mismo patrón: alta como comercio/afiliado |

**Implicación de arquitectura**: tu `payments-orchestrator` (documento 02) necesita un adaptador por riel (patrón que ya usas para HKA con el patrón *Adapter* — reutiliza exactamente esa idea), de forma que agregar Nequi o Kuara después sea añadir un adaptador, no reescribir el core.

## 5. ORDS y la pregunta de Oracle

**ORDS (Oracle REST Data Services)** expone una base de datos Oracle como API REST — es la pieza que usarías **solo si** un banco patrocinador o una entidad gubernamental con la que necesites integrarte corre su núcleo en Oracle y expone sus servicios así (algo común en banca panameña). Esto **no significa migrar PlentyPay a Oracle** — tu stack sigue siendo PostgreSQL (documento 02); ORDS sería simplemente el protocolo con el que hablas hacia afuera cuando el otro lado lo expone así. Dado que ya exploraste Oracle Cloud a fondo, esto encaja de forma natural sin contradecir el resto de la arquitectura.

## 6. Jelou: capa conversacional sobre WhatsApp

Jelou es una plataforma ecuatoriana (operando en 13 países) que permite ejecutar pagos, verificación de identidad y flujos transaccionales completos **dentro de WhatsApp** mediante agentes de IA ("Brain OS"), y ya trabaja con bancos y comercios en la región. Esto conecta directamente con algo que **ya existe en la plataforma**: el addon `whatsapp` ($19/mes) que hoy solo envía comprobantes y notificaciones de forma unidireccional. Con Jelou (o un competidor equivalente), ese addon evoluciona a: "revisa tu saldo por WhatsApp", "paga este link sin salir del chat", "recibe soporte conversacional" — construyendo sobre una relación comercial que tu producto ya factura.

## 7. GPS: casos de uso concretos

- **Antifraude**: si una transacción POS/NFC ocurre en una ubicación muy distinta a la habitual del comercio, márcala para revisión (geofencing simple, alto valor).
- **Marketplace**: descubrimiento "cerca de mí" para el catálogo multi-tienda (documento 04).
- **Logística**: ya existe la infraestructura de `Carrier`/`Driver`/`DeliveryOrder` — solo falta el stream de ubicación en vivo, que es una extensión natural, no un módulo nuevo.

## 8. Seguridad de "nivel bancario": lo que ya tienes vs. lo que falta

| Control | Estado |
|---|---|
| Cifrado en reposo (AES-256) | ✅ Ya existe para credenciales HKA — extender el mismo patrón a datos de wallet |
| WebAuthn/passkeys | ✅ Ya integrado (`@simplewebauthn`) — úsalo para confirmar pagos de alto valor, no solo login |
| Rate limiting | ✅ Ya existe (Upstash) — reutilizar para *velocity checks* de pagos |
| Auditoría insert-only | ✅ Ya existe el patrón (`DataExchangeRecord`, `MotorLedgerEntry` con reversos) — aplicar el mismo principio a toda tabla de transacciones nuevas |
| Tokenización de tarjetas (nunca PAN propio) | ❌ Nuevo — se resuelve delegando la captura al PSP (sección 3) |
| HSM/KMS real para llaves críticas | ⚠️ Hoy son variables de entorno cifradas — para "nivel bancario" real, mover a un HSM/KMS gestionado o OpenBao con backend de HSM |
| 3-D Secure 2.x | ❌ Nuevo, lo aporta el PSP |
| Detección jailbreak/root + certificate pinning | ❌ Nuevo (documento 04, específico de Flutter) |

## 9. Cumplimiento: DGI (ya lo tienes) + Superintendencia de Bancos (nuevo)

**DGI**: sin cambios — el motor HKA ya cumple. Solo hay que decidir cuándo un movimiento de wallet genera o no un documento fiscal (reutilizando `CheckoutPreference`, ver documento 01).

**Superintendencia de Bancos de Panamá (SBP) — esto es lo importante y lo bueno**: Panamá **no exige convertirte en banco** para emitir dinero electrónico o instrumentos de pago. La Ley No. 23 del 27 de abril de 2015 (prevención de blanqueo de capitales, financiamiento del terrorismo y de la proliferación de armas de destrucción masiva), en su artículo 22, numeral 1, literal "g", establece que las entidades emisoras de medios de pago y dinero electrónico son supervisadas por la SBP **exclusivamente en materia de prevención de blanqueo de capitales y financiamiento del terrorismo**, registrándose como "Sujeto Obligado Financiero" bajo la figura de **Emisor de Medios de Pago y Dinero Electrónico** (desarrollado vía el Acuerdo Bancario No. 5-2015). La SBP define el dinero electrónico como valor monetario prepagado, almacenado electrónicamente, emitido contra la recepción de fondos por un monto no menor al valor emitido, aceptado como medio de pago por terceros distintos del emisor.

**Esto no es teórico**: revisando resoluciones públicas de la SBP se confirma que empresas como MFTECH S.A. (nombre comercial **Zinli**), Soluciones Biométricas S.A. (nombre comercial **Tip Tap**), Punto Pago Panamá S.A., Localpayment PAN S.A. y otras **ya pasaron por este registro** — es un camino transitado, no una teoría.

Puntos que un abogado especializado en regulación financiera panameña debe confirmarte antes de escribir una sola línea de código de producción de pagos:
- El proceso y requisitos exactos de registro como Emisor de Medios de Pago y Dinero Electrónico (capital, garantías, programa de cumplimiento AML/CFT).
- Si el módulo `creditos` (que hoy ya otorga y trackea saldos de crédito a clientes) cruza la línea hacia **crédito/préstamo regulado** una vez que PlentyPay maneja dinero electrónico real — esto probablemente es un régimen distinto al de emisión de dinero electrónico y necesita análisis separado.
- Si planeas ofrecer el POS/checkout a *otros* comercios (modelo marketplace, documento 04), qué figura regulatoria aplica al flujo de fondos entre comprador → PlentyPay → comercio (esto suele requerir figura de "facilitador de pagos" o similar, coordinado con tu banco patrocinador/adquirente).
- Requisitos de retención y reporte (KYC/KYB) para dar de alta comercios en el marketplace.

## 10. Qué le falta al `MotorLedgerEntry` para ser un wallet real

Ya tienes el 60% (documento 01, sección 6). Para completar el otro 40%:

1. **Estados de retención** (`HOLD` → `CAPTURED` / `RELEASED`) — hoy todo movimiento es inmediato; un marketplace necesita retener el pago del comprador hasta confirmar la entrega.
2. **Entidad `Wallet` explícita** con saldo disponible vs. saldo retenido vs. pendiente de liquidación (hoy `MotorEntity` + `runningBalanceCents` asume un solo saldo).
3. **Idempotencia a nivel de fila**: constraint único sobre una referencia externa de idempotencia, para que un webhook duplicado de Yappy/TELERED/PSP nunca genere dos `MotorLedgerEntry`.
4. **Liquidación (settlement) multi-tenant**: para el modelo marketplace, PlentyPay cobra comisión y liquida el resto al comercio — necesitas un concepto de "lote de liquidación" que hoy no existe.
5. Revisar el default de `currency = "PAB"`: la economía panameña opera en la práctica en USD; vale la pena confirmar que el default y las conversiones reflejen eso.

Con estos cinco cambios, el ledger que ya construiste para créditos y lealtad se convierte, sin rediseño desde cero, en el corazón contable de PlentyPay.
