# flutter_app — cliente único PlentyPay

Una sola app para Android, iOS, Linux, Windows, macOS y Web (ADR 0009). Habla **solo** con `api-gateway` (ADR 0015). Estándar: `docs/standards/flutter-standards.md`; pantallas: `docs/ux/screen-catalog.md`; tokens: `docs/design-system.md`.

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 base multiplataforma: proyectos nativos de las 6 plataformas, flavors dev/staging/prod, i18n `es_PA`/`en`, tema claro/oscuro con tokens, sesión segura, ApiClient con refresh único, login/registro, shell con navegación dinámica por `enabled_modules`, registro de 12 módulos | F02.3 |
| Pruebas | L1: `flutter analyze` sin issues y `flutter test` 19/19 (flavors, i18n, registro de módulos) con Flutter 3.47.6 | 2026-10-10 |
| Compila | Web (`flutter build web`) y Android (`flutter build apk --debug`) | 2026-10-10 |
| No verificado | Linux: falta `libsecret-1-dev` en la máquina de desarrollo (ver Requisitos). iOS/macOS requieren un Mac; Windows requiere Windows | — |
| Builds en `output/` | 📋 | F02.7 |

Versión de Flutter fijada: **3.47.6** (estable), Dart ≥ 3.6.

## Arranque
```bash
cd flutter_app
flutter pub get            # también regenera lib/core/l10n/generated (generate: true)
flutter analyze && flutter test
flutter run -d chrome --dart-define=FLAVOR=dev --dart-define=API_BASE_URL=http://localhost:8080
```
Con el sistema local arriba (`docker compose up --build` en la raíz) se puede registrar un usuario y ver los módulos `Billetera` y `Comprar`. En el emulador de Android el gateway local es `http://10.0.2.2:8080`.

Las carpetas nativas se generaron con `flutter create --platforms=android,ios,linux,windows,macos,web --project-name plentypay --org app.plentypay .` y están versionadas.

## Requisitos por plataforma
- **Linux**: además de la cadena de Flutter (clang, cmake, ninja, GTK 3), `sudo apt install libsecret-1-dev libjsoncpp-dev` (los exige `flutter_secure_storage`).
- **Android**: SDK con plataforma 34+; `minSdk` 24.
- **iOS** 15.0 / **macOS** 12: Xcode en un Mac.

## Flavors (`lib/core/config/app_config.dart`)
Se eligen con `--dart-define` (estándar §15), sin flavors nativos:

| Flavor | `API_BASE_URL` | Regla |
|---|---|---|
| `dev` (por defecto) | `http://localhost:8080` | http permitido |
| `staging` | https de staging | http rechazado |
| `prod` | https de producción | http rechazado |

`AppConfig.fromEnvironment()` se ejecuta al arrancar y lanza `StateError` si el flavor no existe, la URL es inválida o un flavor que exige https recibe http. En Android el tráfico en claro solo está habilitado en builds de depuración.

## Idiomas (`lib/core/l10n/`)
ARB con `app_es.arb` como plantilla, `app_es_PA.arb` (variante de Panamá, hereda de `es`) y `app_en.arb`. Por defecto `es_PA`: un idioma de dispositivo no soportado cae a español. Para agregar un texto: clave en `app_es.arb` y en `app_en.arb` (una prueba exige que tengan las mismas claves) → `flutter gen-l10n` → commitear `generated/`. Los `reason` de error del gateway usan claves `error_<REASON>`.

## Permisos nativos
- Android (`AndroidManifest.xml`): `INTERNET`, `CAMERA`, `NFC`, `USE_BIOMETRIC`, `ACCESS_FINE_LOCATION`; cámara, NFC y GPS declarados como hardware opcional.
- iOS (`Info.plist`): `NSCameraUsageDescription`, `NFCReaderUsageDescription`, `NSFaceIDUsageDescription`, `NSLocationWhenInUseUsageDescription`.
- macOS: entitlement `com.apple.security.network.client`.
- **Pendiente**: entitlement NDEF de iOS (`com.apple.developer.nfc.readersession.formats`); requiere Xcode y el perfil de aprovisionamiento, se agrega con el lector NFC en F23.2.
- **Por decidir antes de publicar (F25.5)**: el identificador de la app quedó como `app.plentypay.plentypay` (el que genera el comando documentado). No se puede cambiar una vez publicada en las tiendas.

## Estructura
`lib/core/` (config, api, l10n, session, theme) · `lib/features/<módulo>/` (data, domain, application, presentation — §3 del estándar). Hoy solo `auth`, `shell`, `modules`.

## Builds de release
Ver `../output/README.md`.

## Dependencias
Hoy: `http`, `flutter_secure_storage`, `flutter_localizations`, `intl`. Las aprobadas para el resto están en el estándar §2; F02.5 migra `http` → `dio`.
