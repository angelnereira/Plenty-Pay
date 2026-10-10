# Preguntas abiertas

Decisiones que **no** puede tomar un agente de código: requieren negocio, legal, un proveedor o credenciales. Cada una indica qué bloquea y qué hacer mientras tanto. **BLOQUEANTE** = el paso indicado no puede cerrarse sin respuesta; los demás pasos avanzan con el supuesto declarado (y el supuesto se marca en código con un comentario `// Q-xx`).

Cuando una pregunta se responde: registrar la respuesta, fecha y fuente aquí, actualizar el documento afectado (SPEC/dominio/ADR) en el mismo cambio y mover la fila a "Resueltas".

| Id | Pregunta | Afecta | Bloquea | Supuesto mientras tanto | Dueño sugerido |
|---|---|---|---|---|---|
| **Q-01** | ¿Qué licencia/registro exige la Superintendencia de Bancos de Panamá para custodiar saldos de billetera (emisor de dinero electrónico / entidad de pagos), límites por usuario, segregación en cuenta fiduciaria y reportes? | ledger, payments-core, settlement, domain-model §10 | **BLOQUEANTE** F30.3 (dinero real) | Límites conservadores (saldo ≤ 5 000 USD, cobro ≤ 10 000 USD); wallet solo en sandbox/piloto | Legal + dirección |
| **Q-02** | Especificaciones técnicas y contratos de Yappy (Banco General) y TELERED (ACH Xpress / Clave): APIs, firmas de webhook, ambientes, certificación | payments-core adaptadores | **BLOQUEANTE** F23 (riel real) y F30.3 | Adaptadores sandbox con el trait `RailAdapter`; flags `rail.yappy.enabled=false` | Negocio (alianzas) |
| **Q-03** | PSP para tarjetas Visa/Mastercard, Apple Pay y Google Pay (tokenización, SAQ A) y, si se quiere, Tap to Pay en el teléfono (requiere SDK certificado del PSP) | payments-core, flutter_app | **BLOQUEANTE** F23.6 | Rieles CARD/APPLE_PAY/GOOGLE_PAY ocultos por flag; sin lectura EMV | Negocio + seguridad |
| **Q-04** | Requisitos KYB exactos para comercios (documentos, verificación de representante legal, listas restrictivas/AML) | identity, flujo F2 | F08.5 (campos finales), F28.7 | Documentos: RUC, aviso de operación, cédula del representante, cuenta bancaria; revisión manual por plataforma | Cumplimiento |
| **Q-05** | ¿Existe/aplica un estándar de QR interoperable en Panamá (EMVCo merchant-presented) que debamos soportar? | payments-core, flutter_app | F23 (riel QR_INTEROP) | QR propio con URL `https://<host>/t/<code>` | Negocio |
| **Q-06** | En reembolsos, ¿cada riel devuelve su comisión? (campo `rail_fee_refundable` por política) | fee engine, T7 | — | `false` (el comercio asume la comisión del riel) | Finanzas |
| **Q-07** | ¿Aplica ITBMS sobre la comisión de plataforma y a qué tasa? ¿PlentyPay factura sus comisiones mensualmente o por transacción? | fee engine, fiscal F13.8 | F13.8 | ITBMS 7 % sobre la comisión (vector A); factura mensual | Contabilidad/fiscal |
| **Q-08** | Plazos de retención de datos y de notificación de incidentes (Ley 81 de 2019 y normas sectoriales), textos de privacidad y consentimientos (biometría) | data-standards §8, security §13, F25.4 | F25.4, F30 | Retenciones de `data-standards.md` §8; consentimiento explícito para biometría | Legal |
| **Q-09** | ¿Proveedor de verificación de identidad (prueba de vida, OCR de cédula) para usuarios con límites altos? | identity | F28 (si se exige) | Sin verificación automática; límites bajos | Cumplimiento |
| **Q-10** | Conector bancario para pagar a comercios (ACH Xpress vía banco aliado, archivo de lote, API) | settlement | F12 en real; F30.3 | `ConfirmPayout` manual por plataforma con referencia bancaria | Finanzas + negocio |
| **Q-11** | PAC elegido y reglas vigentes del SFEP: formato, plazos de transmisión, manejo de rechazos y numeración, límite de consumidor final sin identificar, tasas ITBMS válidas | fiscal-invoicing | **BLOQUEANTE** F30.3 para facturación real | Simulador de PAC; tasas 0/7/10/15 %; adaptador `generic` | Fiscal |
| **Q-12** | Modelos de impresoras, cajones, lectores y pantallas de cliente a soportar oficialmente | flutter_app F24 | F24.1 | Impresoras ESC/POS de red 80 mm genéricas | Operaciones |
| **Q-13** | Valores legales de nómina vigentes (CSS, Seguro Educativo, ISR por tramos, recargos de horas extra por tipo, décimo tercer mes, vacaciones) | payroll R5 | F19.5 para nómina real | Tasas configurables por tenant con valores de ejemplo marcados "no legales" | Contabilidad laboral |
| **Q-14** | Contrato y API de Jelou (WhatsApp) y proveedor de SMS en Panamá | notifications | F20.7 | Modo log | Negocio |
| **Q-15** | ¿Se usará un modelo de lenguaje self-hosted para preguntas en lenguaje natural (analytics R6) y cuál (licencia OSS, hardware)? | analytics-bi | — | Parser por reglas en español sobre el catálogo de métricas | Producto + infraestructura |
| **Q-16** | Proveedor de nube para DR y región (latencia a Panamá) | infra F26 | F26.3 | Módulo GCP primero (orden indiferente por contrato de módulo) | Dirección técnica |
| **Q-17** | ¿Bajo qué licencia de código abierto se publica PlentyPay (Apache-2.0, AGPL-3.0, MPL-2.0…)? Afecta a la estrategia comercial y a contribuciones externas | raíz (`LICENSE`), F01.7 | F01.7 | Repositorio privado sin `LICENSE` hasta decidir; todas las dependencias deben ser OSI-compatibles con cualquiera de las opciones | Dirección |

## Resueltas
_(ninguna todavía)_
