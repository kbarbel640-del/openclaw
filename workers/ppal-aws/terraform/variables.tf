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
  default     = "ppal"
}

variable "lambda_handler" {
  description = "Lambda handler function name"
  type        = string
  default     = "index.handler"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
}

variable "discord_bot_token_secret_name" {
  description = "Secrets Manager secret name for Discord bot token"
  type        = string
  default     = "ppal/discord/bot-token"
}

variable "discord_public_key_secret_name" {
  description = "Secrets Manager secret name for Discord public key"
  type        = string
  default     = "ppal/discord/public-key"
}

variable "github_token_secret_name" {
  description = "Secrets Manager secret name for GitHub token"
  type        = string
  default     = "ppal/github/token"
}

variable "openai_api_key_secret_name" {
  description = "Secrets Manager secret name for OpenAI API key"
  type        = string
  default     = "ppal/openai/api-key"
}
