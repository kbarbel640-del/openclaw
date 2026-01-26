variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "clawdbot"
}

variable "sessions_table_name" {
  description = "DynamoDB table name for session storage"
  type        = string
  default     = "clawdbot-sessions"
}

variable "artifacts_table_name" {
  description = "DynamoDB table name for artifacts metadata"
  type        = string
  default     = "clawdbot-artifacts"
}

variable "artifacts_bucket_name" {
  description = "S3 bucket name for artifact storage"
  type        = string
  default     = "clawdbot-artifacts"
}

variable "artifacts_bucket_ttl_days" {
  description = "S3 bucket lifecycle TTL in days"
  type        = number
  default     = 7
}

# ECS Fargate Configuration
variable "ecs_task_cpu" {
  description = "ECS task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "ecs_task_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 2048
}

variable "ecs_service_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "discord_token" {
  description = "Discord bot token (DISCORD_BOT_TOKEN) - sensitive, do not commit to version control"
  type        = string
  sensitive   = true
}
