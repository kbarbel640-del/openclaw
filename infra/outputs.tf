output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "hub_ecr_url" {
  description = "ECR repository URL for the hub image"
  value       = aws_ecr_repository.hub.repository_url
}

output "openclaw_ecr_url" {
  description = "ECR repository URL for the openclaw image"
  value       = aws_ecr_repository.openclaw.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "efs_file_system_id" {
  description = "EFS filesystem ID"
  value       = aws_efs_file_system.main.id
}

output "hub_url" {
  description = "Hub service URL"
  value       = "https://${var.domain_name}"
}
