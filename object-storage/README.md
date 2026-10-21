# object-storage

Imágenes, documentos fiscales, recibos, exportes y respaldos. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Garage v2.4.1 (S3-compatible, AGPL-3.0) |
| Puertos | 3900 (S3 API), 3901 (RPC, interno), 3903 (admin, interno) |
| Fase del roadmap | F07 (F07.8) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Nodo + layout | ✅ | Garage v2.4.1 sobre busybox (imagen propia, binario estático, ambas imágenes por digest) en Compose con volumen `garage-data`; layout v1 aplicado de forma idempotente al arrancar (nodo único, zona `dc1`, RF=1) |
| API S3 | ✅ | Responde en `:3900` con XML S3 válido (región `garage`); acceso anónimo rechazado con `AccessDenied` — las cargas se harán por URL prefirmada (F07.10) |
| API admin | ✅ | Responde 200 en `:3903/health` con token (solo desarrollo inyectado por compose) |
| Buckets y llaves | ✅ | 6 buckets del SPEC §3 y 11 llaves (una por contenedor) aplicados de forma idempotente por `scripts/init-buckets.sh`; cuota de tamaño por bucket (`set-quotas`) como segunda barrera |
| Imagen Docker | ✅ | Dockerfile multi-stage (`dxflrs/garage` + busybox), saludable en Compose con hardening (read_only, cap_drop ALL, no-new-privileges) |
| Pruebas | ✅ | 49/49 aserciones: `test_s3_api.sh` (13, F07.8), `test_buckets_keys.sh` (29, F07.9) y `test_presigned_quotas.sh` (7, F07.10) — incluyen operaciones S3 reales firmadas con SigV4 |

## Arranque local
```bash
docker compose up -d object-storage    # aplica layout, buckets y llaves al arrancar
```

## Cliente S3 de prueba
`s3cli/` (herramienta de prueba, no despliegue): cliente Go con **stdlib pura**
(net/http + crypto/hmac) que firma SigV4 y habla con la API de Garage. El script
lo compila (`CGO_ENABLED=0 go build`) y lo ejecuta dentro de la red de Compose
vía busybox. Las pruebas verifican permisos reales con él (criterio de F07.9:
*la llave de catalog no lee pp-fiscal*).

## URLs prefirmadas
Referencia para los contenedores dueños (endpoint, estilo path-style, llaves por
servicio, tipos MIME válvula, tamaños máximos por objeto y por bucket, expiración
de 10 min): [`presigned-reference.md`](presigned-reference.md) (F07.10).

## Pruebas
```bash
./object-storage/test/test_s3_api.sh              # F07.8 — API S3 responde (13)
./object-storage/test/test_buckets_keys.sh         # F07.9 — llaves por bucket (29)
./object-storage/test/test_presigned_quotas.sh    # F07.10 — válvula de tamaño (7)
```

## Limitaciones conocidas
- **Sin "escribir sin borrar"**: Garage v2.4 no permite distinguir borrado de objeto a nivel de llave (`DeleteObject` es escritura), así que la retención "sin borrado" de `pp-fiscal` (SPEC §3) no se puede expresar con permisos. Pendiente de resolver en F13 (política en el contenedor dueño o job de retención).
- **Secretos**: `GARAGE_RPC_SECRET` y `GARAGE_ADMIN_TOKEN` viven en `object-storage/.env` (no versionado; plantilla `.env.example`), y la llave S3 del gateway en `api-gateway/.env`. Rotados el 2026-10-21: los valores anteriores estaban como valores por defecto en `docker-compose.yml` de un repositorio público y los puertos 3900/3903 estaban publicados en todas las interfaces; desde entonces solo escuchan en `127.0.0.1`. En producción los inyectará OpenBao (F28.4).
- Compose corre 1 nodo con RF=1 y 1 GB declarado; producción (F27) despliega 3 nodos, RF=3 y 3 zonas (SPEC §4 R3).
- El binario corre sobre busybox (no distroless como la imagen original) porque el entrypoint y los scripts necesitan shell; el contenedor mantiene el resto del endurecimiento.
- El acceso público de `pp-catalog-media` vía `web`/CDN y el rechazo por tipo/tamaño máximo llegan con F07.10 (URLs prefirmadas).
