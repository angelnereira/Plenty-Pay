# Módulo: k8s-bootstrap
# Instala en un clúster YA EXISTENTE (no lo crea) las piezas de plataforma que
# infra/k8s/*.yaml asumen disponibles: cert-manager, el operador CloudNativePG e
# ingress-nginx. Usa OpenTofu (ver documento 02 §1: Terraform es BSL desde 2023;
# OpenTofu es el fork 100% open source, casi 100% compatible en CLI y HCL).
#
# El aprovisionamiento del clúster mismo (nodos, red) es intencionalmente OTRO
# módulo por entorno (ver ../../environments/*) porque difiere mucho entre el
# leg self-hosted (K3s/Talos sobre bare-metal/VMs) y el leg cloud — mezclarlos
# aquí obligaría a este módulo a saber demasiado sobre cada proveedor.

terraform {
  required_version = ">= 1.6" # OpenTofu
  required_providers {
    helm = { source = "hashicorp/helm", version = "~> 2.15" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.33" }
  }
}

variable "acme_email" {
  description = "Correo para los certificados Let's Encrypt de cert-manager"
  type        = string
}

resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  namespace        = "cert-manager"
  create_namespace = true
  version          = "v1.16.2"
  set {
    name  = "crds.enabled"
    value = "true"
  }
}

resource "helm_release" "cnpg" {
  name             = "cloudnative-pg"
  repository       = "https://cloudnative-pg.github.io/charts"
  chart            = "cloudnative-pg"
  namespace        = "cnpg-system"
  create_namespace = true
  version          = "0.23.1"
}

resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  namespace        = "ingress-nginx"
  create_namespace = true
  version          = "4.11.3"
}

resource "kubernetes_manifest" "letsencrypt_issuer" {
  depends_on = [helm_release.cert_manager]
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata   = { name = "letsencrypt-prod" }
    spec = {
      acme = {
        server = "https://acme-v02.api.letsencrypt.org/directory"
        email  = var.acme_email
        privateKeySecretRef = { name = "letsencrypt-prod-key" }
        solvers = [{ http01 = { ingress = { class = "nginx" } } }]
      }
    }
  }
}
