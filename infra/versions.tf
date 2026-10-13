terraform {
  required_version = ">= 1.10"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 6.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.6" }
    random  = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # Bucket comes from infra/bootstrap: terraform init -backend-config="bucket=<state_bucket>"
  backend "s3" {
    key          = "ask-my-cv/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = var.name } }
}

# The Budgets API is served from us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags { tags = { Project = var.name } }
}
