# Estado real de la migración — léelo antes de desplegar nada

Pediste "el zip ya migrado y listo para configurar variables de entorno, y
listo para desplegar y ofrecer el servicio". Lo primero es cierto: aquí hay
código real, no solo documentación. Lo segundo — "listo para desplegar y
ofrecer el servicio" — **no lo es todavía, y no por falta de esfuerzo**: hay
piezas que ningún código puede completar (una relación comercial con Banco
General/Yappy, un registro ante la Superintendencia de Bancos, una
certificación PCI de un PSP) porque no son problemas de ingeniería. Este
documento dice exactamente dónde está la línea, para que no la cruces sin
saberlo.

## 1. Cómo se verificó cada pieza (y cómo no)

El entorno donde se generó este código no tenía Docker, no tenía SDK de
Flutter, y tenía la red restringida a un puñado de dominios (registries de
npm/pip/cargo, GitHub — nada más). Eso limitó qué se pudo comprobar de verdad:

| Pieza | Cómo se verificó | Confianza |
|---|---|---|
| `web/prisma/schema.prisma` (Prisma) | Balance de llaves `{}` a mano; **no** se pudo correr `prisma validate` (el motor de Prisma se descarga de `binaries.prisma.sh`, no está en la lista blanca de red) | Media — corre `npx prisma validate` tú mismo, primer paso |
| Migración SQL (triggers, checks, índices) | **Ejecutada contra PostgreSQL real** (PGlite/WASM, no un mock) — `scripts/ledger-tests`, 27 casos: balance, inmutabilidad, moneda/tenant, exactly-once, reversos | **Alta** — es la pieza más verificada de todo el repo |
| `services/payments-orchestrator`, `services/wallet-ledger` | `tsc --noEmit` limpio (los únicos errores que quedan son por no poder correr `prisma generate`, no por bugs) | Alta — y el propio proceso encontró y corrigió un bug real (ver §3) |
| `services/mcp-server` | `tsc --noEmit` limpio — **y** se descubrió y corrigió un problema real de rendimiento (ver §3) | Alta |
| Rutas nuevas de `web/app/api/**` | Tipado verificado en aislamiento contra los tipos reales de Next/jose/bcryptjs/grpc (no contra el proyecto completo — sería más lento sin más señal) | Media-alta |
| `plentypay_mobile/` (Flutter/Dart) | **Ninguna** — no había SDK de Flutter en el entorno. Se escribió a mano con cuidado y se verificó la API de `nfc_manager`/`ndef_record` contra su documentación real, pero nunca se corrió `flutter analyze` | **Baja — este es el bloque menos verificado de todo el repo** |
| `infra/k8s/*.yaml` | Cada archivo se parseó como YAML válido (`yaml.safe_load_all`) | Media — válido como YAML; no se aplicó contra un clúster real |
| `infra/terraform/*.tf` | Revisado a mano; **no** se pudo correr `tofu validate` (el binario no se pudo descargar) — se encontró y corrigió a mano una sintaxis HCL inválida (punto y coma donde debía ir un salto de línea) | Baja-media — corre `tofu validate` tú mismo antes de aplicar nada |

## 2. Qué es real, qué es simulado, qué no existe

| Componente | Estado |
|---|---|
| Rebrand completo de marca (código, branding, `.env`, sin referencias al sistema de origen) | ✅ Real |
| Payment Core (`PaymentIntent`/`Payment`/`PaymentAttempt`) | ✅ Real — lógica, idempotencia, estado `UNKNOWN` |
| Ledger de doble entrada + invariantes en base de datos | ✅ Real — probado contra Postgres real |
| Wallet (saldo disponible/retenido) con bloqueo optimista | ✅ Real |
| Adaptadores Yappy / TELERED / tarjetas | ⚠️ **Simulados a propósito** — sin credenciales reales (no existen, no son públicas), responden en modo sandbox para que el resto se pueda probar. Cero dinero real se mueve. |
| Pago por QR y por tag NFC (iniciar un cobro) | ✅ Real (backend + Flutter) — pero corre sobre los adaptadores simulados de arriba |
| Aceptar el "tap" de una tarjeta física (Tap to Pay/SoftPOS) | ❌ No existe — requiere el SDK de un PSP certificado, no es algo que se pueda programar sin él (documento 03, §2) |
| Apple Wallet / Google Wallet (pases de fidelidad) | ❌ No implementado en este pase — quedó como botón sin acción en la wallet screen |
| Servidor MCP | ✅ Real — 4 tools funcionales sobre los servicios de arriba |
| App Flutter | ⚠️ Fundación real (auth, wallet, catálogo, pagos QR/NFC) — **no** cubre las 94 pantallas del monolito web, ni se compiló nunca |
| Infraestructura Kubernetes | ⚠️ Manifiestos completos y sintácticamente válidos — nunca aplicados a un clúster real |
| Cumplimiento SBP / registro como Emisor de Dinero Electrónico | ❌ No existe — es un proceso legal/regulatorio real, no de código (documento 03, §9) |

