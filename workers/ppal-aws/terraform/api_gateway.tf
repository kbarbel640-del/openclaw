resource "aws_apigatewayv2_api" "discord_interactions" {
  name          = "${var.project_name}-discord-interactions"
  protocol_type = "HTTP"
  description   = "HTTP API for PPAL Discord Bot Interactions Endpoint"

  tags = {
    Name = "${var.project_name}-discord-interactions"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.discord_interactions.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      ip                      = "$context.identity.sourceIp"
      caller                  = "$context.identity.caller"
      user                    = "$context.identity.user"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      resourcePath            = "$context.resourcePath"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  tags = {
    Name = "${var.project_name}-default-stage"
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-discord-interactions"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-api-gateway-logs"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.discord_interactions.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  description            = "Lambda integration for Discord interactions"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.discord_handler.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = var.lambda_timeout * 1000
}

resource "aws_apigatewayv2_route" "discord_interactions" {
  api_id    = aws_apigatewayv2_api.discord_interactions.id
  route_key = "POST /interactions"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "apigateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.discord_handler.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.discord_interactions.execution_arn}/*/*"
}
