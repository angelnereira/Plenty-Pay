# Pantallas transversales

Acceso, inicio, cuenta, privacidad, verificación de identidad y alta de negocio. Convenciones y comportamiento común: [`README.md`](README.md) §2–§4.

## Acceso

### S-GEN-01 · `/welcome` · Bienvenida
Sin sesión · Paso F02.6 · Datos: `GET /v1/client-config`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Logo | PlentyPay | Centrado, tercio superior |
| e2 | Texto `headline` | Vende, cobra y paga en un solo lugar. | — |
| e3 | `PPButton.primary` | Crear cuenta | Navega a S-GEN-03 |
| e4 | `PPButton.secondary` | Ya tengo cuenta | Navega a S-GEN-02 |
| e5 | Selector de idioma | Español · English | Cambia el locale al instante y lo recuerda |
| e6 | Enlaces `caption` | Términos · Privacidad | Abren `/legal/terms` y `/legal/privacy` |

Flujo: si `client-config` indica versión mínima mayor que la instalada → S-GEN-19. Si indica mantenimiento → franja C-11 y los botones siguen activos.

### S-GEN-02 · `/login` · Iniciar sesión
Sin sesión · Paso F02.6 · `POST /v1/auth/login`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Título | Inicia sesión | — |
| e2 | `PPTextField` correo | Correo electrónico | Teclado de correo; se envía en minúsculas y sin espacios (N-FMT-14). Formato inválido: "Escribe un correo válido." |
| e3 | `PPTextField` contraseña | Contraseña | Oculta, con botón de mostrar. Sin validación de longitud aquí (no revelar reglas) |
| e4 | `PPButton.text` | ¿Olvidaste tu contraseña? | Navega a S-GEN-04 |
| e5 | `PPButton.primary` | Entrar | Envía. Éxito: carga `/v1/me` y `/v1/me/permissions` y navega a S-GEN-05 |
| e6 | `PPButton.text` | Crear cuenta | Navega a S-GEN-03 |
| e7 | `PPButton.secondary` | Entrar con huella o rostro | Solo si el registro de capacidades marca `device.passkeys` como soportada. `POST /v1/auth/passkeys/login/begin` sin correo → el sistema muestra las passkeys del dominio → `/finish` → mismo destino que e5 (R30). Si `/begin` responde `PASSKEYS_UNAVAILABLE`, el botón se oculta en esa sesión de la app |

Errores: `INVALID_CREDENTIALS` bajo e3 (mismo texto exista o no el correo; también si la passkey es desconocida o fue revocada). `ACCOUNT_LOCKED`: e5 se deshabilita y muestra cuenta regresiva. Si la persona cancela el diálogo del sistema en e7, el formulario sigue igual, sin mensaje.

### S-GEN-03 · `/register` · Crear cuenta
Sin sesión · Paso F02.6 · `POST /v1/auth/register` · Reglas: N-DAT-02, N-DAT-03, N-DAT-14

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Título | Crea tu cuenta | — |
| e2 | `PPTextField` | Nombre completo | 2–120 caracteres; letras, espacios, guion y apóstrofo |
| e3 | `PPTextField` correo | Correo electrónico | Igual que S-GEN-02 e2 |
| e4 | `PPTextField` contraseña | Contraseña | 12–128 caracteres. Medidor de fortaleza debajo. Rechazo del servidor: "Elige una contraseña menos común." (`WEAK_PASSWORD`) |
| e5 | Texto de ayuda | Usa al menos 12 caracteres. | Se vuelve verde con icono al cumplirse |
| e6 | Casilla | Tengo 18 años o más. | Obligatoria, sin marcar por defecto |
| e7 | Casilla | Acepto los Términos y condiciones. | Obligatoria, sin marcar. "Términos y condiciones" es enlace |
| e8 | Casilla | He leído la Política de privacidad y autorizo el tratamiento de mis datos para crear y operar mi cuenta. | Obligatoria, sin marcar. Enlace a la política |
| e9 | Casilla | Quiero recibir novedades y ofertas. | Opcional, sin marcar. Finalidad separada (mercadeo) |
| e10 | `PPButton.primary` | Crear cuenta | Habilitado con e2–e4 válidos y e6–e8 marcadas |

Flujo: 1) envío; 2) el servidor registra cada aceptación con versión del texto, fecha y dispositivo; 3) sesión iniciada → S-GEN-05 con tarjeta "Verifica tu identidad". Error `EMAIL_TAKEN`: "Ya existe una cuenta con este correo." con enlace "Iniciar sesión".

