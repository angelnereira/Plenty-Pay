# Sistema de diseño PlentyPay (2026)

> **Regla de diseño estricta (`gravital-experience-ui`)**: El plano maestro y regla estricta obligatoria para construir, actualizar y diseñar todas las interfaces Flutter previas y futuras está en [`docs/gravital-experience-ui.md`](gravital-experience-ui.md) (**gravital-experience-ui** — M3 Expressive). Los tokens base actuales en `flutter_app/lib/core/theme/` que se listan abajo se mantienen sincronizados con `app_theme.dart` (`check-docs.sh` compara los hex) y se rigen bajo las reglas arquitectónicas, de movimiento, forma, tipografía y el checklist de revisión (§15.3) de [`docs/gravital-experience-ui.md`](gravital-experience-ui.md).

Estilo: **moderno, sobrio, de banca**: grises oscuros y claros con **rojo** como único color de acento. Material 3 Expressive (`gravital-experience-ui`) como base técnica, personalizado con estos tokens. Implementación: `flutter_app/lib/core/theme/` (los valores de aquí y de `app_theme.dart` deben coincidir; `check-docs.sh` compara los hex).

## 1. Principios
1. **Claridad del dinero primero**: el monto es el elemento más grande de cualquier pantalla de pago.
2. **Un acento**: el rojo indica la acción principal o el elemento activo — nunca decoración.
3. **Bordes en vez de sombras**: superficies separadas por contorno de 1 px; elevación solo en diálogos y menús.
4. **Estados honestos**: cargando, vacío, error, datos (y "confirmando" para pagos UNKNOWN), nunca pantallas en blanco.
5. **Accesible por defecto**: WCAG 2.2 AA, objetivos ≥ 48 dp, no depender solo del color.

## 2. Color (tokens)

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `primary` | `#D32D2F` | `#D32D2F` | botón primario, indicador activo, foco |
| `primaryPressed` | `#9C191C` | `#9C191C` | estado presionado/hover |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` | texto sobre primario |
| `background` | `#0E0F11` | `#F4F5F6` | fondo de la app |
| `surface` | `#16181B` | `#FFFFFF` | tarjetas, paneles |
| `surfaceHigh` | `#1F2226` | `#ECEEF0` | campos, filas seleccionadas, barras |
| `outline` | `#2A2E33` | `#D9DCE0` | bordes y divisores |
| `textPrimary` | `#ECEDEF` | `#16181B` | texto principal |
| `textMuted` | `#9AA0A6` | `#5F6670` | texto secundario, etiquetas |
| `error` | `#FF6B6B` | `#B3261E` | errores, montos negativos (siempre con icono/signo) |
| `success` | `#4CC38A` | `#1E7F4F` | confirmaciones (uso discreto: icono + texto) |
| `warning` | `#F2B84B` | `#8A5A00` | pendiente/UNKNOWN ("confirmando") |
| `info` | `#9AA0A6` | `#5F6670` | informativo (neutro, sin azul) |
| `successInk` | `#4CC38A` | `#0F5C33` | etiqueta del chip de éxito en claro |
| `warningInk` | `#F2B84B` | `#7A5000` | etiqueta del chip de advertencia en claro |
| `errorInk` | `#FF6B6B` | `#A01B14` | etiqueta del chip de error en claro |

Reglas: el rojo nunca se usa para estados de éxito ni para fondos grandes; los errores usan `error` (distinto del rojo de marca) **con icono y texto**.

Contraste verificado con la fórmula de WCAG 2.x sobre el fondo real de cada componente (`StatusChip` usa el color semántico al 14 % sobre `surface`), comprobado en `flutter_app/test/accessibility/contrast_test.dart`:

| Par | Cociente | Mínimo |
|---|---|---|
| `textPrimary` sobre `background` | ≥ 12:1 | 4.5:1 |
| `onPrimary` sobre `primary` | 5.01:1 | 4.5:1 |
| `onPrimary` sobre `primaryPressed` | 8.18:1 | 4.5:1 |
| `successInk` sobre el fondo del chip de éxito | 5.9:1 | 4.5:1 |
| `warningInk` sobre el fondo del chip de advertencia | 5.2:1 | 4.5:1 |
| `errorInk` sobre el fondo del chip de error | 6.1:1 | 4.5:1 |
| icono del chip sobre su fondo | ≥ 3:1 | 3:1 (WCAG 1.4.11) |

