resource "aws_ecs_cluster" "main" {
  name = "openclaw-vento"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "openclaw-cluster" }
}
