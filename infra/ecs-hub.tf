resource "aws_ecs_task_definition" "hub" {
  family                   = "openclaw-hub"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.hub_cpu
  memory                   = var.hub_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.hub_task.arn

  container_definitions = jsonencode([{
    name      = "hub"
    image     = "${aws_ecr_repository.hub.repository_url}:${var.hub_image_tag}"
    essential = true

    portMappings = [{
      containerPort = 9876
      protocol      = "tcp"
    }]

    environment = [
      { name = "PORT", value = "9876" },
      { name = "CONTAINER_PROVIDER", value = "ecs" },
      { name = "ECS_CLUSTER", value = aws_ecs_cluster.main.name },
      { name = "ECS_TASK_DEFINITION", value = "openclaw-instance" },
      { name = "ECS_SUBNETS", value = join(",", aws_subnet.private[*].id) },
      { name = "ECS_SECURITY_GROUPS", value = aws_security_group.instances.id },
      { name = "ECS_LOG_GROUP", value = aws_cloudwatch_log_group.instances.name },
      { name = "ECS_EFS_FILE_SYSTEM_ID", value = aws_efs_file_system.main.id },
      { name = "DB_PATH", value = "/hub-data/hub.db" },
      {
        name  = "OPENCLAW_IMAGE"
        value = "${aws_ecr_repository.openclaw.repository_url}:${var.openclaw_image_tag}"
      },
    ]

    secrets = [
      { name = "SLACK_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.hub.arn}:SLACK_CLIENT_ID::" },
      { name = "SLACK_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.hub.arn}:SLACK_CLIENT_SECRET::" },
      { name = "SLACK_SIGNING_SECRET", valueFrom = "${aws_secretsmanager_secret.hub.arn}:SLACK_SIGNING_SECRET::" },
      { name = "SLACK_APP_TOKEN", valueFrom = "${aws_secretsmanager_secret.hub.arn}:SLACK_APP_TOKEN::" },
      { name = "SLACK_OAUTH_REDIRECT_URI", valueFrom = "${aws_secretsmanager_secret.hub.arn}:SLACK_OAUTH_REDIRECT_URI::" },
      { name = "ADMIN_PASSWORD", valueFrom = "${aws_secretsmanager_secret.hub.arn}:ADMIN_PASSWORD::" },
      { name = "STATE_SECRET", valueFrom = "${aws_secretsmanager_secret.hub.arn}:STATE_SECRET::" },
      { name = "OPENAI_API_KEY", valueFrom = "${aws_secretsmanager_secret.hub.arn}:OPENAI_API_KEY::" },
    ]

    mountPoints = [{
      sourceVolume  = "hub-data"
      containerPath = "/hub-data"
      readOnly      = false
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.hub.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "hub"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:9876/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 15
    }
  }])

  volume {
    name = "hub-data"

    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.main.id
      transit_encryption = "ENABLED"

      authorization_config {
        access_point_id = aws_efs_access_point.hub_data.id
        iam             = "ENABLED"
      }
    }
  }

  tags = { Name = "openclaw-hub-task" }
}

resource "aws_ecs_service" "hub" {
  name            = "hub"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.hub.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.hub.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.hub.arn
    container_name   = "hub"
    container_port   = 9876
  }

  depends_on = [aws_lb_listener.https]

  tags = { Name = "openclaw-hub-service" }
}
