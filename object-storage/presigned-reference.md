# Referencia — URLs prefirmadas y válvulas de subida (F07.10)

Documento de referencia para los **contenedores dueños** que suban o lean objetos
en `object-storage` (SPEC §4 R2). No es código: es el contrato que deben cumplir
`catalog`, `identity`, `fiscal-invoicing`, `pos`, `payroll`, `logistics`,
`analytics-bi`, `settlement` y los jobs de respaldo.

## 1. Conexión

| Parámetro | Valor |
|---|---|
| Endpoint | `http://object-storage:3900` (interno; nunca público) |
| Región | `garage` (`s3_region` de `garage.toml`) |
| Estilo de URL | path-style (`/<bucket>/<key>`) |
| Cliente Go de referencia | `github.com/aws/aws-sdk-go-v2/service/s3` + `s3.NewPresignClient` |
| Autenticación | SigV4 con la llave del contenedor (una llave, sus buckets) |

Las llaves y sus secretos viven en `security` (cifrados por propósito) desde F28;
en desarrollo se consultan con `garage key info --show-secret <llave>` dentro del
contenedor. **PlentyPay nunca recibe credenciales de objeto del cliente**: la app
siempre habla con `api-gateway`, que es quien emite la URL prefirmada.

## 2. Clave de objeto (SPEC §4 R1)

```
<tenant>/<año>/<uuid>.<ext>
```

La clave la **genera el servidor**: el cliente manda el tipo de contenido y el
tamaño; nunca un nombre de archivo elegido por el usuario. Extensión derivada del
tipo MIME validado (magic bytes), no del nombre recibido.

## 3. Válvulas de subida (R2)

| Válvula | Dónde se aplica | Efecto |
|---|---|---|
| Tipo MIME permitido | contenedor dueño, **antes** de presignar | rechaza con el `reason` del dueño |
| Tamaño máximo por objeto | contenedor dueño, **antes** de presignar | rechaza con el `reason` del dueño |
| Cuota de tamaño del bucket | Garage (`bucket set-quotas`, aplicada por `init-buckets.sh`) | segunda barrera: la escritura que excede la cuota falla en el servidor |
| Magic bytes + antivirus | job posterior del dueño (ClamAV) | marca el objeto para cuarentena |

Tamaños máximos **por objeto** (política del productor, validada antes de
presignar):

| Bucket | Máximo por objeto | Tipos |
|---|---|---|
| `pp-catalog-media` | 10 MiB | `image/jpeg`, `image/png`, `image/webp` |
| `pp-kyb` | 20 MiB | `application/pdf`, imágenes |
| `pp-fiscal` | 5 MiB | `application/xml`, `application/pdf` |
| `pp-receipts` | 5 MiB | `application/pdf` |
| `pp-exports` | 200 MiB | `text/csv`, `application/zip` |
| `pp-backups` | sin tope por objeto | `application/gzip`, `application/x-tar` |

Cuota total por bucket (segunda barrera, aplicada en `event-bus`/Garage):
`pp-catalog-media` 2 GiB · `pp-kyb` 5 GiB · `pp-fiscal` 20 GiB ·
`pp-receipts` 20 GiB · `pp-exports` 50 GiB · `pp-backups` sin restricción.
Los valores de desarrollo viven en `scripts/init-buckets.sh`; producción (F27)
los ajusta por tamaño de disco real del clúster.

## 4. Tiempos de expiración

- URLs de subida (PUT): **10 minutos**.
- URLs de lectura (GET) de `pp-fiscal`: **10 minutos** (SPEC §3); 1 hora para el
  resto de objetos privados. Objetos públicos de `pp-catalog-media` se sirven por
  `web`/CDN sin prefirmar (F15.2).

## 5. Lectura pública de catálogo

`pp-catalog-media` se sirve a través de `web` desde `/media/` (SPEC §2): la llave
`web_svc` solo tiene permiso de lectura sobre ese bucket (F07.9). El público nunca
habla con Garage directamente.

## 6. Verificación

`./object-storage/test/test_presigned_quotas.sh` (L2) comprueba que una subida que
excede la cuota del bucket es rechazada por el servidor, y que la referencia
(documentada arriba) existe y declara los tipos y tamaños por bucket.
