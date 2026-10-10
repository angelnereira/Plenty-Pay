# SPEC — web

## 1. Responsabilidad
Servidor estático en Go que entrega: (a) la **app Flutter Web** (bundle construido por CI desde `flutter_app/` y colocado en `web/static/app/`, no versionado — ADR 0016); (b) páginas públicas ligeras sin login: enlace de pago `/t/<code>` (abre la app o tiendas), seguimiento `/track/<token>` (renderizado del lado del servidor consultando `api-gateway`), páginas legales; (c) archivos de deep links `/.well-known/assetlinks.json` y `/.well-known/apple-app-site-association`; (d) proxy de medios públicos `/media/*` hacia `pp-catalog-media`.

## 2. Ficha
Go · puerto 8081 (publicado) · admin 9100 · sin base de datos · Fase F22 (estructura y deep links), F23 (pay links), F18/F25 (tracking) · Capa L5.

## 3. Reglas
- **R1** Cabeceras: CSP estricta (`default-src 'self'`; `connect-src` al dominio del gateway), HSTS, `X-Frame-Options: DENY`, caché inmutable para assets con hash y `no-cache` para `index.html`.
- **R2** Páginas públicas sin datos personales; tracking muestra solo lo que devuelve `GetPublicTracking`.
- **R3** `/t/<code>` valida el regex del código antes de cualquier llamada.
- **R4** Sin bundle presente (`static/app/` vacío) responde una página de mantenimiento clara, no 500.
- **R5** Plantillas HTML con `html/template` (escape automático).

## 4. Configuración
`WEB_HTTP_ADDR` (`:8081`), `GATEWAY_PUBLIC_URL`, `GATEWAY_INTERNAL_ADDR`, `ANDROID_APP_FINGERPRINTS`, `APPLE_TEAM_ID`, `MEDIA_BUCKET_URL`.

## 5. Plan
F02.8 servidor estático + bundle Flutter Web → F18.6 seguimiento público → F22.3 deep links (`.well-known`) → F23.5 enlaces de pago `/t/<code>`.