### S-GEN-04 · `/forgot` y `/reset/:token` · Recuperar contraseña
Sin sesión · Paso F08.7 · `/v1/auth/password/forgot` y `/reset`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Título | Recupera tu contraseña | — |
| e2 | `PPTextField` correo | Correo electrónico | Igual que S-GEN-02 e2 |
| e3 | `PPButton.primary` | Enviar enlace | Siempre responde: "Si el correo está registrado, te enviamos un enlace. Vence en 30 minutos." |
| e4 | (en `/reset`) `PPTextField` | Nueva contraseña | Reglas de S-GEN-03 e4 |
| e5 | (en `/reset`) `PPButton.primary` | Guardar contraseña | Éxito: "Contraseña actualizada. Cerramos tus otras sesiones." → S-GEN-02 |

Token vencido o usado: "Este enlace ya no es válido." con botón "Pedir otro".

## Inicio y navegación

### S-GEN-05 · `/` · Inicio
Todos · Paso F02.6; cada fase agrega su tarjeta

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Saludo | Hola, {nombre} | — |
| e2 | Icono campana con contador | — | Navega a S-GEN-06; el contador es el número de avisos sin leer |
| e3 | Tarjeta de pendientes | Verifica tu identidad / Tu negocio está en revisión / Completa tu perfil fiscal | Solo si aplica; una a la vez, por prioridad. Toca → pantalla correspondiente |
| e4 | Tarjeta Billetera | Saldo disponible {monto} · Recargar · Enviar · Pagar | Si `wallet` visible. Botón de ojo oculta el monto |
| e5 | Tarjeta Ventas de hoy | {monto} · {n} ventas | Si `pos` o `finance` visible → S-FIN-01 |
| e6 | Tarjeta Pedidos por aceptar | {n} pedidos · vence en {mm:ss} | Si `orders` visible y n > 0 → S-ORD-01 |
| e7 | Tarjeta Entregas activas | {n} en camino | Si `logistics` visible → S-LOG-01 |
| e8 | Tarjeta Alertas | {n} alertas | Existencias bajas, folios, documentos por vencer → destino de cada alerta |
| e9 | `AppShell` | Etiquetas de módulos | Barra inferior, riel o riel extendido según ancho |

Vacío (usuario nuevo sin billetera verificada ni negocio): e3 más dos accesos: "Explorar tiendas" (S-MKT-01) y "Registrar mi negocio" (S-GEN-15).

### S-GEN-06 · `/inbox` · Bandeja
Todos · Paso F20.8 · `/v1/inbox`, WebSocket `inbox`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Filtros (chips) | Todos · Sin leer · Pagos · Pedidos · Seguridad | Uno activo |
| e2 | Lista de avisos | Título, primera línea, fecha relativa | Sin leer: punto rojo y título en negrita. Tocar marca leído y abre el recurso por enlace interno |
| e3 | Acción de barra | Marcar todo como leído | Pide confirmación solo si hay más de 20 |

Vacío: "No tienes avisos."

### S-GEN-07 · módulo no construido · Disponible próximamente
Icono del módulo, título "{Módulo}", texto "Estamos construyendo esta sección." Sin botón primario. Se muestra cuando el módulo es visible pero su fase no está cerrada.

## Cuenta

### S-GEN-08 · `/account` · Mi cuenta
Todos · Paso F02.6 · `/v1/me`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | {nombre} · {correo} · Nivel de verificación: {Básico / Verificado / Verificado plus} | El nivel enlaza a S-GEN-14 |
| e2 | Fila | Datos personales | → S-GEN-09 |
| e3 | Fila | Seguridad | → S-GEN-10 |
| e4 | Fila | Avisos | → S-GEN-11 |
| e5 | Fila | Privacidad y mis datos | → S-GEN-12 |
| e6 | Fila | Límites de mi cuenta | → S-WAL-09 |
| e7 | Selector | Idioma: Español / English | Inmediato |
| e8 | Selector | Tema: Sistema / Claro / Oscuro | Inmediato |
| e9 | Selector | Moneda mostrada: $ / B/. | Solo presentación (N-PAG-02) |
| e10 | Fila | Ayuda y reclamos | → S-MKT-08 |
| e13 | Fila | Permisos del dispositivo | → S-GEN-23 |
| e11 | Fila | Términos · Privacidad · Versión {x.y.z} | Enlaces públicos; la versión no es interactiva |
| e12 | `PPButton.secondary` | Cerrar sesión | Confirmación C-05 "Cerrar sesión" |

