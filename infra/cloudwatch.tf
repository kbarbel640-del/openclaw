resource "aws_cloudwatch_log_group" "hub" {
  name              = "/ecs/openclaw-hub"
  retention_in_days = 30

  tags = { Name = "openclaw-hub-logs" }
}

resource "aws_cloudwatch_log_group" "instances" {
  name              = "/ecs/openclaw-instances"
  retention_in_days = 14

  tags = { Name = "openclaw-instances-logs" }
}
