terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "vento-openclaw-tfstate"
    key    = "infra/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "openclaw"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

data "aws_route53_zone" "main" {
  name = var.hosted_zone_name
}
