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
| Buckets y llaves | ✅ | 6 buckets del SPEC §3 y 11 llaves (una por contenedor) aplicados de forma idempotente por `scripts/init-buckets.sh`; cada llave solo llega a sus buckets |
| Imagen Docker | ✅ | Dockerfile multi-stage (`dxflrs/garage` + busybox), saludable en Compose con hardening (read_only, cap_drop ALL, no-new-privileges) |
| Pruebas | ✅ | `./object-storage/test/test_s3_api.sh` (13/13, F07.8) y `./object-storage/test/test_buckets_keys.sh` (29/29, F07.9) — incluyen operaciones S3 reales firmadas con SigV4 |

## Arranque local
```bash
docker compose up -d object-storage    # aplica layout, buckets y llaves al arrancar
```

## Cliente S3 de prueba
`s3cli.mjs` (herramienta de prueba, no despliegue): firma SigV4 con la stdlib de
Node y habla con la API de Garage. Las pruebas lo usan para verificar permisos
reales (criterio de F07.9: *la llave de catalog no lee pp-fiscal*).

## Pruebas
```bash
./object-storage/test/test_s3_api.sh
./object-storage/test/test_buckets_keys.sh
```

## Limitaciones conocidas
- **Sin "escribir sin borrar"**: Garage v2.4 no permite distinguir borrado de objeto a nivel de llave (`DeleteObject` es escritura), así que la retención "sin borrado" de `pp-fiscal` (SPEC §3) no se puede expresar con permisos. Pendiente de resolver en F13 (política en el contenedor dueño o job de retención).
- **Secretos de desarrollo**: `GARAGE_RPC_SECRET` y `GARAGE_ADMIN_TOKEN` se pasan por entorno con valores ficticios solo para Compose. En producción los inyecta OpenBao (F28.4). Los secretos de las llaves de servicio se consultan con `garage key info --show-secret <llave>` y en F28 se guardan cifrados en `security`.
- Compose corre 1 nodo con RF=1 y 1 GB declarado; producción (F27) despliega 3 nodos, RF=3 y 3 zonas (SPEC §4 R3).
- El binario corre sobre busybox (no distroless como la imagen original) porque el entrypoint y los scripts necesitan shell; el contenedor mantiene el resto del endurecimiento.
- El acceso público de `pp-catalog-media` vía `web`/CDN y el rechazo por tipo/tamaño máximo llegan con F07.10 (URLs prefirmadas).