### S-GEN-09 · `/account/profile` · Datos personales
Todos · Paso F08.8 · Reglas: N-DAT-05, N-FMT-05, N-FMT-07

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `PPTextField` | Nombre completo | Editable hasta verificar identidad; después solo lectura con nota "Para cambiarlo, solicita una rectificación." (→ S-GEN-13) |
| e2 | `PPTextField` correo | Correo electrónico | Cambiarlo es operación 🔒 y exige confirmar el nuevo correo |
| e3 | `PPTextField` teléfono | Teléfono | Prefijo `+507` fijo por defecto; 8 dígitos si empieza por 6, 7 si es fijo. Se muestra `+507 6123-4567`. Cambio 🔒 |
| e4 | Solo lectura | Documento: {tipo} {número enmascarado} | Últimos 4 caracteres visibles |
| e5 | `PPButton.primary` | Guardar | — |

### S-GEN-10 · `/account/security` · Seguridad
Todos · Pasos F08.8, F23.3, F28.2 · `/v1/me/passkeys`, `/v1/me/step-up-pin`, `/v1/me/sessions` · Reglas: identity R25–R31, N-DAT-04 · Diseño: [`security/strong-authentication.md`](../../security/strong-authentication.md) §8.2 y §8.6

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Fila | Cambiar contraseña | 🔒 (`identity.password.change`) Formulario: contraseña actual, nueva (reglas S-GEN-03 e4). Éxito: cierra las demás sesiones |
| e6 | Fila | PIN de confirmación · {Configurado / Sin configurar} | Abre una hoja con "PIN nuevo" y "Repite el PIN" (`PinPad`, 6 dígitos). Siempre 🔒 nivel 3 (`identity.pin.set`): S-GEN-21 pide la contraseña, nunca el PIN actual. Bloqueado: "PIN bloqueado hasta {hora}." |
| e2 | Interruptor | Entrar con huella o rostro | Desbloqueo local de la app en este equipo (nivel 1) y passkey de este equipo. Sin biometría configurada: "Configura tu huella o tu rostro en los ajustes del equipo." con botón "Abrir ajustes". Al activarlo: hoja "Tu huella o tu rostro nunca salen de este dispositivo." → 🔒 `identity.passkey.register` (contraseña si es la primera passkey) → diálogo del sistema → `register/finish` con la etiqueta del equipo. Si las passkeys no están disponibles (`PASSKEYS_UNAVAILABLE`), activa solo el desbloqueo local. Al apagarlo: quita el desbloqueo local y ofrece "Eliminar también la llave de este equipo" (🔒 `identity.passkey.revoke`) |
| e3 | Lista | Llaves de acceso: {etiqueta} · {creada} · {último uso} · {Sincronizada} | Cada una con "Eliminar" (C-05 y 🔒 `identity.passkey.revoke`). Vacía o sin passkeys disponibles: la sección no se muestra |
| e4 | Lista | Dispositivos con sesión: {etiqueta} · {ciudad aproximada} · {última actividad} · {Contraseña / Llave de acceso} | El actual marcado "Este dispositivo". Cada otro tiene "Cerrar sesión" |
| e5 | `PPButton.text` | Cerrar todas las demás sesiones | C-05. Acción de protección: sin 🔒 |

Estados: sin `local_auth` ni passkeys en el equipo (Linux) e2 y e3 no se muestran y e6 queda como único método de confirmación. Tras registrar o eliminar una passkey llega un aviso de seguridad por correo y a la bandeja (R31).

### S-GEN-11 · `/account/notifications` · Preferencias de avisos
Todos · Paso F20.8 · `/v1/notification-preferences`

Matriz de interruptores: filas = categorías (Seguridad, Pagos, Pedidos, Entregas, Nómina, Novedades y ofertas); columnas = canales (En la app, Push, Correo, WhatsApp, SMS). Seguridad y Pagos aparecen activados y bloqueados con la nota "Estos avisos no se pueden desactivar." "Novedades y ofertas" refleja el consentimiento de mercadeo (S-GEN-03 e9): activarlo o desactivarlo actualiza ese consentimiento. Campo "No molestar de {hh:mm} a {hh:mm}" (no aplica a Seguridad).

## Privacidad

