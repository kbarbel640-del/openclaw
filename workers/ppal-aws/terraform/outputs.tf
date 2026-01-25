output "api_gateway_url" {
  description = "HTTP API Gateway endpoint URL for Discord Interactions"
  value       = aws_apigatewayv2_api.discord_interactions.api_endpoint
}

output "api_gateway_stage_url" {
  description = "Full stage URL for Discord Interactions endpoint"
  value       = "${aws_apigatewayv2_api.discord_interactions.api_endpoint}/${aws_apigatewayv2_stage.default.name}"
}

output "discord_interactions_endpoint" {
  description = "Discord Interactions endpoint URL (POST /interactions)"
  value       = "${aws_apigatewayv2_api.discord_interactions.api_endpoint}/interactions"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.discord_handler.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.discord_handler.arn
}

output "lambda_function_url" {
  description = "Lambda function URL"
  value       = aws_lambda_function_url.discord_handler.function_url
}

output "dynamodb_users_table_name" {
  description = "DynamoDB users table name"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_users_table_arn" {
  description = "DynamoDB users table ARN"
  value       = aws_dynamodb_table.users.arn
}

output "dynamodb_conversations_table_name" {
  description = "DynamoDB conversations table name"
  value       = aws_dynamodb_table.conversations.name
}

output "dynamodb_conversations_table_arn" {
  description = "DynamoDB conversations table ARN"
  value       = aws_dynamodb_table.conversations.arn
}

output "secrets_discord_bot_token_arn" {
  description = "Secrets Manager ARN for Discord bot token"
  value       = aws_secretsmanager_secret.discord_bot_token.arn
  sensitive   = true
}

output "secrets_discord_public_key_arn" {
  description = "Secrets Manager ARN for Discord public key"
  value       = aws_secretsmanager_secret.discord_public_key.arn
  sensitive   = true
}

output "secrets_github_token_arn" {
  description = "Secrets Manager ARN for GitHub token"
  value       = aws_secretsmanager_secret.github_token.arn
  sensitive   = true
}

output "secrets_openai_api_key_arn" {
  description = "Secrets Manager ARN for OpenAI API key"
  value       = aws_secretsmanager_secret.openai_api_key.arn
  sensitive   = true
}

output "lambda_role_arn" {
  description = "Lambda execution role ARN"
  value       = aws_iam_role.lambda_role.arn
}
