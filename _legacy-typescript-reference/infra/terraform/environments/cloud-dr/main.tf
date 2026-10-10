# Entorno: clúster de respaldo/burst en la nube (documento 02 §4). Elegiste OCI Always Free /
# Ampere como opción concreta y barata; el módulo de bootstrap es el mismo sin importar el
# proveedor (por eso NO hay lógica específica de OCI/AWS/GCP aquí — solo apunta a otro clúster).
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
  default = "~/.kube/config-plentypay-dr"
}

variable "acme_email" {
  type = string
}

module "bootstrap" {
  source     = "../../modules/k8s-bootstrap"
  acme_email = var.acme_email
}
