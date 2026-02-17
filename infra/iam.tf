# ── ECS Task Execution Role ─────────────────────────────────────
# Used by the ECS agent to pull images, push logs, read secrets

resource "aws_iam_role" "ecs_execution" {
  name = "openclaw-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "openclaw-ecs-execution" }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_base" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
      ]
      Resource = [aws_secretsmanager_secret.hub.arn]
    }]
  })
}

# ── Hub Task Role ──────────────────────────────────────────────
# Permissions the hub code needs at runtime

resource "aws_iam_role" "hub_task" {
  name = "openclaw-hub-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "openclaw-hub-task" }
}

resource "aws_iam_role_policy" "hub_task_ecs" {
  name = "manage-ecs-tasks"
  role = aws_iam_role.hub_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks",
        ]
        Resource = "*"
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.main.arn
          }
        }
      },
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.instance_task.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = "logs:GetLogEvents"
        Resource = "${aws_cloudwatch_log_group.instances.arn}:*"
      },
    ]
  })
}

resource "aws_iam_role_policy" "hub_task_efs" {
  name = "efs-access"
  role = aws_iam_role.hub_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite",
      ]
      Resource = aws_efs_file_system.main.arn
    }]
  })
}

# ── Instance Task Role ─────────────────────────────────────────
# Minimal permissions for openclaw containers

resource "aws_iam_role" "instance_task" {
  name = "openclaw-instance-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "openclaw-instance-task" }
}

resource "aws_iam_role_policy" "instance_task_efs" {
  name = "efs-access"
  role = aws_iam_role.instance_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite",
      ]
      Resource = aws_efs_file_system.main.arn
    }]
  })
}
