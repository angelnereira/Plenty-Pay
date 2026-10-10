# Entorno: clúster primario self-hosted (K3s o Talos sobre bare-metal/VMs en Panamá/LatAm).
#
# DELIBERADAMENTE INCOMPLETO: aprovisionar bare-metal/VMs propias depende del proveedor de
# colocation/virtualización que elijas (no hay un provider de Terraform "genérico" para eso).
# Este archivo asume que K3s/Talos YA está instalado en los nodos (kubeconfig en KUBECONFIG) y
# arranca desde ahí — ver docs/infraestructura-self-hosted.md (a escribir junto a tu proveedor).
terraform {
  required_version = ">= 1.6"
  required_providers {
    helm       = { source = "hashicorp/helm", version = "~> 2.15" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.33" }
  }
}

provider "kubernetes" { config_path = var.kubeconfig_path }
provider "helm" { kubernetes { config_path = var.kubeconfig_path } }

variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/config-plentypay-primary"
}

variable "acme_email" {
  type = string
}

module "bootstrap" {
  source     = "../../modules/k8s-bootstrap"
  acme_email = var.acme_email
}
