# Plano de Diseño de Interfaces Flutter — gravital-experience-ui (M3 Expressive)

Oct 12, 2026 · @Angel Nereira

> **Regla de diseño estricta y obligatoria (ADR 0010)**: Este documento constituye el plan y la regla de diseño estricta (`gravital-experience-ui`) para diseñar, construir y refactorizar **todas las interfaces Flutter previas y futuras** del repositorio. Ninguna pantalla o componente Flutter puede crearse ni modificarse fuera de los principios, tokens, componentes, patrones de UX y el checklist de revisión (§15.3) definidos aquí.

## 1. Propósito, alcance y principios

Toda app e interfaz Flutter que construyas —finanzas, POS, inventario, facturación, movilidad, mensajería, logística, pagos, chat o landing— usará un único sistema de diseño basado en el lenguaje visual de **gravital-experience-ui**: Material 3 Expressive (M3E). Este plano define sus tokens, componentes, patrones de UX y reglas de revisión, y se implementa como un paquete Dart compartido (`gravital_experience_ui`) que todas las apps importan.

**Qué se replica:** el lenguaje de diseño abierto de Material (color tonal HCT, escala de formas, tipografía, movimiento por resortes, contención tonal, navegación adaptativa). Es una especificación pública y los componentes de Flutter que la implementan son de código abierto.

**Qué no se replica:** activos de marca de Google (logo, nombre comercial de terceros, iconos de apps de Google, fondos de pantalla), fuentes cuya licencia no lo permita, ni la UI del sistema operativo (barra de estado, ajustes rápidos, launcher). La identidad del sistema es **gravital-experience-ui**. Una app no controla la UI del sistema; solo se integra con ella (edge-to-edge, color dinámico, retroceso predictivo).

### Principios rectores

1. **Una sola fuente de verdad.** Ningún widget usa colores, radios, espacios o duraciones literales; todo sale de tokens del paquete compartido.
2. **Material primero, extensión después.** Se usan los componentes Material 3 de Flutter y se extienden con `ThemeExtension`; solo se construye a mano lo que M3E define y Flutter aún no trae.
3. **Color con intención.** Color dinámico (del fondo de pantalla) en apps personales; color de marca fijo en apps transaccionales y de confianza (pagos, POS, banca). La regla exacta está en la sección de color.
4. **Jerarquía por tono, no por sombra.** Las superficies se distinguen por nivel tonal (`surfaceContainer*`); la sombra se reserva para elementos que flotan sobre contenido en movimiento.
5. **Movimiento físico y con propósito.** Transiciones con resortes que explican el cambio de estado; nunca decoración. Se respeta «reducir movimiento» del sistema.
6. **Adaptativo desde el día uno.** El mismo código se acomoda a teléfono, plegable, tablet, escritorio y web por clases de tamaño de ventana, no por tipo de dispositivo.
7. **Accesible por defecto.** Contraste WCAG AA, objetivos táctiles de 48 dp, texto escalable al 200 % sin cortes, lectores de pantalla.
8. **Identidad igual, convenciones locales.** Color, forma, tipografía y componentes son idénticos en todas las plataformas; gestos, retroceso y diálogos críticos respetan la plataforma donde corre la app.

## 2. Estado del ecosistema (verificado al 12 oct 2026)

El estándar **gravital-experience-ui** actual es Material 3 Expressive más desenfoque en la UI del sistema; Flutter ya separó Material en el paquete `material_ui`, pero el soporte oficial de M3E apenas empieza. Por eso la base del sistema es `material_ui` oficial, y los componentes M3E que faltan entran detrás de adaptadores propios.

