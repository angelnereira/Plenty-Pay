terraform {
  required_version = ">= 1.13.0"
  backend "local" {}
}

provider "null" {}

resource "null_resource" "placeholder" {
  triggers = {
    purpose = "placeholder-for-f26"
  }
}
