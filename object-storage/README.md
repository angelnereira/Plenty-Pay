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
| Imagen Docker | ✅ | Dockerfile multi-stage (`dxflrs/garage` + busybox), saludable en Compose con hardening (read_only, cap_drop ALL, no-new-privileges) |
| Pruebas | ✅ | `./object-storage/test/test_s3_api.sh` — 13/13 aserciones (API responde, layout idempotente, sobrevive reinicio) |

## Arranque local
```bash
docker compose up -d object-storage    # aplica el layout al arrancar (entrypoint.sh)
```

## Pruebas
```bash
./object-storage/test/test_s3_api.sh
```

## Limitaciones conocidas
- **Buckets y llaves aún no existen** (F07.9: script como código con una llave por contenedor). El layout ya está listo para recibirlos.
- **Secretos de desarrollo**: `GARAGE_RPC_SECRET` y `GARAGE_ADMIN_TOKEN` se pasan por entorno con valores ficticios solo para Compose. En producción los inyecta OpenBao (F28.4).
- Compose corre 1 nodo con RF=1 y 1 GB declarado; producción (F27) despliega 3 nodos, RF=3 y 3 zonas (SPEC §4 R3).
- El binario corre sobre busybox (no distroless como la imagen original) porque el entrypoint y el script de layout necesitan shell; el contenedor mantiene el resto del endurecimiento.