### S-GEN-12 · `/account/privacy` · Privacidad y mis datos
Todos · Paso F25.4 · `/v1/me/consents`, `/v1/me/data-requests` · Reglas: N-DAT-02, N-DAT-05 a N-DAT-08

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Texto | Tú decides cómo usamos tus datos. | — |
| e2 | Lista de consentimientos | {Finalidad} · Otorgado el {fecha} · versión {v} | Interruptor por finalidad revocable (mercadeo, biometría de marcaje, ubicación para entregas). Los necesarios para operar aparecen como "Necesario para tu cuenta" sin interruptor |
| e3 | Fila | Descargar mis datos | Crea solicitud de portabilidad → S-GEN-13 |
| e4 | Fila | Corregir mis datos | Crea solicitud de rectificación → S-GEN-13 |
| e5 | Fila | Oponerme a un uso de mis datos | Formulario con finalidad y motivo |
| e6 | Fila | Pedir revisión de una decisión automática | Visible si la cuenta tuvo un bloqueo o límite automático |
| e7 | Fila | Eliminar mi cuenta | → flujo de cancelación de S-GEN-13 |
| e8 | Fila | Mis solicitudes | Lista con estado y fecha límite |
| e9 | Texto `caption` | Oficial de protección de datos: {correo} | — |

Revocar un consentimiento: C-05 con el efecto concreto ("Dejarás de poder marcar asistencia con tu rostro.").

### S-GEN-13 · `/account/privacy/request/:id` · Solicitud sobre mis datos
Todos · Paso F25.4 · Reglas: N-DAT-05, N-DAT-06

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `StatusChip` | Recibida / En proceso / Resuelta / Rechazada | — |
| e2 | Texto | Tipo: {Acceso / Rectificación / Cancelación / Oposición / Portabilidad} | — |
| e3 | Texto | Te responderemos antes del {fecha}. | 10 días hábiles para acceso y portabilidad; 5 para rectificación y cancelación |
| e4 | (rectificación) Campos | Dato a corregir · Valor correcto · Documento de respaldo | Adjunto obligatorio: imagen o PDF ≤ 10 MB |
| e5 | (cancelación) Lista | Se eliminará: … / Se conservará bloqueado por obligación legal: facturas, movimientos de dinero, comprobantes de nómina, hasta {fecha} | Texto exacto según lo que la cuenta tenga |
| e6 | (cancelación) Requisito | Tu saldo debe ser $0.00 y no debes tener pedidos ni pagos en curso. | Si no se cumple, botón deshabilitado y enlace a lo pendiente |
| e7 | (portabilidad resuelta) `PPButton.primary` | Descargar (JSON y CSV) | Enlace válido 7 días; operación 🔒 |
| e8 | `PPButton.primary` | Enviar solicitud | 🔒 en cancelación |

## Verificación de identidad

### S-GEN-14 · `/account/verify` · Verifica tu identidad
Todos · Paso F08.8 · `/v1/me/kyc` · Reglas: N-AML-02, N-AML-03, N-AML-08, N-FMT-05

Asistente de 4 pasos con barra de progreso "Paso {n} de 4".

| Paso | Elementos | Validación |
|---|---|---|
| 1 Datos | Nombre legal completo · Fecha de nacimiento (selector; se muestra `10 oct 1990`) · Nacionalidad (lista ISO 3166) · Sexo según documento | Edad ≥ 18 (`AGE_REQUIREMENT`: "Debes tener 18 años o más.") |
| 2 Documento | Tipo: Cédula panameña / Cédula de residente (E) / Pasaporte · Número · Fecha de vencimiento · Foto del frente · Foto del reverso | Cédula con formato `P-T-A` (provincia 1–13 o `E`, `N`, `PE`, `PI`, `AV`); la app inserta los guiones. Vencimiento futuro. Fotos nítidas ≤ 10 MB |
| 3 Domicilio y actividad | Provincia → Distrito → Corregimiento (listas dependientes) · Dirección o referencia · Ocupación (lista) · Origen principal de tus fondos (Salario, Negocio propio, Ahorros, Remesas, Otro + texto) · ¿Eres o has sido funcionario público de alto rango, o familiar de uno? (Sí / No) | Todos obligatorios |
| 4 Revisión | Resumen de solo lectura · Casilla "Declaro que la información es verdadera." · `PPButton.primary` "Enviar verificación" | Casilla obligatoria |

