# output/ — Artefactos compilados (mandato §19, obligatorio)

| Plataforma | Estado | Nota |
|---|---|---|
| android/plentypay.apk | BLOCKED-LOCAL | Requiere CI x64 (Flutter SDK sin release arm64 Linux; host actual arm64) |
| linux/ (desktop) | BLOCKED-LOCAL | Ídem; ejecutable Linux del backend sí corre aquí |
| windows/, ios/ | BLOCKED-TOOLCHAIN | Requieren runners nativos (CI) |

Los artefactos que SI se generan localmente (binarios backend) se publican aquí a medida que se construyen. Regla: NO declarar plataforma terminada sin artefacto o limitación de toolchain documentada (§19).
