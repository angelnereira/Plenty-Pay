# flutter_app — cliente único PlentyPay

Una sola app para Android, iOS, Linux, Windows, macOS y Web (ADR 0009). Habla **solo** con `api-gateway` (ADR 0015). Estándar: `docs/standards/flutter-standards.md`; pantallas: `docs/ux/screen-catalog.md`; tokens: `docs/design-system.md`.

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | 📝 esqueleto: tema claro/oscuro con tokens, sesión segura, ApiClient con refresh único, login/registro, shell con navegación dinámica por `enabled_modules`, registro de 12 módulos | — |
| Pruebas | 📝 `test/module_registry_test.dart` escrito | **no ejecutado**: el entorno de generación no tenía SDK de Flutter |
| Builds en `output/` | 📋 | F02.7 |

## Primer arranque (F02.3)
Las carpetas nativas (`android/`, `ios/`, `linux/`, `windows/`, `macos/`, `web/`) no se versionaron todavía; se generan sin tocar `lib/`:
```bash
cd flutter_app
flutter create --platforms=android,ios,linux,windows,macos,web --project-name plentypay --org app.plentypay .
flutter pub get
flutter analyze && flutter test
flutter run -d linux --dart-define=FLAVOR=dev --dart-define=API_BASE_URL=http://localhost:8080
```
Con el sistema local arriba (`docker compose up --build` en la raíz) se puede registrar un usuario y ver los módulos `Billetera` y `Comprar`.

Permisos nativos que F02.3 debe agregar: Android `INTERNET`, `CAMERA`, `NFC`, `USE_BIOMETRIC`, `ACCESS_FINE_LOCATION` (solo en turno); iOS `NSCameraUsageDescription`, `NFCReaderUsageDescription` + entitlement NDEF, `NSFaceIDUsageDescription`, `NSLocationWhenInUseUsageDescription`.

## Estructura
`lib/core/` (config, api, session, theme) · `lib/features/<módulo>/` (data, domain, application, presentation — §3 del estándar). Hoy solo `auth`, `shell`, `modules`.

## Builds de release
Ver `../output/README.md`.

## Dependencias
Esqueleto: `http`, `flutter_secure_storage`. Las aprobadas para el resto están en el estándar §2; F02.5 migra `http` → `dio`.