Resultado: `StatusChip` "En revisión" con el texto "Suele tardar menos de 24 horas." Aprobada: nivel "Verificado" y límites de S-WAL-09. Rechazada: motivo genérico seleccionado por el revisor ("La foto no es legible", "El documento está vencido", "Los datos no coinciden") y botón "Corregir". Si la cuenta entra a revisión de cumplimiento, el único texto es el de `ACCOUNT_UNDER_REVIEW`.

## Alta de negocio

### S-GEN-15 · `/business/new` · Registrar mi negocio
Usuario sin negocio · Paso F08.8 · `POST /v1/business` · Reglas: N-AML-04, N-COM-01, N-FMT-06

Requiere identidad verificada del solicitante (si no, redirige a S-GEN-14). Asistente de 6 pasos.

| Paso | Elementos | Validación |
|---|---|---|
| 1 Negocio y vertical | Tipo: Persona natural / Persona jurídica · Razón social · Nombre comercial · RUC · DV · Actividad económica · Rubro MCC · Fecha de inicio · **Vertical primaria** (lista de 10 verticales: `retail`, `food_and_beverage`, `services_appointments`, `professional_services`, `wholesale_distribution`, `logistics_courier`, `beauty_wellness`, `health_clinic`, `education_courses`, `general_commercial`) | RUC natural = cédula; jurídica = `rollo-folio-asiento`. DV de 2 dígitos. `INVALID_RUC`: "El RUC o el DV no son válidos." `RUC_TAKEN`: "Este RUC ya está registrado." `VERTICAL_NOT_FOUND`: vertical requerida |
| 2 Ubicación y primera sucursal | Provincia → Distrito → Corregimiento · Ciudad · Dirección · Punto en el mapa · Teléfono · Correo del negocio · Nombre de sucursal inicial (por defecto "Casa Matriz", código fiscal `0000`) | Punto obligatorio dentro de Panamá. Crea la primera sucursal con código `0000` para DGI |
| 3 Rasgos y funciones | Preguntas de rasgos derivadas de la vertical elegida (variantes de producto, ventas por mesa/cocina, agenda de citas, entregas con flota propia, inventario por lotes). Muestra capacidades sugeridas activas | Permite personalizar qué funciones encender en el negocio desde el primer día |
| 4 Representante y dueños | Representante legal (precargado con el solicitante; editable) · Lista "Personas con 10 % o más del negocio": nombre, documento, porcentaje, nacionalidad · Casilla "Nadie más tiene 10 % o más." | Persona jurídica: al menos un dueño o la casilla. Suma de porcentajes ≤ 100. Registra la membresía de dueño con alcance `TENANT` |
| 5 Documentos | Aviso de Operación · Documento del representante · Pacto social o certificado del Registro Público (solo jurídica) · Comprobante de la cuenta bancaria | Cada uno: PDF o imagen ≤ 10 MB. Estado por archivo: subiendo, listo, error |
| 6 Cuenta de liquidación y envío | Banco (lista) · Tipo: Corriente / Ahorros · Número · Titular · Casillas: "Acepto el Contrato de comercio." y "Declaro que la información es verdadera." · `PPButton.primary` "Enviar a revisión" | El titular debe coincidir con la razón social o el representante. Transacción atómica en servidor: negocio + sucursal `0000` + capacidades + membresía dueño |

Resultado → S-GEN-16.

### S-GEN-16 · `/business` (estado) · Mi negocio en revisión
`StatusChip` "En revisión". Texto: "Ya puedes preparar tu catálogo. Podrás cobrar cuando aprobemos tu negocio." Lista de lo permitido (crear productos, configurar caja, invitar equipo) y lo bloqueado (cobrar, publicar en tiendas, recibir liquidaciones). Si la plataforma pide corrección: tarjeta "Necesitamos algo más" con el motivo y botón "Corregir" que reabre el paso afectado.

### S-GEN-17 · `/invite/:token` · Aceptar invitación
Sin sesión obligatoria · Paso F08.8. Muestra "{Negocio} te invita como {rol}" y sucursal/alcance asignado. Si el usuario ya tiene cuenta activa en PlentyPay, inicia sesión y acepta la membresía vinculándose al negocio sin duplicar su cuenta; si es nuevo, muestra los campos de registro de S-GEN-03 (correo precargado y bloqueado). Botón "Aceptar invitación" / "Aceptar y crear cuenta". Token vencido o revocado: "Esta invitación ya no es válida. Pide una nueva a tu negocio."

