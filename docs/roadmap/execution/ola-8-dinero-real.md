# Ola 8 · Dinero real

**Qué cierra**: PlentyPay mueve dinero real con rieles certificados, factura con un PAC real y opera bajo los controles regulatorios. Etapas M0, M6, M8 y la validación legal de todo lo anterior ([`../lifecycles.md`](../lifecycles.md)). **Casi todo está bloqueado por decisiones y credenciales del dueño**: un agente prepara mecanismos y documentos, nunca simula dinero real (AGENTS §2.12) ni completa valores legales de memoria (AGENTS §7).

## 1. Decisiones que destraban esta ola (de `open-questions.md`)

| Q | Qué decide | Destraba | Quién |
|---|---|---|---|
| Q-01 | Figura regulatoria (dinero electrónico, SBP) | todo M0–M2 con dinero real | legal |
| Q-02 | Contratos y especificaciones de Yappy y ACH/Clave | rieles reales, extractos reales (F12.5) | negocio + bancos |
| Q-03 | PSP de tarjetas, Apple Pay, Google Pay | F23.6, aceptación 4 de pos con tarjeta | negocio |
| Q-10 | Conector bancario para pagar a comercios | T6 bancario (F12.4) | negocio + banco |
| Q-11 | PAC y reglas vigentes del SFEP | factura válida (F13, F30.3) | negocio + contador |
| Q-53 | Dominio público para `/t/<código>` | F23.5, QR leídos con la cámara | dueño |
| Q-55 | ¿PlentyPay registra/paga deudas del comercio con proveedores? | P1/M6 de compras | producto |
| Q-56 | Remesa del ITBMS cobrado sobre comisiones (plantilla y periodicidad) | M8 | contador + legal |

