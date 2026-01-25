data "aws_ecr_repository" "lambda" {
  name = "${var.project_name}-lambda"
}

data "aws_ecr_image" "lambda" {
  repository_name = data.aws_ecr_repository.lambda.name
  image_tag       = var.environment
}

resource "aws_lambda_function" "discord_handler" {
  function_name = "${var.project_name}-discord-handler"
  description   = "PPAL Discord Bot command handler"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"

  image_uri = "${data.aws_ecr_repository.lambda.repository_url}@${data.aws_ecr_image.lambda.image_digest}"

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  environment {
    variables = {
      ENVIRONMENT                   = var.environment
      DISCORD_BOT_TOKEN_SECRET_ARN  = aws_secretsmanager_secret.discord_bot_token.arn
      DISCORD_PUBLIC_KEY_SECRET_ARN = aws_secretsmanager_secret.discord_public_key.arn
      GITHUB_TOKEN_SECRET_ARN       = aws_secretsmanager_secret.github_token.arn
      OPENAI_API_KEY_SECRET_ARN     = aws_secretsmanager_secret.openai_api_key.arn
      USERS_TABLE_NAME              = aws_dynamodb_table.users.name
      CONVERSATIONS_TABLE_NAME      = aws_dynamodb_table.conversations.name
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda_logs.name
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_dynamodb,
    aws_iam_role_policy.lambda_secrets,
  ]

  tags = {
    Name = "${var.project_name}-discord-handler"
  }
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-discord-handler"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-lambda-logs"
  }
}

resource "aws_lambda_function_url" "discord_handler" {
  function_name      = aws_lambda_function.discord_handler.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_credentials = true
    allow_origins     = ["https://discord.com"]
    allow_methods     = ["POST"]
    allow_headers     = ["Content-Type", "X-Discord-Timestamp", "X-Signature-Ed25519", "X-Signature-Timestamp"]
  }
}