### S-GEN-18 · rechazo o suspensión del negocio
Tarjeta en Inicio y en S-ADM-01: "Tu negocio fue {rechazado / suspendido}." con el motivo comunicable y botón "Reenviar documentos" (rechazado) o "Contactar soporte" (suspendido).

## Sistema

### S-GEN-19 · `/update-required` · Actualización obligatoria
Bloqueante, sin navegación. "Actualiza PlentyPay para continuar." Botón "Actualizar" abre la tienda o la descarga según plataforma.

### S-GEN-20 · `/maintenance` · Mantenimiento
No bloquea lecturas. Franja C-11. Toda mutación responde con el mensaje de `MAINTENANCE_MODE`.

### S-GEN-21 · diálogo · Confirmación fuerte
Todos · Pasos F05.6, F23.3, F28.2 · `/v1/step-up/challenge`, `/v1/step-up/verify` · Reglas: N-PAG-05, identity R25–R28 · ADR 0020

Hoja inferior modal, desplazable al 200 %. Se abre por C-06 o cuando el servidor responde `STEP_UP_REQUIRED`; la app nunca decide el umbral.

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Título | Confirma que eres tú | — |
| e2 | Texto | {Operación}: {monto} | Operación y monto de la respuesta del reto, no de la pantalla que llama. Sin monto (p. ej. cambiar la contraseña) solo la operación |
| e3 | Botón biométrico | Usar huella o rostro | Solo si `available_methods` incluye `PASSKEY` y el equipo soporta passkeys. Primer método. Anuncia "Confirmar con huella o rostro". Envía la aserción con `method=PASSKEY` |
| e4 | `PinPad` | PIN de 6 dígitos | Si `available_methods` incluye `PIN`. Anuncia los dígitos ingresados sin leerlos. Envía con `method=PIN`; nunca se compara en la app |
| e6 | `PPTextField` contraseña | Contraseña | Solo en nivel 3 (`allowed_methods` = `PASSWORD`), en lugar de e3 y e4 |
| e7 | `PPButton.text` | Crear PIN | Solo si la operación acepta `PIN`, la persona no tiene PIN ni passkey (`PIN_NOT_SET`). Abre S-GEN-10 e6 y, al volver, pide un reto nuevo sin perder la operación |
| e5 | `PPButton.text` | Cancelar | Cierra y cancela la operación |

Errores bajo el método: `PIN_INVALID` "PIN incorrecto. Te quedan {n} intentos."; `PIN_LOCKED` "Demasiados intentos. Espera {minutos} minutos." (e4 se deshabilita; e3 sigue disponible); `PASSKEY_VERIFICATION_FAILED` "No pudimos verificar tu llave. Usa tu PIN."; `INVALID_CREDENTIALS` bajo e6. Si el reto vence (5 min), se pide otro sin perder la operación. El token resultante vale una sola vez, 5 minutos, y solo para esa operación y monto; la operación se reenvía con la misma `Idempotency-Key` (C-07).

### S-GEN-22 · pantalla de bloqueo
Pasos F23.3 · Tras inactividad (C-18, `session.idle_lock_minutes.*`): logo, "Desbloquea para continuar", "Usar huella o rostro" (o el bloqueo del sistema) y "Cerrar sesión" siempre visible. No llama al servidor (nivel 1). En equipos sin biometría ni bloqueo del sistema solo ofrece "Entrar de nuevo", que cierra la sesión local y abre S-GEN-02. Si cambiaron las huellas o rostros del equipo, también lleva a S-GEN-02.

### S-GEN-23 · `/account/permissions` · Permisos del dispositivo
Todos · Paso F23.8 · Sin llamadas al servidor · Reglas: N-DAT-02, N-DAT-04 · Diseño: [`security/strong-authentication.md`](../../security/strong-authentication.md) §6

Una fila por capacidad del registro (`device.*`) que la plataforma soporta; las no soportadas no se muestran.

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Texto | Revisa qué puede usar PlentyPay en este equipo. Solo lo pedimos cuando lo necesitas. | — |
| e2 | Lista | {Capacidad} · {para qué} · {Permitido / No permitido / Sin pedir / No configurado} | Estado del registro de capacidades. Biometría y llaves de acceso → S-GEN-10 |
| e3 | `PPButton.text` por fila | Abrir ajustes | Solo si el permiso fue denegado de forma permanente: abre los ajustes del sistema |

Al volver de los ajustes del sistema el estado se refresca. Ningún dato de esta pantalla viaja al servidor.