`primary` era un rojo un punto más claro hasta la auditoría F25.1: con ese tono el texto blanco quedaba en **4.23:1** y no cumplía AA, por más que el documento afirmara lo contrario. `successInk`, `warningInk` y `errorInk` existen por lo mismo: la etiqueta del chip se pinta sobre el color semántico al 14 %, y el tono base no llegaba a 4.5:1 (3.81:1 en el caso de éxito).

## 3. Tipografía
Familia: **Inter** (OFL) empaquetada en la app; respaldo del sistema. Cifras **tabulares** (`FontFeature.tabularFigures()`) en todo monto, tabla y contador.

| Estilo | Tamaño / alto de línea | Peso | Uso |
|---|---|---|---|
| `displayMoney` | 40 / 48 | 700 | monto principal de cobro/saldo |
| `headline` | 24 / 32 | 600 | títulos de pantalla |
| `title` | 18 / 26 | 600 | títulos de tarjeta/sección |
| `body` | 15 / 22 | 400 | texto general |
| `label` | 13 / 18 | 500 | etiquetas, chips |
| `caption` | 12 / 16 | 400 | metadatos, ayudas |

## 4. Espaciado, forma y elevación
- Escala de espaciado: 4, 8, 12, 16, 24, 32, 48.
- Radios: **16** (tarjetas, campos, botones), **24** (hojas inferiores, diálogos), 999 (chips/pills).
- Contorno 1 px `outline`; foco 2 px `primary`.
- Elevación: 0 en todo salvo diálogos/menús (sombra suave en claro; en oscuro, `surfaceHigh`).

## 5. Formato de dinero y fechas
- `es_PA`: `$1,234.56` (o `B/. 1,234.56` si el tenant lo prefiere). Negativo: `−$12.00` con color `error`.
- Moneda siempre visible en montos de pago; cifras tabulares.
- Fechas: `10 oct 2026, 2:03 p. m.` (hora de Panamá). **El mes va siempre en texto; nunca una fecha solo con números**, porque el formato regional `es-PA` pone el mes primero y sería ambigua (`docs/compliance/international-standards.md` N-STD-10). Hora de 12 horas por defecto en `es_PA` (N-STD-11). Relativo ("hace 5 min") solo en listas de actividad.

## 6. Componentes (implementar en `core/widgets/` con golden tests claro/oscuro)
| Componente | Reglas |
|---|---|
| `PPButton.primary` | relleno `primary`, 52 dp de alto, **uno por pantalla**; estado cargando reemplaza texto por indicador sin cambiar ancho |
| `PPButton.secondary` | contorno `outline`, texto `textPrimary` |
| `PPButton.text` | sin borde; acciones terciarias |
| `PPTextField` | relleno `surfaceHigh`, radio 16, etiqueta arriba, error debajo con icono |
| `MoneyInput` | teclado numérico que construye centavos; muestra `displayMoney` |
| `MoneyText` | cifras tabulares; signo explícito para negativos |
| `PPCard` | `surface` + contorno; padding 16 |
| `StatusChip` | color semántico + texto (CAPTURED, PENDING, UNKNOWN→"Confirmando", FAILED) |
| `AsyncView` | maneja los 4 estados con esqueletos |
| `EmptyState` | icono lineal, título, texto, acción primaria |
| `ErrorState` | icono, mensaje por `reason`, "Reintentar", request_id copiable |
| `AppShell` | barra inferior (< 600), `NavigationRail` (600–1024), rail extendido (> 1024); indicador activo rojo |
| `PinPad` | PIN de 4–6 dígitos con retroalimentación háptica |
| `QrView` / `QrScannerView` | marco con esquinas rojas; linterna; texto de ayuda |
| `NfcPrompt` | hoja inferior animada "Acerca tu teléfono" con estado |
| `ReceiptView` | recibo imprimible (80 mm) y compartible (PDF) |
| `CustomerDisplay` | tema oscuro forzado, total gigante, líneas y QR de pago |

## 7. Iconografía e ilustración
Material Symbols Rounded (Apache 2.0), peso 400, tamaño 24. Ilustraciones lineales monocromas (`textMuted`) con un detalle `primary`. Logo PlentyPay: wordmark en `textPrimary` con el punto/acento en `primary` (archivo en `flutter_app/assets/brand/`, Fase 22).

## 8. Movimiento
Duraciones 150 ms (micro), 250 ms (transiciones), curvas `easeOutCubic`. Respetar "reducir movimiento" del sistema. Confirmación de pago: check animado ≤ 600 ms + háptico de éxito.

## 9. Tema
`ThemeMode.system` por defecto; el usuario puede forzar claro/oscuro. POS y quiosco pueden fijar oscuro. Customer display siempre oscuro.
