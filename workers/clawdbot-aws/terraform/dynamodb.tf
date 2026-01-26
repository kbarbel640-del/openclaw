/**
 * DynamoDB Tables for θ-cycle Session Persistence & Artifact Storage
 */

resource "aws_dynamodb_table" "sessions" {
  name         = var.sessions_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "guildId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "userId"
    range_key       = "status"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GuildIndex"
    hash_key        = "guildId"
    range_key       = "status"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  ttl {
    attribute_name = "expiresAt"
  }

  tags = {
    Name = "${var.project_name}-sessions"
  }
}

resource "aws_dynamodb_table" "artifacts" {
  name         = var.artifacts_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "type"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "N"
  }

  attribute {
    name = "expiresAt"
    type = "N"
  }

  global_secondary_index {
    name            = "SessionIndex"
    hash_key        = "sessionId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "TypeIndex"
    hash_key        = "type"
    range_key       = "expiresAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  ttl {
    attribute_name = "expiresAt"
  }

  tags = {
    Name = "${var.project_name}-artifacts"
  }
}