| Pieza | Estado a oct 2026 | Decisión para el sistema |
| --- | --- | --- |
| [M3 Expressive en gravital-experience-ui](https://blog.google/intl/en-in/products/hardware/material-3-expressive-updates-in-the-latest-pixel-drop/) | Llegó a gravital-experience-ui 6+ con el lanzamiento del 4 sep 2025; gravital-experience-ui 10 y 11 lo traen de fábrica | Es el lenguaje que se replica |
| [Android 17](https://nokiamob.net/2026/06/17/android-17-rollout-begins-for-pixel-the-list-of-eligible-devices/) | Estable en gravital-experience-ui desde junio 2026; QPR2 en beta para gravital-experience-ui en octubre 2026 | Referencia visual vigente |
| [Desenfoque (blur)](https://9to5google.com/2026/01/25/android-17-blur/) | Solo en UI del sistema: notificaciones, ajustes rápidos, volumen, menú de encendido. No es parte de M3E para apps | Opcional y restringido (sección 6) |
| [Flutter estable](https://flutter.dev/blog/whats-new-in-flutter-3-47) | 3.47 (12 ago 2026), Dart 3.13; mínimos iOS 15, Android minSdk 24, target/compile SDK 36. Próxima versión 3.50 en noviembre | Versión mínima: Flutter 3.47 |
| [material\_ui](https://pub.dev/packages/material_ui/changelog) | 1.0 con Flutter 3.47; 1.6.0 publicado el 6 oct 2026. La copia dentro del SDK se depreca en noviembre 2026 | Importar `package:material_ui/material_ui.dart` en todo el código |
| M3E oficial en `material_ui` | `StyleVariant` (M3 / M3 Expressive) desde 1.2.0; `IconButton` expresivo y niveles de contraste estándar/medio/alto desde 1.5.0 | Activar lo oficial a medida que llegue |
| [dynamic\_color](https://pub.dev/packages/dynamic_color/changelog) | 2.1.0 (20 ago 2026); desde 2.0 depende de `material_ui` | Usar la serie 2.x |
| [material\_3\_expressive](https://pub.dev/packages/material_3_expressive) | 1.1.6 (8 oct 2026), MIT, 44 widgets (split button, button group, toolbar flotante, loading indicator, sliders, carrusel). Requiere Flutter ≥ 3.47 y `material_ui` ^1.6.0. Publicador no verificado | Solo para lo que falta, siempre envuelto en adaptadores |
| [m3e\_collection](https://pub.dev/packages/m3e_collection) | 0.3.7, última publicación nov 2025; no declara iOS ni web | No usar |
| [Google Sans Flex](https://www.androidauthority.com/google-sans-flex-free-3617034/) | Abierta en Google Fonts el 18 nov 2025 bajo SIL OFL 1.1; seis ejes: peso, ancho, tamaño óptico, inclinación, redondez y grado | Fuente oficial del sistema |

**Regla de actualización:** cada trimestre, al salir una versión estable de Flutter, se revisa el changelog de `material_ui`. Cada componente M3E que pase a oficial reemplaza su adaptador comunitario sin cambiar la API pública del paquete compartido.

## 3. Arquitectura del sistema de diseño

El sistema **gravital-experience-ui** es un paquete Dart compartido en cinco capas: tokens, tema, componentes, patrones y apps. Las apps solo consumen las capas 3 y 4; nunca definen colores, formas ni movimiento propios.

&#91;embedded content: arquitectura del sistema · 5 capas\]

`tokens.json` es la única fuente: genera las constantes Dart del paquete y las variables CSS de las landing pages, así que un cambio de marca llega a apps y webs en la misma versión.

### Estructura interna del paquete

```text
gravital_experience_ui/lib/
├── gravital_experience_ui.dart   # único punto de import para las apps
└── src/
    ├── tokens/                   # tokens.g.dart, NSpace, NShape, NMotion, WindowClass
    ├── theme/                    # NTheme, SemanticColors, EmphasizedTextTheme
    ├── components/               # dominio: MoneyText, NumPad, StatusChip, MapSheetScaffold…
    ├── adapters/                 # envolturas de material_3_expressive (único lugar que lo importa)
    ├── patterns/                 # AdaptiveScaffold, EmptyState, ErrorState, OfflineBanner
    └── app/                      # NApp: arranque, color dinámico, borde a borde
```

## 4. Color

Cada app declara un solo color semilla de marca; de él se genera todo el esquema claro, oscuro y de alto contraste en el espacio HCT. El color dinámico del fondo de pantalla solo se activa en apps personales, y nunca toca los colores semánticos de dinero, estado o error.

### 4.1 Modelo

- El esquema sale de seis paletas tonales (primaria, secundaria, terciaria, neutral, neutral variante, error), cada una con tonos de 0 (negro) a 100 (blanco).
- Los widgets nunca usan un tono: usan **roles** (`primary`, `onSurface`, `surfaceContainerHigh`…). El rol garantiza el contraste en claro, oscuro y alto contraste.
- Generación: `ColorScheme.fromSeed(seedColor:, brightness:, dynamicSchemeVariant:, contrastLevel:)`. Variante por defecto `tonalSpot`; `fidelity` cuando la marca exige que el primario se parezca mucho a su color exacto.
- **Paridad con gravital-experience-ui:** la versión Dart de `material_color_utilities` (0.13.1, ago 2026) implementa la especificación de color 2021; la versión Kotlin ya incluye la especificación 2025 que usa Android 16+. El resultado es fiel pero no idéntico al del sistema. Si una marca necesita paridad exacta, genera los tokens con Material Theme Builder y guárdalos como constantes en el paquete.

### 4.2 Política de fuente de color por tipo de app

| Tipo de app | Fuente del color | Variante | Motivo |
| --- | --- | --- | --- |
| Finanzas, banca, pagos, facturación | Semilla de marca fija | `tonalSpot` o `fidelity` | Confianza y reconocimiento; capturas de soporte iguales para todos |
| POS (de cara al cliente) | Semilla de marca fija | `tonalSpot` | La pantalla la ven terceros; debe verse igual en cada caja |
| Inventario, logística, panel de conductor | Semilla de marca fija + alto contraste opcional | `tonalSpot` | Uso operativo, a veces en exteriores o almacenes |
| Mensajería, chat, llamadas | Dinámico en Android 12+; marca como respaldo | `tonalSpot` | App personal de uso diario; debe sentirse parte del teléfono |
| Movilidad tipo Uber (pasajero) | Semilla de marca fija | `tonalSpot` | El mapa ya tiene mucho color; la marca guía las acciones |
| Landing pages | Semilla de marca fija | `expressive` permitido solo en el bloque principal | Impacto visual sin perder identidad |

En iOS y web no existe color de fondo de pantalla: el sistema usa siempre la semilla de marca. `ColorScheme.fromImageProvider` se permite solo dentro de una pantalla centrada en una imagen (ficha de producto, perfil), envuelta en su propio `Theme`, nunca para toda la app.

### 4.3 Uso de roles

| Rol | Uso obligatorio |
| --- | --- |
| `primary` / `onPrimary` | Una sola acción principal por pantalla (botón filled, FAB) |
| `primaryContainer` / `onPrimaryContainer` | Estado seleccionado, FAB, chips activos, indicador de navegación |
| `secondaryContainer` / `onSecondaryContainer` | Botones tonales, filtros, acciones secundarias |
| `tertiary` / `tertiaryContainer` | Acento de contraste: promociones, insignias no críticas, destacar un dato |
| `error` / `errorContainer` | Solo errores y acciones destructivas |
| `surface` → `surfaceContainerLowest…Highest` | Fondos y jerarquía de superficies (sección 6) |
| `onSurface` / `onSurfaceVariant` | Texto e iconos principales / secundarios |
| `outline` / `outlineVariant` | Bordes de campos y botones outlined / separadores y bordes decorativos |
| `inverseSurface` / `onInverseSurface` | Snackbars y tooltips |
| `primaryFixed`, `secondaryFixed`… | Elementos que deben conservar el mismo tono en claro y oscuro (gráficos, ilustraciones) |

### 4.4 Colores semánticos extendidos

Material no define éxito, advertencia ni dinero. El paquete los agrega como `ThemeExtension` (`SemanticColors`), cada uno con cuatro roles: color, sobre-color, contenedor y sobre-contenedor.

- **Roles:** `success`, `warning`, `info`, `moneyIn`, `moneyOut`, `pending`.
- **Generación:** cada uno parte de un tono fijo (verde, ámbar, azul) y se armoniza con `color.harmonizeWith(scheme.primary)` del paquete `dynamic_color`. Se generan con la misma escala tonal para que el contraste sea correcto en claro y oscuro.
- **Regla de dinero:** el color nunca es el único indicador. Un monto saliente lleva signo «−» y un ícono; un monto entrante lleva «+». Los saldos neutros van en `onSurface`, no en verde.
- **Gráficos:** paleta categórica de hasta 8 colores derivada de los roles `*Fixed` y de tonos armonizados; nunca colores literales en código de gráficos.

### 4.5 Contraste y accesibilidad de color

- Texto normal ≥ 4.5:1, texto grande y componentes de interfaz ≥ 3:1 (WCAG 2.2 AA).
- Tres niveles: `contrastLevel` 0 (estándar), 0.5 (medio) y 1.0 (alto). El usuario puede elegirlo en Ajustes de la app.
- Si `MediaQuery.highContrastOf(context)` es verdadero (Android lo detecta desde Flutter 3.47), se usa el nivel 1.0 automáticamente.
- El modo oscuro se genera desde la misma semilla; nunca se invierten colores a mano.

## 5. Tipografía

Todas las apps usan **Google Sans Flex**, empaquetada como fuente variable dentro del paquete compartido, con la escala tipográfica de Material 3 (15 estilos) más sus 15 variantes enfatizadas. Es la fuente de marca de Google, abierta bajo SIL OFL 1.1 desde noviembre de 2025, así que se puede incrustar y redistribuir en apps comerciales.

### 5.1 Fuente y carga

- **Archivo:** el TTF variable se incluye en `assets/fonts/` del paquete y se declara en su `pubspec.yaml`. No se descarga en tiempo de ejecución: un POS o una app de logística debe verse igual sin red.
- **Licencia:** el texto OFL se registra en `LicenseRegistry` para que aparezca en la pantalla de licencias.
- **Ejes:** `wght` 1–1000, `wdth` 25–151, `opsz` 6–144, `slnt` −10–0, `ROND` 0–100 y `GRAD` 0–100 (archivo oficial `GoogleSansFlex[GRAD,ROND,opsz,slnt,wdth,wght].ttf`). Se controlan con `TextStyle.fontVariations`. Regla: `ROND` 0 en datos y formularios; `GRAD` cambia el grosor sin cambiar el ancho, así que el modo oscuro puede usar un grado menor que el claro sin provocar saltos de línea.
- **Respaldo:** `fontFamilyFallback` con Roboto Flex y la fuente del sistema para escrituras que Google Sans Flex no cubre (por ejemplo, chino).

### 5.2 Escala base (valores de los tokens oficiales de Material 3)

| Estilo | Tamaño / interlineado (sp) | Peso base | Peso enfatizado | Uso típico |
| --- | --- | --- | --- | --- |
| displayLarge | 57 / 64 | 400 | 500 | Saldo principal, monto a cobrar en POS |
| displayMedium | 45 / 52 | 400 | 500 | Hero de landing |
| displaySmall | 36 / 44 | 400 | 500 | Totales destacados |
| headlineLarge | 32 / 40 | 400 | 500 | Título de pantalla grande |
| headlineMedium | 28 / 36 | 400 | 500 | Título de sección en tablet |
| headlineSmall | 24 / 32 | 400 | 500 | Título de diálogo |
| titleLarge | 22 / 28 | 400 | 500 | Barra superior |
| titleMedium | 16 / 24 | 500 | 700 | Título de tarjeta, encabezado de lista |
| titleSmall | 14 / 20 | 500 | 700 | Subtítulos densos |
| bodyLarge | 16 / 24 | 400 | 500 | Texto principal |
| bodyMedium | 14 / 20 | 400 | 500 | Texto secundario |
| bodySmall | 12 / 16 | 400 | 500 | Notas al pie |
| labelLarge | 14 / 20 | 500 | 700 | Botones |
| labelMedium | 12 / 16 | 500 | 700 | Chips, pestañas |
| labelSmall | 11 / 16 | 500 | 700 | Insignias, metadatos |

La escala base vive en `ThemeData.textTheme`. Las variantes enfatizadas no existen en `TextTheme`, así que el paquete las expone como `ThemeExtension` (`EmphasizedTextTheme`). Se usan para el elemento seleccionado, la cifra que importa o la acción principal, nunca para párrafos completos.

### 5.3 Reglas

1. **Cifras tabulares** en montos, tablas, cronómetros y totales: `fontFeatures: [FontFeature.tabularFigures()]`. Verifica con una prueba visual que la fuente soporte la función; si no, las columnas numéricas usan Roboto Flex.
2. **Formato de dinero y fechas** siempre con `intl` y el `Locale` activo (por ejemplo `NumberFormat.currency(locale: 'es_PA')`); nunca concatenando cadenas.
3. **Escalado de texto:** las pantallas deben funcionar con el texto al 200 %. Sin alturas fijas en contenedores de texto; las filas crecen.
4. **Ancho de lectura:** los bloques de texto largos se limitan a unos 70 caracteres por línea (contenedor de máximo 720 dp en pantallas anchas).
5. **Máximo tres estilos por pantalla** además de los de los componentes; la jerarquía se logra con tamaño y peso, no con color.

## 6. Forma y superficies

Las esquinas salen de una escala de diez tokens y las superficies se distinguen por tono, no por sombra. La sombra y el desenfoque se reservan para lo que flota sobre contenido en movimiento.

### 6.1 Escala de esquinas (tokens oficiales M3 Expressive)

| Token | Radio (dp) | Componentes |
| --- | --- | --- |
| none | 0 | Imágenes a sangre, mapas a pantalla completa |
| extraSmall | 4 | Campos de texto (solo esquinas superiores), tooltips |
| small | 8 | Chips, insignias de texto |
| medium | 12 | Tarjetas, miniaturas |
| large | 16 | FAB estándar, hojas laterales, contenedores de lista |
| largeIncreased | 20 | Tarjetas destacadas, FAB mediano |
| extraLarge | 28 | Diálogos, hojas inferiores (solo arriba), tarjeta de monto en POS |
| extraLargeIncreased | 32 | Paneles hero, toolbar flotante si no es píldora |
| extraExtraLarge | 48 | Contenedores de ilustración, bloques de landing |
| full | 50 % | Botones, barra de búsqueda, indicador de navegación, avatares |

Reglas: un elemento hijo nunca tiene un radio mayor que su contenedor menos el padding; se usan esquinas circulares (`RoundedRectangleBorder`), y la superelipse (`RoundedSuperellipseBorder`) solo en superficies adaptadas a iOS.

### 6.2 Morphing de formas

M3 Expressive define una biblioteca de 35 formas (círculo, cookie, trébol, píldora, gema…) que se transforman entre sí. En Flutter se obtienen con el paquete `material_new_shapes` (port de `RoundedPolygon`).

- **Usos permitidos:** indicador de carga, botón de icono que pasa de redondo a cuadrado al seleccionarse, máscara de avatar o de imagen destacada, botón de la cámara o de grabar.
- **Prohibido:** formas decorativas en contenedores de datos (tablas, montos, formularios). Máximo una forma expresiva protagonista por pantalla.

### 6.3 Jerarquía tonal

| Superficie | Rol de color | Dónde |
| --- | --- | --- |
| Fondo | `surface` | Lienzo de cada pantalla |
| Tarjeta elevada, hoja inferior | `surfaceContainerLow` | Contenido agrupado sobre el fondo |
| Barra de navegación, rail, menús | `surfaceContainer` | Navegación persistente |
| Diálogo, barra de búsqueda, toolbar flotante | `surfaceContainerHigh` | Lo que está «más cerca» del usuario |
| Campo de texto filled, tarjeta filled | `surfaceContainerHighest` | Áreas de entrada y énfasis máximo |
| Áreas de retroceso, fondos de lista en tablet | `surfaceContainerLowest` | Lo que está «más lejos» |

### 6.4 Sombra y desenfoque

- **Elevación por defecto: 0.** Solo llevan sombra el FAB, la toolbar flotante, los menús desplegables y los elementos que se arrastran.
- **Desenfoque (opcional).** Android 17 lo usa en la UI del sistema, no en apps. El sistema lo permite únicamente en la barra o toolbar flotante y en el fondo de hojas modales, con `BackdropFilter` y una superficie al 80 % de opacidad. Siempre dentro de un `ClipRRect` del tamaño exacto del elemento.
- **Desactivar** el desenfoque en dispositivos de gama baja, en web y cuando el usuario active alto contraste; en esos casos se usa la superficie sólida.

## 7. Movimiento y háptica

Todo cambio de posición, tamaño o forma se anima con un resorte de la tabla; todo cambio de color u opacidad usa un resorte de «efectos» sin rebote. Hay dos esquemas: **Standard** para interacciones repetitivas y **Expressive** para momentos protagonistas.

### 7.1 Tokens de resorte (valores de `ExpressiveMotionTokens` y `StandardMotionTokens` de Jetpack Compose)

| Esquema | Token | Amortiguamiento (ratio) | Rigidez | Uso |
| --- | --- | --- | --- | --- |
| Expressive | fastSpatial | 0.6 | 800 | Presión de botón, cambio de forma de un control |
| Expressive | defaultSpatial | 0.8 | 380 | Expandir tarjeta, abrir menú FAB, hoja inferior |
| Expressive | slowSpatial | 0.8 | 200 | Transiciones de pantalla completa, confirmación de pago |
| Standard | fastSpatial | 0.9 | 1400 | Chips, switches, tabs |
| Standard | defaultSpatial | 0.9 | 700 | Listas, navegación, paneles |
| Standard | slowSpatial | 0.9 | 300 | Cambios grandes de layout |
| Ambos | fastEffects | 1.0 | 3800 | Estados de presión y foco |
| Ambos | defaultEffects | 1.0 | 1600 | Fundidos, cambio de color |
| Ambos | slowEffects | 1.0 | 800 | Aparición de contenido cargado |

En Flutter cada token se construye con `SpringDescription.withDampingRatio(mass: 1, stiffness: k, ratio: ζ)`, porque `SpringDescription` espera el coeficiente de amortiguamiento, no el ratio. Un ratio menor que 1 rebota; 1.0 no rebota.

### 7.2 Qué esquema usa cada app

- **Standard por defecto** en POS, inventario, facturación, logística y paneles: el usuario repite la misma acción cientos de veces al día y el rebote cansa.
- **Expressive** en momentos únicos: pago aprobado, envío de mensaje, onboarding, menú FAB, landing. También es el esquema por defecto de apps de consumo (chat, pagos P2P, movilidad).

### 7.3 Animaciones con duración

Para transiciones que no son físicas (rutas, fundidos cruzados) se usan los tokens de duración y curva de M3:

- Duraciones: short 50–200 ms, medium 250–400 ms, long 450–600 ms, extra long 700–1000 ms.
- Curvas: emphasized `Cubic(0.2, 0, 0, 1)`, emphasized decelerate `Cubic(0.05, 0.7, 0.1, 1)`, emphasized accelerate `Cubic(0.3, 0, 0.8, 0.15)`.
- Transición de ruta: en Android `PredictiveBackPageTransitionsBuilder (configurado en el tema, sección 14.4)`; en iOS `CupertinoPageTransitionsBuilder` (sección 10).

### 7.4 Movimiento reducido

Si `MediaQuery.disableAnimationsOf(context)` es verdadero, todos los resortes espaciales se reemplazan por un fundido de efectos o un cambio instantáneo. En web, Flutter 3.44+ respeta `prefers-reduced-motion`.

### 7.5 Háptica

| Evento | API | Ejemplo |
| --- | --- | --- |
| Selección discreta | `HapticFeedback.selectionClick()` | Switch, segmento, paso del selector de hora |
| Acción confirmada | `HapticFeedback.lightImpact()` | Pulsar FAB, agregar al carrito |
| Resultado importante | `HapticFeedback.mediumImpact()` | Pago aprobado, escaneo de código válido, soltar al reordenar |
| Rechazo o error | `HapticFeedback.heavyImpact()` | Pago rechazado, código inválido |

Una vibración por gesto como máximo, nunca durante el desplazamiento, y sincronizada con el inicio del resorte.

## 8. Espaciado, layout y adaptabilidad

El layout se decide por el ancho de la ventana (clase de tamaño), no por el tipo de dispositivo, y todo se dibuja borde a borde. Así la misma app funciona en teléfono, plegable, tablet POS, escritorio y web sin bifurcar código.

### 8.1 Espaciado

- Retícula base de **4 dp**. Tokens: 4, 8, 12, 16, 24, 32, 48, 64.
- Márgenes laterales: 16 dp en compact, 24 dp desde medium. Separación entre paneles: 24 dp.
- Padding interno de tarjetas: 16 dp; de diálogos y hojas: 24 dp.
- Objetivo táctil mínimo de **48 × 48 dp**; en POS y apps de conductor, 56 dp para las acciones principales.

### 8.2 Clases de tamaño de ventana

| Clase | Ancho (dp) | Navegación | Paneles |
| --- | --- | --- | --- |
| Compact | < 600 | Barra de navegación inferior (3–5 destinos) o toolbar flotante | 1 |
| Medium | 600–839 | Navigation rail | 1 (2 si el contenido lo permite) |
| Expanded | 840–1199 | Rail, expandible | 2 (lista + detalle) |
| Large | 1200–1599 | Rail expandido o drawer permanente | 2–3 |
| Extra-large | ≥ 1600 | Drawer permanente | 3 |

Las clases Large y Extra-large son oficiales desde Jetpack WindowManager 1.5. El paquete compartido expone `WindowClass.of(context)` calculado con `MediaQuery.sizeOf(context).width`.

### 8.3 Layouts canónicos

| Layout | Cuándo | Ejemplos |
| --- | --- | --- |
| Lista + detalle | Colección donde se abre un elemento | Chat, inventario, facturas, pedidos |
| Panel de apoyo | Tarea principal con contexto al lado | POS (catálogo + ticket), movilidad (mapa + hoja), facturación (formulario + vista previa) |
| Feed | Contenido navegable en tarjetas | Catálogo, landing, historial de movimientos |

### 8.4 Borde a borde y áreas seguras

- Las apps con `targetSdk` 36 (el valor por defecto de Flutter 3.47) ya no pueden desactivar el modo borde a borde en Android 16+. Las barras del sistema son transparentes y la app dibuja detrás.
- Los **fondos** llegan hasta el borde; el **contenido interactivo** respeta las áreas seguras: `MediaQuery.paddingOf` para barras, `viewInsetsOf` para el teclado y `viewPaddingOf` para barras inferiores propias.
- No envolver la pantalla entera en `SafeArea`: se aplica solo al contenido, para que el color de la superficie llegue debajo de la barra de gestos.
- Desde Flutter 3.44, `MediaQueryData.displayCornerRadii` da los radios de las esquinas físicas de la pantalla en Android; úsalos para que nada se recorte en esquinas muy redondeadas.

### 8.5 Orientación y pantallas grandes

Android 16 ignora por defecto los bloqueos de orientación, tamaño y relación de aspecto en pantallas grandes. Una app de POS o inventario bloqueada en vertical se mostrará en horizontal en una tablet, así que **todas las pantallas deben soportar ambas orientaciones** desde medium.

### 8.6 Entrada no táctil

En escritorio, web y Googlebook: estados de hover, anillo de foco visible, atajos de teclado (por ejemplo, F2 cobrar, Ctrl+K buscar) y menú contextual con clic derecho. En POS se asume lector de código de barras como teclado: el campo de búsqueda debe aceptar entrada sin foco visible y sin abrir el teclado virtual.

## 9. Iconografía y componentes

Las apps solo usan componentes del paquete compartido. Cada componente sale de una de tres fuentes —oficial (`material_ui`), adaptador M3E (`material_3_expressive` envuelto) o propio de dominio— y la app nunca sabe cuál es.

### 9.1 Iconos

- **Familia única:** Material Symbols **Rounded** (la que usa **gravital-experience-ui**), vía el paquete `material_symbols_icons`.
- **Ejes:** `fill` 0 por defecto y 1 en el estado seleccionado (destinos de navegación, favoritos); `weight` 400; `opticalSize` igual al tamaño del icono; `grade` −25 sobre fondos oscuros para compensar el efecto óptico de engrosamiento.
- **Tamaños:** 20, 24 (por defecto), 40 y 48 dp.
- Un icono sin texto siempre lleva `semanticLabel` o `tooltip`.

### 9.2 Catálogo

| Grupo | Componente | Fuente | Regla clave |
| --- | --- | --- | --- |
| Acciones | Botón filled / tonal / outlined / text | Oficial | Un solo filled por pantalla |
| Acciones | Icon button | Oficial (M3E desde `material_ui` 1.5) | Toggle cambia de redondo a cuadrado |
| Acciones | Button group (estándar y conectado) | Adaptador | Reemplaza al segmented button para 2–5 opciones |
| Acciones | Split button | Adaptador | Acción principal + variantes (Guardar / Guardar como borrador) |
| Acciones | FAB y extended FAB | Oficial | Uno por pantalla; se oculta al desplazar |
| Acciones | Menú FAB | Adaptador | 2–6 acciones de creación |
| Comunicación | Snackbar, tooltip, badge | Oficial | Snackbar para deshacer; nunca para errores críticos |
| Comunicación | Progress lineal y circular | Oficial; variante ondulada por adaptador | Ondulado solo en procesos largos visibles (subida, sincronización) |
| Comunicación | Loading indicator de formas | Adaptador | Esperas de 1 a 5 s sin progreso medible |
| Contención | Card, carrusel (`CarouselView`), lista, divider | Oficial | Listas agrupadas en contenedores redondeados |
| Contención | Diálogo, bottom sheet | Oficial | Diálogo solo para confirmar decisiones; el resto en hojas |
| Contención | Side sheet | Adaptador | Filtros y detalle en expanded+ |
| Navegación | Navigation bar, rail, drawer, tabs | Oficial | Según la clase de tamaño (sección 8) |
| Navegación | App bar (small, medium/large flexible) | Oficial; flexible por adaptador | Título grande que colapsa al desplazar |
| Navegación | Toolbar flotante y acoplada | Adaptador | Acciones contextuales de la pantalla actual |
| Navegación | Búsqueda (`SearchAnchor`) | Oficial | Píldora en compact, vista acoplada en expanded |
| Selección | Checkbox, radio, switch, chips, slider, menús, date/time picker | Oficial | Chips de filtro siempre con estado seleccionado visible |
| Entrada | Text field (filled por defecto) | Oficial | Etiqueta siempre visible; error con texto, no solo color |

### 9.3 Componentes de dominio (propios del paquete)

Se construyen una vez sobre los tokens y se reutilizan en todas las apps:

- **Dinero:** `MoneyText` (formato, signo, cifras tabulares, color semántico), `AmountInput` con teclado numérico propio, `BalanceCard`.
- **Comercio:** `ProductTile`, `CartLine`, `ReceiptView` (vista y PDF), `NumPad` de POS, `BarcodeField`.
- **Estado:** `StatusChip` (pagado, pendiente, anulado, en ruta), `Timeline` de pedido o envío.
- **Personas:** `Avatar` con indicador de presencia, `MessageBubble`, `CallControls`.
- **Mapas:** `MapSheetScaffold` (mapa + hoja inferior arrastrable), `RouteCard`, `EtaBadge`.
- **Estados de pantalla:** `EmptyState`, `ErrorState`, `OfflineBanner`, `SkeletonList`.

**Regla de importación:** las apps importan solo el paquete compartido. Una regla de lint en CI rechaza cualquier import directo de `material_3_expressive` o de `package:flutter/material.dart`.

## 10. Navegación y patrones de UX

Todas las apps comparten el mismo modelo: 3 a 5 destinos principales, navegación jerárquica con retroceso predictivo y flujos modales a pantalla completa para tareas críticas. Los estados de carga, vacío, error y sin conexión se resuelven siempre con los mismos componentes.

### 10.1 Modelo de navegación

| Nivel | Patrón | Ejemplo |
| --- | --- | --- |
| Destinos principales | Navigation bar / rail / drawer según la clase de tamaño | Inicio, Ventas, Inventario, Ajustes |
| Jerárquico | Push de pantalla con app bar y retroceso | Lista de facturas → factura |
| Tarea crítica | Flujo modal a pantalla completa con botón cerrar (X) | Cobro, alta de producto, onboarding, transferencia |
| Contextual | Hoja inferior o side sheet | Filtros, detalle rápido, opciones de envío |

- **Router:** `go_router` con `StatefulShellRoute` para conservar el estado de cada destino al cambiar de pestaña, y rutas con nombre para deep links.
- **Toolbar flotante vs. barra de navegación:** la barra lleva a destinos; la toolbar ejecuta acciones de la pantalla actual (editor, mapa, selección múltiple). Nunca las dos en el borde inferior a la vez.

### 10.2 Retroceso predictivo

- En Android 16+ con `targetSdk` 36, las animaciones de retroceso predictivo están activas por defecto y `onBackPressed` ya no se llama.
- En Flutter se usa `PopScope(canPop: …, onPopInvokedWithResult: …)`. `canPop` se calcula antes del gesto: solo es `false` cuando hay cambios sin guardar o un pago en curso.
- **Nunca** interceptar el retroceso de forma permanente: rompe la vista previa del sistema y el usuario siente la app «atascada».

### 10.3 Formularios

1. Una columna; etiqueta siempre visible; campos agrupados por tema con títulos `titleSmall`.
2. Teclado correcto por campo (`TextInputType.number` para montos, `emailAddress`, `phone`) y `autofillHints`.
3. Validación al salir del campo, no en cada tecla. El mensaje dice cómo corregir («Escribe 8 dígitos»), no solo «Inválido».
4. Acción principal fija abajo y por encima del teclado; deshabilitada solo si falta un dato obligatorio, y en ese caso se explica cuál.

### 10.4 Estados de pantalla

| Estado | Regla |
| --- | --- |
| Carga < 300 ms | No mostrar nada (evita parpadeo) |
| Carga 300 ms – 1 s | `SkeletonList` con la forma del contenido final |
| Carga 1 – 5 s | Esqueleto + indicador de carga de formas |
| Carga > 5 s | Progreso determinado con texto («Sincronizando 120 de 400 productos») |
| Vacío | Ilustración pequeña + título + una acción («Agregar primer producto») |
| Error | Qué pasó + cómo resolverlo + botón Reintentar; el código técnico va en un desplegable |
| Sin conexión | `OfflineBanner` persistente; las acciones se encolan y se marcan como pendientes |

### 10.5 Confirmaciones y acciones destructivas

- **Reversible** (archivar, quitar del carrito): se ejecuta de inmediato con snackbar «Deshacer».
- **Irreversible** (anular factura, eliminar cliente): diálogo con verbo explícito en el botón («Anular factura»), nunca «Aceptar».
- **Dinero** (cobrar, transferir): pantalla de resumen con el monto en `displayLarge`, destinatario y comisión; la confirmación muestra el resultado con háptica y animación expresiva.

### 10.6 Notificaciones de progreso

Para viajes, entregas y cobros en curso se usa una notificación de progreso del sistema (Live Updates en **gravital-experience-ui**). Requiere un canal nativo de Android; el paquete compartido define su contenido (estado, ETA, acción principal) para que todas las apps la muestren igual.

### 10.7 Voz y microcopy

- Español neutro de Panamá; verbos en infinitivo en botones («Cobrar», «Guardar»).
- Trato de **tú** en apps de consumo y de **usted** en banca y facturación a empresas; se define una vez por app en su configuración de marca.
- Mensajes cortos: títulos de hasta 6 palabras, descripciones de hasta 2 líneas.

## 11. Estrategia multiplataforma

La identidad (color, forma, tipografía, componentes) es idéntica en todas las plataformas; los gestos, el desplazamiento y la edición de texto siguen la plataforma donde corre la app. Las landing pages no se hacen en Flutter: consumen los mismos tokens desde CSS.

| Plataforma | Color | Navegación y gestos | Superficies | Notas |
| --- | --- | --- | --- | --- |
| Android (gravital-experience-ui y otros) | Dinámico donde aplique (sección 4.2) | Retroceso predictivo con `PredictiveBackPageTransitionsBuilder` | Contención tonal; desenfoque opcional | Referencia principal del sistema |
| iOS / iPadOS (mínimo iOS 15 con Flutter 3.47) | Siempre semilla de marca; `dynamic_color` no soporta iOS | Deslizar desde el borde con `CupertinoPageTransitionsBuilder`; física de rebote | Igual que Android | Componentes Material; edición de texto y menús de selección nativos |
| Web (apps y paneles) | Semilla de marca | Historial del navegador y URLs con `go_router`; atajos de teclado | Igual; sin desenfoque | Compilar con `--wasm`; Flutter 3.44+ respeta `prefers-reduced-motion` |
| Escritorio (Windows, macOS, Linux) | Acento del sistema vía `dynamic_color` o marca | Teclado, hover, clic derecho | Densidad compacta en tablas | Impeller por defecto desde Flutter 3.47 |
| Landing pages | Tokens exportados a variables CSS | Web estándar | Mismos radios, colores y tipografía | HTML/CSS (Next.js) para SEO y carga rápida |

### 11.1 Reglas de adaptación

1. Se adapta el **comportamiento**, no la apariencia: `PageTransitionsTheme` por plataforma, `ScrollPhysics` por plataforma, menú de selección de texto nativo.
2. Los diálogos de permisos y de sistema los muestra el sistema operativo; la app solo explica antes por qué los pide.
3. En iOS, las acciones destructivas pueden abrirse en una hoja inferior Material con la acción en rojo al final; no se mezclan componentes Cupertino con Material en la misma pantalla.
4. La decisión se toma con `Theme.of(context).platform`, nunca con `Platform.isIOS`, para que funcione en web y se pueda probar.

### 11.2 Una sola fuente de tokens

Los tokens (colores generados, radios, espaciado, tipografía, resortes) se guardan en un archivo JSON con el formato de Design Tokens del W3C dentro del repositorio del sistema. Un generador produce dos salidas:

- `tokens.g.dart` para el paquete Flutter.
- `tokens.css` con variables CSS para landing pages y cualquier web en Next.js/TypeScript.

Así un cambio de marca se hace en un solo lugar y llega a apps y webs en la misma versión.

## 12. Recetas por tipo de app

Cada tipo de app usa los mismos tokens y componentes; lo que cambia es la estructura de navegación, la pantalla protagonista y unas pocas reglas propias. La fuente de color y el esquema de movimiento de cada tipo están en las secciones 4.2 y 7.2.

| Tipo | Estructura y pantalla protagonista | Componentes clave y reglas propias |
| --- | --- | --- |
| Finanzas / banca | Barra: Inicio, Movimientos, Pagar, Tarjetas, Más. Inicio con `BalanceCard` y movimientos agrupados por fecha | Saldo en `displayLarge` con opción de ocultarlo; biometría antes de datos sensibles; bloqueo de capturas en pantallas de saldo y tarjeta |
| Pagos (P2P, QR) | Barra: Inicio, Escanear, Actividad. Flujo modal: monto → destinatario → resumen → resultado | `AmountInput` con `NumPad` (monto primero); escáner a pantalla completa con marco de forma expresiva; resultado con resorte expressive y háptica media |
| POS | Panel de apoyo: catálogo en cuadrícula + ticket a la derecha (expanded+); en compact, ticket en hoja inferior | Total siempre visible; botón Cobrar ≥ 56 dp; métodos de pago en button group; funciona sin red; atajos de teclado; lector de código como entrada |
| Inventario | Lista + detalle; tablas compactas en escritorio | `StatusChip` de stock (en stock, bajo, agotado) con color semántico + icono; filtros en chips + side sheet; selección múltiple con toolbar flotante |
| Facturación | Lista + detalle con vista previa del documento en panel de apoyo | Estados del documento electrónico (borrador, enviado, autorizado, rechazado, anulado) con `StatusChip`; anulación solo con diálogo de verbo explícito; `ReceiptView` exporta PDF |
| Movilidad tipo Uber | `MapSheetScaffold`: mapa a pantalla completa + hoja con 3 alturas (vistazo, media, completa); búsqueda en píldora flotante | Controles sobre el mapa en `surfaceContainerHigh` con sombra; estilo de mapa claro u oscuro según el tema; ETA en `EtaBadge`; notificación de progreso del viaje |
| Logística | App de repartidor: lista de paradas como `Timeline`; panel de despacho web con mapa + lista | Botones de acción ≥ 56 dp; prueba de entrega (foto o firma); cola sin conexión; alto contraste disponible para exteriores |
| Mensajería y chat | Lista + detalle; barra de entrada en píldora fija sobre el teclado | `MessageBubble` con esquinas reducidas del lado donde se agrupan mensajes consecutivos; el botón de micrófono se transforma en Enviar; color dinámico activo; resorte expressive al enviar |
| Llamadas | Llamada entrante a pantalla completa; en llamada, `CallControls` en un button group de toggles redondos | Aceptar y rechazar grandes y separados; los toggles cambian de forma al activarse; integración nativa con el gestor de llamadas de cada sistema |
| Landing pages | Hero + secciones en bandas de `surfaceContainer` + CTA en píldora | HTML/CSS con `tokens.css`; titular en Google Sans Flex `displayLarge`; una sola forma expresiva protagonista; respeta modo oscuro y movimiento reducido del navegador |

## 13. Accesibilidad, internacionalización y rendimiento

La meta es WCAG 2.2 nivel AA en todas las apps, español como idioma base con inglés preparado, y 60 fps estables (120 fps en pantallas que lo soporten). Las tres cosas se verifican con pruebas automáticas, no a ojo.

### 13.1 Accesibilidad

- **Lectores de pantalla:** todo icono interactivo con etiqueta; filas de lista con `MergeSemantics`; cambios importantes (pago aprobado, nuevo mensaje) se anuncian.
- **Escala de texto:** probado al 200 %; nada se corta ni se superpone.
- **Contraste:** tres niveles (sección 4.5). Desde Flutter 3.47 se detectan en Android el alto contraste y la inversión de colores del sistema (`MediaQueryData.highContrast`, `invertColors`).
- **Movimiento reducido:** sección 7.4.
- **Teclado y foco:** orden lógico, anillo de foco visible, todos los flujos completables sin táctil.
- **Color:** nunca es el único portador de significado (signo, icono o texto siempre acompañan).
- **Pruebas:** en cada pantalla del catálogo, `meetsGuideline(androidTapTargetGuideline)`, `iOSTapTargetGuideline`, `labeledTapTargetGuideline` y `textContrastGuideline` en `flutter_test`.

### 13.2 Internacionalización

- Textos en archivos ARB con `gen-l10n`; `es` por defecto, `en` como segundo idioma.
- Con `material_ui`, las traducciones de Material y Cupertino vienen en el paquete: `localizationsDelegates: GlobalMaterialLocalizations.delegates`.
- Paddings y alineaciones con versiones direccionales (`EdgeInsetsDirectional`, `AlignmentDirectional`) para soportar escritura de derecha a izquierda sin rediseñar.
- Montos, fechas y números con `intl` y el locale activo (sección 5.3).

### 13.3 Rendimiento

- **Motor:** Impeller en Android (Vulkan), iOS (Metal) y, desde Flutter 3.47, escritorio por defecto. No se necesita precalentar shaders.
- **Aislar animaciones continuas** (indicador de carga, progreso ondulado, marcadores de mapa) en `RepaintBoundary`.
- **Desenfoque:** máximo un `BackdropFilter` visible por pantalla.
- **Listas:** siempre `ListView.builder` o slivers; constructores `const` en widgets estáticos.
- **Imágenes:** `cacheWidth`/`cacheHeight` al tamaño real de pantalla; nunca decodificar fotos completas para miniaturas.
- **Presupuesto de cuadro:** 16,6 ms a 60 Hz y 8,3 ms a 120 Hz; se mide en modo profile con DevTools en un equipo de gama media, no solo en el dispositivo de referencia de **gravital-experience-ui**.

## 14. Implementación de referencia en Dart

El paquete compartido del sistema **gravital-experience-ui** se llama `gravital_experience_ui`. Estos archivos son el punto de partida mínimo: tokens, tema, colores semánticos, un componente de dominio, un adaptador M3E y el arranque de una app.

### 14.1 `pubspec.yaml` del paquete

```yaml
name: gravital_experience_ui
description: Sistema de diseño compartido gravital-experience-ui (M3 Expressive).
version: 0.1.0

environment:
  sdk: ^3.13.0
  flutter: ">=3.47.0"

dependencies:
  flutter:
    sdk: flutter
  material_ui: ^1.6.0
  dynamic_color: ^2.1.0
  material_color_utilities: ^0.13.1
  material_3_expressive: ^1.1.6   # solo se importa dentro de lib/src/adapters/
  material_symbols_icons: any     # fijar la versión vigente al crear el paquete
  intl: ^0.20.2

flutter:
  fonts:
    - family: GoogleSansFlex
      fonts:
        - asset: assets/fonts/GoogleSansFlex-Variable.ttf  # nombre del archivo descargado de Google Fonts
```

### 14.2 Tokens

```dart
// lib/src/tokens/tokens.dart
import 'package:flutter/physics.dart';
import 'package:material_ui/material_ui.dart';

abstract final class NSpace {
  static const double xs = 4, s = 8, m = 12, l = 16, xl = 24, xxl = 32, xxxl = 48, huge = 64;
}

abstract final class NShape {
  static const double extraSmall = 4, small = 8, medium = 12, large = 16,
      largeIncreased = 20, extraLarge = 28, extraLargeIncreased = 32,
      extraExtraLarge = 48;

  static RoundedRectangleBorder rounded(double r) =>
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(r));
}

/// Valores de ExpressiveMotionTokens / StandardMotionTokens (Jetpack Compose).
/// SpringDescription espera el coeficiente de amortiguamiento, por eso se
/// construye desde el ratio con withDampingRatio.
abstract final class NMotion {
  static SpringDescription _s(double stiffness, double ratio) =>
      SpringDescription.withDampingRatio(mass: 1, stiffness: stiffness, ratio: ratio);

  static final expressiveFastSpatial = _s(800, 0.6);
  static final expressiveDefaultSpatial = _s(380, 0.8);
  static final expressiveSlowSpatial = _s(200, 0.8);

  static final standardFastSpatial = _s(1400, 0.9);
  static final standardDefaultSpatial = _s(700, 0.9);
  static final standardSlowSpatial = _s(300, 0.9);

  static final fastEffects = _s(3800, 1.0);
  static final defaultEffects = _s(1600, 1.0);
  static final slowEffects = _s(800, 1.0);
}

enum WindowClass {
  compact, medium, expanded, large, extraLarge;

  static WindowClass of(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    if (w < 600) return compact;
    if (w < 840) return medium;
    if (w < 1200) return expanded;
    if (w < 1600) return large;
    return extraLarge;
  }
}
```

### 14.3 Colores semánticos

```dart
// lib/src/theme/semantic_colors.dart
import 'package:dynamic_color/dynamic_color.dart';
import 'package:material_ui/material_ui.dart';

@immutable
class SemanticTone {
  const SemanticTone(this.color, this.onColor, this.container, this.onContainer);
  final Color color, onColor, container, onContainer;

  factory SemanticTone.from(Color seed, ColorScheme scheme) {
    final s = ColorScheme.fromSeed(
      seedColor: seed.harmonizeWith(scheme.primary),
      brightness: scheme.brightness,
      dynamicSchemeVariant: DynamicSchemeVariant.fidelity,
    );
    return SemanticTone(s.primary, s.onPrimary, s.primaryContainer, s.onPrimaryContainer);
  }

  static SemanticTone lerp(SemanticTone a, SemanticTone b, double t) => SemanticTone(
        Color.lerp(a.color, b.color, t)!,
        Color.lerp(a.onColor, b.onColor, t)!,
        Color.lerp(a.container, b.container, t)!,
        Color.lerp(a.onContainer, b.onContainer, t)!,
      );
}

@immutable
class SemanticColors extends ThemeExtension<SemanticColors> {
  const SemanticColors({
    required this.success, required this.warning, required this.info,
    required this.moneyIn, required this.moneyOut, required this.pending,
  });

  final SemanticTone success, warning, info, moneyIn, moneyOut, pending;

  factory SemanticColors.from(ColorScheme s) => SemanticColors(
        success: SemanticTone.from(const Color(0xFF1E8E3E), s),
        warning: SemanticTone.from(const Color(0xFFF9AB00), s),
        info: SemanticTone.from(const Color(0xFF1A73E8), s),
        moneyIn: SemanticTone.from(const Color(0xFF188038), s),
        moneyOut: SemanticTone.from(const Color(0xFFC5221F), s),
        pending: SemanticTone.from(const Color(0xFF8E6B00), s),
      );

  @override
  SemanticColors copyWith() => this;

  @override
  SemanticColors lerp(SemanticColors? other, double t) {
    if (other == null) return this;
    return SemanticColors(
      success: SemanticTone.lerp(success, other.success, t),
      warning: SemanticTone.lerp(warning, other.warning, t),
      info: SemanticTone.lerp(info, other.info, t),
      moneyIn: SemanticTone.lerp(moneyIn, other.moneyIn, t),
      moneyOut: SemanticTone.lerp(moneyOut, other.moneyOut, t),
      pending: SemanticTone.lerp(pending, other.pending, t),
    );
  }
}
```

### 14.4 Tema

```dart
// lib/src/theme/n_theme.dart
import 'package:material_ui/material_ui.dart';
import '../tokens/tokens.dart';
import 'semantic_colors.dart';

abstract final class NTheme {
  static const _font = 'packages/gravital_experience_ui/GoogleSansFlex';

  /// Aplica peso y tamaño óptico como ejes variables (wght, opsz).
  static TextStyle? _axes(TextStyle? s, {bool emphasized = false}) {
    if (s == null) return null;
    final base = s.fontWeight ?? FontWeight.w400;
    final w = emphasized ? (base.value >= 500 ? FontWeight.w700 : FontWeight.w500) : base;
    return s.copyWith(
      fontWeight: w,
      fontVariations: [
        FontVariation.weight(w.value.toDouble()),
        if (s.fontSize != null) FontVariation.opticalSize(s.fontSize!),
      ],
    );
  }

  static TextTheme _map(TextTheme t, TextStyle? Function(TextStyle?) f) => TextTheme(
        displayLarge: f(t.displayLarge), displayMedium: f(t.displayMedium), displaySmall: f(t.displaySmall),
        headlineLarge: f(t.headlineLarge), headlineMedium: f(t.headlineMedium), headlineSmall: f(t.headlineSmall),
        titleLarge: f(t.titleLarge), titleMedium: f(t.titleMedium), titleSmall: f(t.titleSmall),
        bodyLarge: f(t.bodyLarge), bodyMedium: f(t.bodyMedium), bodySmall: f(t.bodySmall),
        labelLarge: f(t.labelLarge), labelMedium: f(t.labelMedium), labelSmall: f(t.labelSmall),
      );

  static ThemeData build(ColorScheme scheme) {
    final base = ThemeData(colorScheme: scheme);
    final text = _map(
      base.textTheme.apply(fontFamily: _font, bodyColor: scheme.onSurface, displayColor: scheme.onSurface),
      _axes,
    );
    final emphasized = _map(text, (s) => _axes(s, emphasized: true));

    return base.copyWith(
      textTheme: text,
      scaffoldBackgroundColor: scheme.surface,
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: scheme.surfaceContainerLow,
        shape: NShape.rounded(NShape.medium),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        shape: NShape.rounded(NShape.extraLarge),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(NShape.extraLarge)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surfaceContainer,
        indicatorColor: scheme.secondaryContainer,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      }),
      extensions: [
        SemanticColors.from(scheme),
        EmphasizedTextTheme(emphasized),
      ],
    );
  }
}

@immutable
class EmphasizedTextTheme extends ThemeExtension<EmphasizedTextTheme> {
  const EmphasizedTextTheme(this.text);
  final TextTheme text;

  @override
  EmphasizedTextTheme copyWith({TextTheme? text}) => EmphasizedTextTheme(text ?? this.text);

  @override
  EmphasizedTextTheme lerp(EmphasizedTextTheme? other, double t) =>
      other == null ? this : EmphasizedTextTheme(TextTheme.lerp(text, other.text, t));
}
```

### 14.5 Componente de dominio: `MoneyText`

```dart
// lib/src/components/money_text.dart
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import '../theme/semantic_colors.dart';

class MoneyText extends StatelessWidget {
  const MoneyText(this.amount, {super.key, this.currency = 'USD', this.signed = false, this.style});

  final num amount;
  final String currency;
  final bool signed; // true en movimientos: muestra + o − y color semántico
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sem = theme.extension<SemanticColors>()!;
    final f = NumberFormat.simpleCurrency(
      locale: Localizations.localeOf(context).toString(),
      name: currency,
    );
    final negative = amount < 0;
    final value = f.format(amount.abs());
    final text = signed ? '${negative ? '−' : '+'}$value' : (negative ? '−$value' : value);
    final color = signed
        ? (negative ? sem.moneyOut.color : sem.moneyIn.color)
        : theme.colorScheme.onSurface;

    return Text(
      text,
      style: (style ?? theme.textTheme.bodyLarge)!.copyWith(
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}
```

### 14.6 Adaptador M3E (ejemplo: split button)

```dart
// lib/src/adapters/split_button.dart  — único lugar donde se importa material_3_expressive
import 'package:material_3_expressive/material_3_expressive.dart' as m3e;
import 'package:material_ui/material_ui.dart';

class NSplitButton<T> extends StatelessWidget {
  const NSplitButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.options,
    required this.onSelected,
  });

  final String label;
  final VoidCallback onPressed;
  final Map<T, String> options;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) => m3e.M3ESplitButton<T>(
        label: label,
        onPressed: onPressed,
        onSelected: onSelected,
        items: [
          for (final o in options.entries)
            m3e.M3ESplitButtonItem(value: o.key, child: Text(o.value)),
        ],
      );
}
```

Cuando `material_ui` publique un split button oficial, solo cambia el cuerpo de `build`; las apps no se tocan.

### 14.7 Arranque de una app

```dart
// lib/src/app/n_app.dart
import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/services.dart';
import 'package:material_3_expressive/material_3_expressive.dart' as m3e;
import 'package:material_ui/material_ui.dart';
import '../theme/n_theme.dart';

class NApp extends StatelessWidget {
  const NApp({
    super.key,
    required this.title,
    required this.brandSeed,
    required this.router,
    this.useDynamicColor = false, // true solo en apps personales (sección 4.2)
  });

  final String title;
  final Color brandSeed;
  final RouterConfig<Object> router;
  final bool useDynamicColor;

  static void prepare() {
    WidgetsFlutterBinding.ensureInitialized();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarContrastEnforced: false,
    ));
  }

  ColorScheme _scheme(Color seed, Brightness b, double contrast) =>
      ColorScheme.fromSeed(seedColor: seed, brightness: b, contrastLevel: contrast);

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(builder: (lightDyn, darkDyn) {
      final dynamicOn = useDynamicColor && lightDyn != null && darkDyn != null;
      final seed = dynamicOn ? lightDyn!.primary : brandSeed;
      final light = dynamicOn ? lightDyn!.harmonized() : _scheme(seed, Brightness.light, 0);
      final dark = dynamicOn ? darkDyn!.harmonized() : _scheme(seed, Brightness.dark, 0);

      return MaterialApp.router(
        title: title,
        routerConfig: router,
        themeMode: ThemeMode.system,
        theme: NTheme.build(light),
        darkTheme: NTheme.build(dark),
        highContrastTheme: NTheme.build(_scheme(seed, Brightness.light, 1)),
        highContrastDarkTheme: NTheme.build(_scheme(seed, Brightness.dark, 1)),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const [Locale('es'), Locale('en')],
        builder: (context, child) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          // Los componentes M3E leen su propio tema: se alimenta con la misma semilla.
          return m3e.M3ETheme(
            data: isDark
                ? m3e.M3EThemeData.dark(seedColor: seed)
                : m3e.M3EThemeData.light(seedColor: seed),
            child: child!,
          );
        },
      );
    });
  }
}

// En cada app:
// void main() {
//   NApp.prepare();
//   runApp(NApp(title: 'Caja', brandSeed: const Color(0xFF0B57D0), router: appRouter));
// }
```

### 14.8 Resorte con rebote real

Un `AnimationController` normal recorta los valores entre 0 y 1, así que el rebote de los resortes espaciales se pierde. Para animaciones espaciales se usa un controlador sin límites:

```dart
late final _c = AnimationController.unbounded(vsync: this, value: 1);

void _press()   => _c.animateWith(SpringSimulation(NMotion.expressiveFastSpatial, _c.value, 0.94, 0));
void _release() => _c.animateWith(SpringSimulation(NMotion.expressiveFastSpatial, _c.value, 1.0, 0));

// build: ScaleTransition(scale: _c, child: …) dentro de un RepaintBoundary
```

## 15. Gobernanza

El sistema **gravital-experience-ui** vive en un solo repositorio con versionado semántico, un catálogo visual y pruebas automáticas que bloquean cualquier pantalla que se salga del estilo. Ninguna app ni pantalla Flutter (previa o futura) se publica si no pasa el checklist estricto de esta sección.

### 15.1 Repositorio

```text
design-system/
├── tokens/                        # tokens.json (formato W3C) + generadores Dart y CSS
├── packages/
│   └── gravital_experience_ui/    # tema, tokens.g.dart, componentes, adaptadores, fuentes
├── catalog/                       # previews y galería de componentes
└── apps/                          # opcional: apps en el mismo workspace
```

- **Workspace nativo de pub** (Dart 3.6+): un `pubspec.yaml` raíz con `workspace:` en lugar de herramientas externas.
- **Versionado:** cambio de token visible = versión menor; renombrar o quitar un token o un parámetro de componente = versión mayor. Cada app fija `^x.y.0`.
- **Changelog** obligatorio en cada versión, con capturas antes/después cuando cambie algo visual.

### 15.2 Catálogo y pruebas

- **Catálogo:** Flutter Widget Previews (estable desde Flutter 3.47) para cada componente, con `PreviewThemeData` en capas para ver claro, oscuro y alto contraste.
- **Golden tests** de cada componente y de cada pantalla tipo en la matriz: claro / oscuro / alto contraste × compact / expanded × texto 100 % / 200 %. Se ejecutan en CI Linux con la fuente empaquetada.
- **Pruebas de accesibilidad** de la sección 13.1 en todas las pantallas del catálogo.
- **Lint de imports:** CI falla si una app importa `package:flutter/material.dart` o `material_3_expressive`.

### 15.3 Checklist de revisión estricta de cada pantalla

- [ ] Sin colores, radios, espacios ni duraciones literales; todo sale de tokens o roles de **gravital-experience-ui**
- [ ] Un solo botón filled (acción principal) por pantalla
- [ ] Funciona en compact y expanded, en vertical y horizontal
- [ ] Texto al 200 % sin cortes ni superposiciones
- [ ] Revisada en claro, oscuro y alto contraste
- [ ] Fondos borde a borde; contenido interactivo dentro de áreas seguras
- [ ] Retroceso predictivo intacto; `PopScope` solo con cambios sin guardar
- [ ] Estados de carga, vacío, error y sin conexión implementados
- [ ] Montos con `MoneyText`; estados con `StatusChip`
- [ ] Iconos interactivos con etiqueta; color nunca es el único indicador
- [ ] Movimiento reducido respetado; una sola vibración por gesto
- [ ] Golden tests y pruebas de accesibilidad en verde

### 15.4 Orden de adopción (interfaces previas y futuras)

1. Tokens y tema (`NTheme`, colores semánticos, tipografía, resortes).
2. Componentes oficiales de `material_ui` tematizados.
3. Adaptadores M3E para lo que falta.
4. Componentes de dominio (dinero, comercio, mapas, mensajería).
5. Migrar las interfaces previas de la app activa y alinear el sistema con lo aprendido.
6. Construir todas las interfaces futuras directamente sobre **gravital-experience-ui**.

## 16. Correcciones al documento base

El documento de investigación previo acierta en la dirección general (HCT, contención tonal, resortes, borde a borde), pero tiene errores que romperían la implementación o la fidelidad visual. Este plano los sustituye así:

| Documento base | Corrección |
| --- | --- |
| Contenedores con «squircles» de 24 a 32 dp | M3 usa esquinas circulares con una escala de 10 tokens (4 a 48 dp y full). Las tarjetas son de 12 dp, los diálogos de 28 (sección 6.1) |
| Se eliminan por completo las sombras | La elevación por defecto es 0, pero FAB, menús y toolbar flotante sí llevan sombra |
| La barra de navegación inferior pasa a ser una píldora flotante | En M3E la barra de navegación sigue existiendo; lo flotante es la **toolbar** de acciones. Una píldora flotante como navegación principal no es el patrón de **gravital-experience-ui** |
| `material_color_utilities` y `fromImageProvider` dan «la misma fidelidad que Monet» | La versión Dart implementa la especificación de color 2021; Android 16+ genera con la de 2025. El resultado es parecido, no idéntico (sección 4.1) |
| `GoogleFonts.openSansTextTheme()` «alineado con Google Sans Flex» | Open Sans es otra fuente. Se empaqueta el TTF variable de Google Sans Flex (sección 5.1) |
| `dynamic_color: ^1.8.1`, `m3e_design`, `m3e_collection` | `dynamic_color` va en 2.1.0 y depende de `material_ui`; `m3e_collection` no se publica desde nov 2025 ni declara iOS/web. Ver sección 2 |
| `import 'package:flutter/material.dart'` | Desde Flutter 3.47 se usa `package:material_ui/material_ui.dart`; la copia del SDK se depreca en noviembre 2026 |
| `CardTheme(...)` dentro de `ThemeData` | `ThemeData.cardTheme` recibe `CardThemeData` |
| `colors.shadow.withOpacity(0.05)` | `withOpacity` está obsoleto; usar `withValues(alpha: 0.05)` |
| Barra con `SpringSimulation(…)` | El controlador nunca se conecta a ningún widget, así que no anima nada; además es acotado (0–1) y recorta el rebote. Y `damping: 12.5` con rigidez 175 equivale a un ratio de \~0.47, mucho más rebotón que cualquier token M3 (0.6 a 1.0). Ver secciones 7.1 y 14.8 |
| Indicador de la barra con `Curves.fastOutSlowIn` | Contradice el propio documento; los cambios espaciales usan resortes |
| `statusBarIconBrightness: Brightness.dark` fijo | Deja iconos oscuros sobre fondo oscuro en modo oscuro; el color de los iconos lo decide el tema o la app bar |
| `PopScope` informa «en tiempo de compilación» | `canPop` se lee en ejecución, antes de que empiece el gesto; por eso debe estar calculado de antemano |
| `RepaintBoundary` «mandatorio» y «120 Hz estables» por Impeller | Impeller elimina el jank de compilación de shaders; los 120 Hz dependen del trabajo de cada cuadro. `RepaintBoundary` se recomienda solo para animaciones continuas |
| Detalles internos de SystemUI (DMABuf, SurfaceFlinger) | No afectan el diseño de una app de terceros; quedan fuera del plano |

## 17. Fuentes

Páginas consultadas para este plano (revisadas el 12 oct 2026):

**Flutter y paquetes**

- [What’s new in Flutter 3.47](https://flutter.dev/blog/whats-new-in-flutter-3-47) — `material_ui` / `cupertino_ui` 1.0, Impeller en escritorio, mínimos iOS 15 y SDK Android 36.
- [What’s new in Flutter 3.44](https://flutter.dev/blog/whats-new-in-flutter-3-44) — congelamiento de Material, `displayCornerRadii`, accesibilidad web.
- [material\_ui — changelog](https://pub.dev/packages/material_ui/changelog) — `StyleVariant`, IconButton M3E, niveles de contraste.
- [dynamic\_color — changelog](https://pub.dev/packages/dynamic_color/changelog)
- [material\_color\_utilities — changelog](https://pub.dev/packages/material_color_utilities/changelog)
- [material\_3\_expressive](https://pub.dev/packages/material_3_expressive)
- [m3e\_collection](https://pub.dev/packages/m3e_collection)

**Tokens oficiales de Material (código fuente de Jetpack Compose)**

- [ExpressiveMotionTokens.kt](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt)
- [StandardMotionTokens.kt](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/StandardMotionTokens.kt)
- [MotionTokens.kt](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt) — duraciones y curvas.
- [ShapeTokens.kt](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ShapeTokens.kt)
- [TypeScaleTokens.kt](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/TypeScaleTokens.kt)

**Android y gravital-experience-ui**

- [Cambios de comportamiento de Android 16](https://developer.android.com/about/versions/16/behavior-changes-16) — borde a borde obligatorio, retroceso predictivo por defecto, orientación en pantallas grandes.
- [Jetpack WindowManager 1.5 is stable](https://developer.android.com/blog/posts/jetpack-window-manager-1-5-is-stable) — clases Large y Extra-large.
- [Material 3 Expressive updates in gravital-experience-ui](https://blog.google/intl/en-in/products/hardware/material-3-expressive-updates-in-the-latest-pixel-drop/) — Google, 4 sep 2025.
- [Android 17 rollout begins for gravital-experience-ui](https://nokiamob.net/2026/06/17/android-17-rollout-begins-for-pixel-the-list-of-eligible-devices/) — Nokiamob, 17 jun 2026.
- [Google adding blur to Android 17’s system UI on gravital-experience-ui](https://9to5google.com/2026/01/25/android-17-blur/) — 9to5Google, 25 ene 2026.

**Tipografía**

- [Google Sans Flex — METADATA.pb (repositorio google/fonts)](https://raw.githubusercontent.com/google/fonts/main/ofl/googlesansflex/METADATA.pb) — ejes y rangos oficiales.
- [Google’s versatile Sans Flex font is now free to the public](https://www.androidauthority.com/google-sans-flex-free-3617034/) — Android Authority, 18 nov 2025.
