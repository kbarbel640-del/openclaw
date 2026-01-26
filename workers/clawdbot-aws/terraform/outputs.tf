/**
 * Deployment Outputs
 */

output "sessions_table_name" {
  description = "DynamoDB table name for session storage"
  value       = aws_dynamodb_table.sessions.name
}

output "artifacts_table_name" {
  description = "DynamoDB table name for artifacts metadata"
  value       = aws_dynamodb_table.artifacts.name
}

output "artifacts_bucket_name" {
  description = "S3 bucket name for artifact storage"
  value       = aws_s3_bucket.artifacts.id
}

output "artifacts_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.artifacts.arn
}

output "sessions_table_arn" {
  description = "DynamoDB sessions table ARN"
  value       = aws_dynamodb_table.sessions.arn
}

output "artifacts_table_arn" {
  description = "DynamoDB artifacts table ARN"
  value       = aws_dynamodb_table.artifacts.arn
}

output "environment_variables" {
  description = "Required environment variables for clawdbot"
  value = {
    SESSIONS_TABLE_NAME = aws_dynamodb_table.sessions.name
    ARTIFACTS_TABLE_NAME = aws_dynamodb_table.artifacts.name
    ARTIFACTS_S3_BUCKET = aws_s3_bucket.artifacts.id
    AWS_REGION = var.aws_region
  }
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.clawdbot.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.clawdbot.name
}

output "ecs_task_definition_family" {
  description = "ECS task definition family"
  value       = aws_ecs_task_definition.clawdbot.family
}

output "ecr_repository_url" {
  description = "ECR repository URL for container images"
  value       = aws_ecr_repository.clawdbot.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.clawdbot.name
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.clawdbot.name
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.clawdbot.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "security_group_id" {
  description = "Security Group ID"
  value       = aws_security_group.clawdbot.id
}

output "ecs_task_role_arn" {
  description = "ECS Task Role ARN"
  value       = aws_iam_role.ecs_task_role.arn
}

output "ecs_execution_role_arn" {
  description = "ECS Execution Role ARN"
  value       = aws_iam_role.ecs_execution_role.arn
}
