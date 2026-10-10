# Infraestructura como código (OpenTofu)

## Por qué OpenTofu y no Terraform

HashiCorp cambió la licencia de Terraform a BSL en 2023 (ya no es open source
estrictamente). OpenTofu es el fork bajo Linux Foundation, MPL 2.0, casi 100%
compatible en CLI y HCL. Todo lo de aquí funciona igual con `terraform` si
prefieres esa CLI — el HCL no cambia.

## Alcance real de este módulo (léelo antes de ejecutar nada)

Este directorio **NO aprovisiona los nodos del clúster** (VMs, bare-metal,
redes). Aprovisionar servidores propios/colocation depende 100% del proveedor
que elijas (no existe un provider de Terraform "genérico" para bare-metal), y
un clúster gestionado en la nube (OKE/EKS/GKE) requiere sus propios providers
específicos que no se agregaron aquí para no fingir soporte multi-nube que no
se pudo probar.

**Lo que sí hace**: una vez que un clúster Kubernetes YA existe (self-hosted
con K3s/Talos ya instalado, o un clúster gestionado ya creado) y su
`kubeconfig` está disponible, `modules/k8s-bootstrap` instala las piezas de
plataforma que `infra/k8s/*.yaml` asumen: cert-manager, el operador
CloudNativePG e ingress-nginx.

## Verificación (léelo — es una limitación real, no un detalle menor)

Este HCL se escribió y revisó a mano; no se pudo ejecutar `tofu validate` ni
`terraform validate` en el entorno donde se generó este proyecto (el binario
no se pudo descargar — los dominios de releases de HashiCorp/OpenTofu no
estaban en la lista blanca de red del entorno). **Antes de aplicar nada**,
corre tú mismo:

```
tofu init
tofu validate
tofu plan -var="acme_email=tu@correo.com"
```

## Uso

```
cd environments/self-hosted-primary   # o environments/cloud-dr
tofu init
tofu apply -var="acme_email=tu@correo.com"
```
