resource "aws_secretsmanager_secret" "discord_bot_token" {
  name                    = var.discord_bot_token_secret_name
  description             = "Discord bot token for PPAL Discord Bot"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-discord-bot-token"
  }
}

resource "aws_secretsmanager_secret" "discord_public_key" {
  name                    = var.discord_public_key_secret_name
  description             = "Discord public key for verifying interactions"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-discord-public-key"
  }
}

resource "aws_secretsmanager_secret" "github_token" {
  name                    = var.github_token_secret_name
  description             = "GitHub token for PPAL Discord Bot"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-github-token"
  }
}

resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = var.openai_api_key_secret_name
  description             = "OpenAI API key for PPAL Discord Bot"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-openai-api-key"
  }
}

# Secret versions (placeholder values - must be updated manually or via CI/CD)
resource "aws_secretsmanager_secret_version" "discord_bot_token" {
  secret_id = aws_secretsmanager_secret.discord_bot_token.id
  secret_string = jsonencode({
    token = "PLACEHOLDER_DISCORD_BOT_TOKEN"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "discord_public_key" {
  secret_id = aws_secretsmanager_secret.discord_public_key.id
  secret_string = jsonencode({
    public_key = "PLACEHOLDER_DISCORD_PUBLIC_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "github_token" {
  secret_id = aws_secretsmanager_secret.github_token.id
  secret_string = jsonencode({
    token = "PLACEHOLDER_GITHUB_TOKEN"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  secret_id = aws_secretsmanager_secret.openai_api_key.id
  secret_string = jsonencode({
    api_key = "PLACEHOLDER_OPENAI_API_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
