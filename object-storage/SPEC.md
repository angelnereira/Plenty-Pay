# SPEC — object-storage

## 1. Responsabilidad
Almacenamiento de objetos **S3-compatible** con **Garage** (AGPLv3, uso sin modificación) para imágenes de catálogo, documentos KYB, XML/PDF fiscales, recibos, comprobantes, exportes, extractos de conciliación y respaldos. En nube puede sustituirse por el S3 del proveedor sin cambiar código (solo endpoint/credenciales).

## 2. Ficha
Puertos 3900 (S3 API), 3903 (admin, interno). Red `data` (+ acceso público solo vía URLs prefirmadas a través de `web`/ingress en `/media/`). Fase F07. Capa L0.

## 3. Buckets
| Bucket | Dueño(s) | Acceso | Retención / bloqueo |
|---|---|---|---|
| `pp-catalog-media` | catalog | lectura pública vía CDN/`web` (solo objetos publicados) | — |
| `pp-kyb` | identity (vía URL prefirmada del gateway) | privado | 10 años |
| `pp-fiscal` | fiscal-invoicing | privado, URLs prefirmadas 10 min | ≥ 5 años, sin borrado |
| `pp-receipts` | pos, payroll, logistics | privado | 5 años |
| `pp-exports` | analytics-bi, settlement | privado | 7 días |
| `pp-backups` | postgres-db, nosql-db | privado, cifrado | política de respaldo |
Una llave de acceso por contenedor con permisos solo sobre sus buckets.

> **Limitación conocida (2026-10-14)**: Garage v2.4 no permite conceder "escritura sin borrado" a nivel de llave (`DeleteObject` es una operación de escritura). La retención *sin borrado* de `pp-fiscal` queda pendiente de resolver en F13 (política en el contenedor dueño o job de retención); documentado en `object-storage/README.md`.

## 4. Reglas
- **R1** Claves de objeto generadas por el servidor (`<tenant>/<año>/<uuid>.<ext>`); nunca nombres del usuario.
- **R2** Subidas solo por URL prefirmada con tipo y tamaño máximo; verificación posterior (magic bytes + antivirus ClamAV como job en el contenedor dueño).
- **R3** Réplica 3 nodos en prod; respaldo de `pp-fiscal` a un segundo sitio.

## 5. Plan
F07.8 nodo Garage + layout → F07.9 buckets y llaves como script → F07.10 URLs prefirmadas de referencia (biblioteca documentada para catalog) → F27 clúster de 3 nodos.
