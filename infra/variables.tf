variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone name (e.g. getvento.com)"
  type        = string
  default     = "getvento.com"
}

variable "domain_name" {
  description = "Domain name for the hub service"
  type        = string
  default     = "admin.getvento.com"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "hub_cpu" {
  description = "CPU units for hub task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "hub_memory" {
  description = "Memory (MiB) for hub task"
  type        = number
  default     = 1024
}

variable "instance_cpu" {
  description = "CPU units for openclaw instance tasks"
  type        = number
  default     = 1024
}

variable "instance_memory" {
  description = "Memory (MiB) for openclaw instance tasks"
  type        = number
  default     = 2048
}

variable "hub_image_tag" {
  description = "Docker image tag for the hub service"
  type        = string
  default     = "latest"
}

variable "openclaw_image_tag" {
  description = "Docker image tag for openclaw instances"
  type        = string
  default     = "latest"
}
