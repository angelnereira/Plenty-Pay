# ADR 0019 — Descubrimiento de la URL pública del gateway

- **Estado**: Aceptada (enmienda ADR 0015)
- **Fecha**: 2026-10-20
- **Decisores**: dirección técnica de PlentyPay

## Contexto
La máquina de producción publica `api-gateway` con un túnel rápido de Cloudflare
(`docker-compose.yml`, servicio `tunnel`), sin cuenta ni dominio propio. Su URL
(`https://<palabras>.trycloudflare.com`) **cambia cada vez que el contenedor se reinicia**. Hasta
hoy esa URL iba incrustada en el build de la app, así que un reinicio dejaba a todas las apps
instaladas sin servidor: el 2026-10-20 Docker Desktop reinició todos los contenedores y la URL
incrustada en v0.2.3 empezó a responder 530; la app se veía vacía y con avisos de «no disponible».

## Decisión
1. La app obtiene la URL del gateway de un **documento de descubrimiento público y estático** en
   una dirección estable: `https://angelnereira.github.io/Plenty-Pay/server.json`
   (`--dart-define=PP_DISCOVERY_URL` lo cambia). Contenido: `{"api_base_url": "https://…"}`.
   No lleva datos de usuarios, credenciales ni lógica; no es un servicio de negocio, así que ADR
   0015 se mantiene: todo el tráfico de la app sigue yendo solo al gateway.
2. Orden de resolución al arrancar: URL manual de desarrollo → descubrimiento (espera máxima 4 s)
   → última URL descubierta (guardada en el almacenamiento seguro) → URL del build.
3. La URL descubierta se valida igual que la del build (`AppConfig.resolve`: https fuera de dev) y
   además su host debe estar en la lista permitida (`*.trycloudflare.com`, `plentypay.app`): un
   documento alterado no puede mandar la app a otro dominio.
4. Si el gateway deja de responder en plena sesión (error de conexión, o 502/530/1033 del túnel), el
   cliente vuelve a descubrir una vez cada 30 s y, si la URL cambió, reintenta la petición en la
   nueva. Es seguro reintentar: las mutaciones llevan `Idempotency-Key` (AGENTS §2.8).
5. En el servidor, `scripts/publish-server-url.sh` lee la URL vigente del túnel, comprueba que
   `/healthz` responde y, si difiere de la publicada, actualiza `server.json` en la rama
   `gh-pages`. Lo corre un temporizador de systemd del usuario cada 2 minutos y también
   `publish-release.sh` (que reescribe `gh-pages` completo).
6. Una URL antigua de `*.trycloudflare.com` guardada como «URL manual» se descarta al arrancar: los
   túneles rápidos son efímeros y solo el descubrimiento los conoce.
7. **Vigilancia del túnel (2026-10-22)**. Un túnel rápido puede quedar en «Tunnel not found» con
   `cloudflared` vivo y reintentando para siempre: Docker no lo reinicia y las apps quedan sin
   servidor (ocurrió el 2026-10-22). `publish-server-url.sh` cuenta las revisiones en que la URL
   vigente no responde mientras el gateway sí responde en local; a la segunda seguida (~4 min)
   reinicia el contenedor `tunnel`, espera la URL nueva y la publica. Si el gateway no responde en
   local, no toca el túnel. El contador vive en `~/.local/state/plentypay/` y el umbral se cambia
   con `PP_TUNNEL_MAX_FAILS`. Ningún valor de red queda fijo en la app de producción: la URL del
   build es solo el último respaldo (la inyecta `build-release.sh`) y las compilaciones de
   desarrollo apuntan a `localhost`.

## Consecuencias
+ Un reinicio del túnel deja de romper las apps instaladas: se recuperan solas en ~2–3 minutos
  (temporizador + caché de GitHub Pages).
+ Un túnel muerto se reinicia solo (§7): la caída se resuelve en ~5–10 minutos sin intervención.
+ No hace falta publicar un release solo porque cambió la URL.
− Depende de GitHub Pages para el primer arranque tras un cambio; si no responde, la app usa la
  última URL conocida.
− Las versiones ≤ 0.2.3 no saben descubrir: hay que instalar la versión que trae este cambio.

## Alternativas consideradas
Túnel con nombre de Cloudflare y dominio propio (la solución definitiva: URL fija; requiere la
cuenta de Cloudflare del dueño, pendiente); pedir a cada usuario que escriba la URL (inaceptable);
publicar un release por cada reinicio (lento y deja apps rotas mientras tanto).
