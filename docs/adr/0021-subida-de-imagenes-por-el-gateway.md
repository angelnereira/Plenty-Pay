# ADR 0021 — Subida de imágenes del catálogo a través del gateway

- **Estado**: Aceptada (enmienda `catalog/SPEC.md` CreateUploadUrl y `api-gateway/SPEC.md` `/v1/catalog/upload-url`)
- **Fecha**: 2026-10-21
- **Decisores**: dirección técnica de PlentyPay

## Contexto
El SPEC de catalog prevé que el cliente pida una URL prefirmada (`CreateUploadUrl`) y suba la foto
directamente a object-storage. En producción solo `api-gateway` es alcanzable desde las apps (túnel
de Cloudflare, ADR 0019): una URL prefirmada apunta a `object-storage:3900`, que el teléfono no puede
resolver. Desde el 2026-10-20 el gateway ya sube las fotos (`POST /v1/media/upload`) y las sirve
(`GET /media/<clave>`), pero sin estar documentado, a cualquier sesión, hasta 10 MB y aceptando GIF.

## Decisión
1. Mientras object-storage no tenga un dominio público propio (Q-39), las fotos de productos se
   suben por `POST /v1/media/upload` del gateway, que las escribe en `pp-catalog-media` con su llave
   y las entrega por `GET /media/<clave>`.
2. Mismas reglas que `CreateUploadUrl` (catalog SPEC §4, R6): exige `catalog:write` y un negocio
   (`x-pp-tenant-id`); JPEG, PNG o WebP verificados por los bytes del archivo; ≤ 5 MB; la clave la
   genera el servidor (`<tenant>/<año>/<aleatorio>.<ext>`), nunca el cliente; errores
   `UNSUPPORTED_FILE_TYPE` y `FILE_TOO_LARGE`.
3. catalog sigue siendo el dueño del producto: guarda las claves en `image_object_keys`.
4. `CreateUploadUrl` queda para cuando el almacenamiento sea público; no se borra del contrato.

## Consecuencias
- El gateway mantiene una llave S3 de escritura solo sobre `pp-catalog-media`.
- La verificación de tipo es en línea (bytes mágicos); el antivirus de R6 sigue pendiente (F15.2).
- Servir solo objetos publicados (object-storage SPEC) sigue pendiente: hoy `GET /media/` entrega
  cualquier clave de `pp-catalog-media`, que solo contiene fotos de productos.
