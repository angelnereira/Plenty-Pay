# infra/kubernetes (F27)

```
base/<contenedor>/{deployment,service,pdb,hpa,networkpolicy,serviceaccount}.yaml + kustomization.yaml
overlays/staging/   overlays/prod/
platform/           # CloudNativePG Cluster, ScyllaCluster, NATS, Garage, cert-manager issuers, ingress
```
Reglas por recurso: `docs/standards/delivery-pipeline.md` §6. NetworkPolicies generadas desde la matriz de `docs/architecture/service-dependencies.md` §3 (deny-all + permitidos). Imágenes siempre por digest.
