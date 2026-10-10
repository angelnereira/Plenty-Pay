# ADR 0007 — OpenTofu con módulos intercambiables por proveedor

- **Estado**: Aceptada
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Se exige poder desplegar en servidores propios y en GCP, AWS, Azure o Railway, y cambiar de proveedor fácilmente; todo OSS.

## Decisión
1. OpenTofu (fork OSS de Terraform) en `infra/opentofu/`.
2. Módulos `cluster-<proveedor>` con **el mismo contrato** de entradas/salidas (`delivery-pipeline.md` §7); módulo `platform` común para todo lo que va dentro del clúster.
3. Producción híbrida: primario self-hosted + DR en nube (documento 02).
4. Railway se soporta con limitaciones explícitas (no es Kubernetes).

## Consecuencias
+ Cambiar de nube = cambiar un módulo y variables.
− Mantener 5 módulos de clúster; se priorizan self-hosted y uno de nube por fase.

## Alternativas consideradas
Pulumi (lenguajes generales, menos estándar); Crossplane (requiere clúster previo).
