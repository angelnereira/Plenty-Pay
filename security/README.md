# security

Secretos, cifrado por propósito, auditoría encadenada, bloqueos y certificados mTLS. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Go + OpenBao |
| Puerto | 50073 (admin `:9100` en servicios propios) |
| Fase del roadmap | F05 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Código | ✅ F05.1–F05.6 (secretos, ACL, transit, auditoría encadenada, bloqueos, PKI) | Estructura Go estándar (`internal/{client,config,domain,observability,server,service,store}`) |
| Pruebas | ✅ 25 pruebas pasando con `-race` | `go test -v -race ./...` (observabilidad, servidor gRPC, reglas de negocio R1–R5, R7 y cliente OpenBao) |
| Imagen Docker | ✅ Construida y corriendo | Distroless Debian 12 nonroot; OpenBao 2.2.0 fijado por digest criptográfico en `docker-compose.yml` |

## Arranque local
Forma parte del sistema local en `docker-compose.yml` (puerto gRPC 50073 en red interna `services`, OpenBao en 8200 en red interna `data`, admin en `:9100`).
```bash
docker compose up -d openbao security
```

## Desarrollo
Regenerar contratos si cambia `security.proto`:
```bash
./scripts/sync-protos.sh
```
Ejecutar pruebas locales:
```bash
cd security && go vet ./... && go test -v -race ./...
```

