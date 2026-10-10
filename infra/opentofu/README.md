# infra/opentofu (F26)

Estructura objetivo y contrato de módulos: `docs/standards/delivery-pipeline.md` §7. Resumen:

```
modules/cluster-self-hosted   modules/cluster-gcp   modules/cluster-aws
modules/cluster-azure         modules/cluster-railway (limitado: no es Kubernetes)
modules/platform              environments/{staging,prod-primary-self-hosted,prod-dr-<proveedor>}
```
Entradas comunes de `cluster-*`: `name`, `region`, `node_count`, `node_size_class` (small|medium|large), `kubernetes_version`.
Salidas comunes: `kubeconfig` (sensible), `cluster_endpoint`, `ingress_ip_or_hostname`, `storage_class`.

Reglas: OpenTofu ≥ 1.8; proveedores con versión fijada; estado remoto S3 con bloqueo; `tofu fmt -check` y `tofu validate` en CI; ningún secreto en variables versionadas (`*.tfvars` con secretos están en `.gitignore`).