## 2. Pasos

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 1 | [F11.8](#f118--webhooks-con-firma) Webhooks con firma | payments-core, gateway | L4 | — | adaptador del riel (Q-02) |
| 2 | [F23.3–F23.4](#f233f234--biometría-step-up-y-pantalla-confirmando) Biometría, step-up y «confirmando» | flutter_app, identity | L4 | — | — |
| 3 | [F23.2](#f232--nfc) NFC | flutter_app | L4 | — | tag físico |
| 4 | [F23.5](#f235--enlaces-de-pago-tcódigo) Enlaces de pago `/t/<código>` | web | L4 | — | Q-53 |
| 5 | [F23.6](#f236--apple-pay--google-pay) Apple Pay / Google Pay | flutter_app, payments-core | L4 | — | Q-03 |
| 6 | [M8 · Remesa del ITBMS](#m8--remesa-del-itbms-de-la-plataforma) | ledger, settlement | L2 | F13.8 | Q-56 |
| 7 | [F13.8](#f138--factura-de-comisiones-de-plentypay) Factura de comisiones | fiscal-invoicing, ledger | L4 | F13.5 | Q-11 para validez |
| 8 | [F28](#f28--seguridad-avanzada-y-cumplimiento) Seguridad avanzada y cumplimiento | varios | L0–L5 | F27 | Q-01, Q-04, Q-08 |
| 9 | [F30.3](#f303--credenciales-reales-y-pruebas-en-vivo-controladas) Credenciales reales y pruebas en vivo | payments-core, fiscal-invoicing | L5 | F28 | Q-02, Q-03, Q-11 |

---

### F11.8 · Webhooks con firma
Nivel L4 · Estado 📋 (reabierto: el código anterior era *fail-open*; hoy `HandleRailWebhook` rechaza todo, fail-closed).
- **Resultado observable**: un webhook del riel con firma válida cambia el estado del pago una vez; duplicados sin efecto; firma inválida o ausente → 401 y registro.
- **Código**: verificación de firma por adaptador (HMAC o asimétrica según el riel), secreto en security (nunca en código ni imagen), ventana de tiempo anti-repetición, idempotencia por id de evento del riel; ruta pública en el gateway con rate limit.
- **Bloqueo**: sin especificación del riel (Q-02) no hay formato de firma: mantener fail-closed. Se puede construir el mecanismo genérico con el riel sandbox (`SandboxRail`) y su firma de prueba.
- **Pruebas**: Rust `f11_8_duplicate_webhook_five_times_one_change` (aceptación 3), `f11_8_invalid_signature_is_401`, `f11_8_missing_signature_is_401`.
- **Terminado cuando**: «Duplicados sin efecto; firma inválida 401» (05).

### F23.3–F23.4 · Biometría, step-up y pantalla «confirmando»
Nivel L4 · Estado 📝.
- **F23.3**: integrar `local_auth` con el diálogo de step-up del servidor (S-GEN-21): un pago ≥ umbral (valor de configuración, no legal) exige step-up; la biometría desbloquea el factor local, la verificación es del servidor (ADR 0020). Hoy `StepUpDialog` valida el PIN en local (F08.8 e): corregir en este paso.
- **F23.4**: `ConfirmingPaymentScreen` con datos reales: UNKNOWN/PENDING muestran «Estamos confirmando tu pago» y la app consulta o recibe por WebSocket (`payment.status`) el estado final; nunca «falló» en UNKNOWN; aviso final por notifications.
- **Pruebas**: widget `test('F23.4 UNKNOWN nunca muestra falló', ...)`; L4 con el riel sandbox forzado a timeout.
- **Terminado cuando**: «Pago ≥ umbral exige step-up» y «Nunca muestra 'falló' en UNKNOWN» (05).

### F23.2 · NFC
Nivel L4 · Estado 📝 (lectura/escritura NDEF con L1). Falta probar con un **tag físico** en el Pixel (lista de dispositivos en status). No se emula tarjeta (HCE) ni se lee EMV (`security-standards.md` §9). Terminado cuando: «Probado en dispositivos físicos» (05).

### F23.5 · Enlaces de pago `/t/<código>`
Nivel L4 · **Bloqueo** Q-53 (dominio no registrado). El handler de `web` que valida el código con el regex y consulta al gateway puede construirse y probarse en L2 local; la L4 («abre app o tiendas») espera el dominio y los App Links.

### F23.6 · Apple Pay / Google Pay
Nivel L4 · **Bloqueo** Q-03. El adaptador queda oculto por bandera hasta tener credenciales del PSP. PlentyPay nunca ve datos de tarjeta (N-STD-28/29).

### M8 · Remesa del ITBMS de la plataforma
Nivel L2 · **Bloqueo** Q-56.
- **Problema**: `TAX_PAYABLE` (ITBMS cobrado sobre las comisiones de PlentyPay) solo crece: no hay plantilla de asiento para su pago a la DGI.
- **Qué hace un agente**: nada en código. Prepara la propuesta para la decisión: plantilla candidata `D TAX_PAYABLE x · C BANK_CASH x` con clave `taxremit:<período>`, periodicidad (mensual, día 15 del mes siguiente según la norma que se confirme) y reporte del período que cuadra con F13.8. La plantilla se agrega a `domain-model.md` §5.2 **solo** cuando Q-56 se responda.

### F13.8 · Factura de comisiones de PlentyPay
Nivel L4 · Estado 📝 (reabierto).
- **Resultado observable**: una factura mensual por comercio, emitida por PlentyPay, con total = comisiones del período en el ledger (`PLATFORM_FEES` + `TAX_PAYABLE` de ese comercio).
- **Código**: job mensual en fiscal-invoicing que consulta al ledger las comisiones por comercio (o un agregado de settlement) y emite con `tenant = PLATFORM`; idempotente por `(comercio, período)`.
- **Pruebas**: L2 cruzado `TestF13_8_MonthlyFeeInvoiceEqualsLedgerFees`.
- **Terminado cuando**: «Factura mensual por tenant con total = comisiones del ledger» (05); validez fiscal real espera Q-11.

### F28 · Seguridad avanzada y cumplimiento
Pasos F28.1–F28.8 de 05 (EdDSA + JWKS, passkeys, pinning y FLAG_SECURE, unseal productivo de OpenBao, SAST/DAST, pentest externo, matriz de cumplimiento SBP/DGI/PCI SAQ A/Ley 81, SSO de consolas). Depende de F27 (Kubernetes). **F28.7** es la puerta legal de todo lo marcado ◐/⚠ en `docs/compliance/`: ningún paso que dependa de esas reglas habilita dinero, nómina o facturación reales hasta su validación (AGENTS §8).

### F30.3 · Credenciales reales y pruebas en vivo controladas
Nivel L5 · Depende de F28 y de Q-02, Q-03, Q-11. Transacciones reales de **bajo monto**, conciliadas de punta a punta (M0 → M5 → M6) y facturadas con el PAC real, con el dueño presente. Ningún agente ejecuta este paso solo.