## 3. Brechas de diseño reales encontradas durante la construcción

Cada una está también comentada en el archivo exacto donde vive — esta es la
lista consolidada para no tener que ir a buscarlas una por una:

1. **User ↔ MotorEntity**: no existe un mapeo formal entre una cuenta de login
   (`User`) y la parte que tiene wallet (`MotorEntity`). `app/api/mobile/v1/wallet/balance/route.ts`
   usa `User.id` como si fuera `MotorEntity.id` — funciona para que el endpoint
   sea ejecutable, pero hay que diseñar el mapeo real antes de producción.
2. **`ApiKey.key` en texto plano**: `app/api/public/v1/products/search/route.ts`
   compara la API key directo contra la columna — hay que migrarlo a comparar
   un hash, igual que ya se hace con las credenciales HKA.
3. **Sentry org slug**: el rebrand renombró automáticamente `org: "plentypay-app"`
   en `next.config.js` — confírmalo contra tu cuenta real de Sentry o los
   source maps no subirán (no rompe la app, solo el tracking de errores).
4. **Variables de almacenamiento de objetos**: no se encontró en el código
   revisado un uso directo de `process.env.AWS_*`/`S3_*` a pesar de que el
   proyecto trae esos SDKs como dependencia — antes de configurar MinIO,
   confirma dónde se sube cada archivo realmente (ver `web/.env.example`).
5. **Reconciliación de estado `UNKNOWN`**: cuando un adaptador de riel hace
   timeout, el pago queda `UNKNOWN` (a propósito — nunca `FAILED` prematuro,
   documento 03 §8) pero el job que lo resuelve contra el riel externo o el
   webhook **no está construido**. Un `UNKNOWN` sin resolver se queda así.
6. **`MAX_AMOUNT_CENTS` en `app/api/mobile/v1/payments/route.ts`**: el límite
   de $5,000 por operación es un valor de arranque razonable, no uno
   calibrado con Riesgo/Cumplimiento — ajústalo con datos reales.
7. **Certificate pinning**: `plentypay_mobile/lib/core/network/api_client.dart`
   tiene el punto exacto marcado pero sin pin real — no existe el certificado
   de producción todavía.
8. **`MotorLedgerEntry` (créditos/lealtad) vs. el Ledger nuevo**: son dos
   sistemas contables separados a propósito (documento 03 §10) — el primero
   sigue sirviendo su propósito original sin cambios; el segundo es la verdad
   financiera de pagos reales. No se migró uno al otro.

## 4. Antes de "listo para desplegar y ofrecer el servicio" — checklist real

**Negocio / legal (nada de esto lo resuelve código):**
- [ ] Alta como comercio en Yappy Comercios (Banco General) y credenciales reales
- [ ] Acuerdo con TELERED o un banco patrocinador para ACH Xpress / Tarjeta Clave
- [ ] Contrato con un PSP/adquirente certificado para Visa/Mastercard/Apple Pay/Google Pay
- [ ] Asesoría legal panameña: registro ante la SBP como Emisor de Medios de Pago
      y Dinero Electrónico (Ley 23/2015, Art. 22.1.g — documento 03 §9); si el
      módulo de créditos evoluciona a préstamo real, análisis regulatorio aparte

**Seguridad (antes de mover dinero real):**
- [ ] Certificate pinning real en la app (necesita el certificado de producción)
- [ ] Migrar `ApiKey.key` y llaves de cifrado a comparación por hash / HSM-KMS real
- [ ] Auditoría de seguridad / pentest independiente
- [ ] Confirmar alcance PCI-DSS real con el PSP elegido

**Ingeniería (código que sí falta escribir):**
- [ ] Job de reconciliación para pagos en estado `UNKNOWN`
- [ ] Mapeo User ↔ MotorEntity
- [ ] Resto de las pantallas Flutter (esto cubre auth/wallet/catálogo/pagos, no las 94 del web)
- [ ] `flutter analyze` / `flutter test` reales (nunca se corrieron)
- [ ] `tofu validate` / `tofu plan` reales sobre un clúster de verdad
- [ ] Apple Wallet / Google Wallet (pases) — quedó fuera de este pase

**Antes de escala real:**
- [ ] Prueba de carga con el modelo de dimensionamiento del documento 02 §2
- [ ] Simulacro de failover de Postgres (documento 02 §12)

## 5. Próximos pasos recomendados, en orden

1. `cd scripts/ledger-tests && npm install && npm test` — confirma tú mismo que el ledger balancea.
2. `npx prisma validate` en `web/` con red sin restricciones.
3. Levantar `docker compose up` localmente y probar un pago de punta a punta (va a responder "sandbox": true — es lo esperado).
4. Elegir UN PSP de tarjetas y arrancar esa integración real primero (es la que más desbloquea).
5. En paralelo, la conversación con un abogado de fintech panameño sobre el registro SBP — tarda meses, así que cuanto antes empiece, mejor.
