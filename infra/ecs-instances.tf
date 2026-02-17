# Task definition template for openclaw instances.
# The hub overrides command + environment at RunTask time.
resource "aws_ecs_task_definition" "instance" {
  family                   = "openclaw-instance"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.instance_cpu
  memory                   = var.instance_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.instance_task.arn

  container_definitions = jsonencode([{
    name      = "openclaw"
    image     = "${aws_ecr_repository.openclaw.repository_url}:${var.openclaw_image_tag}"
    essential = true

    portMappings = [
      { containerPort = 18789, protocol = "tcp" },
      { containerPort = 18790, protocol = "tcp" },
    ]

    mountPoints = [{
      sourceVolume  = "instance-data"
      containerPath = "/instance-data"
      readOnly      = false
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.instances.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "openclaw-instance"
      }
    }
  }])

  volume {
    name = "instance-data"

    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.main.id
      transit_encryption = "ENABLED"

      authorization_config {
        access_point_id = aws_efs_access_point.instance_data.id
        iam             = "ENABLED"
      }
    }
  }

  tags = { Name = "openclaw-instance-task" }
}
