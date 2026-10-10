# output — binarios compilados

Destino de los builds de release de `flutter_app` (y en el futuro, de herramientas CLI si las hubiera). **Vacío a propósito**: nada aquí se compila a mano ni se versiona salvo este README; CI (F02.7, F22.5) copia los artefactos firmados con su `SHA256SUMS`.

| Plataforma | Comando (desde `flutter_app/`) | Artefacto copiado aquí |
|---|---|---|
| Android | `flutter build apk --release --split-per-abi --dart-define=FLAVOR=prod --dart-define=API_BASE_URL=https://api.<dominio>` y `flutter build appbundle` | `android/plentypay-<ver>-<abi>.apk`, `.aab` |
| iOS | `flutter build ipa --release ...` (runner macOS, certificados en CI) | `ios/plentypay-<ver>.ipa` |
| macOS | `flutter build macos --release ...` + notarización | `macos/PlentyPay-<ver>.dmg` |
| Linux | `flutter build linux --release ...` | `linux/plentypay-<ver>-x64.tar.gz` (+ deb/AppImage en F25.5) |
| Windows | `flutter build windows --release ...` | `windows/plentypay-<ver>-x64.zip` (+ MSIX en F25.5) |
| Web | `flutter build web --release ...` | `web/plentypay-web-<ver>.tar.gz` (el contenedor `web` lo sirve desde `web/static/app/`) |

Reglas: prod siempre con `https`; firmas y llaves nunca en el repo; cada artefacto con checksum; APK ≤ 40 MB por ABI.
