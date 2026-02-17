# Secret container — values are set via CLI, not in Terraform state.
#
# After apply, populate with:
#   aws secretsmanager put-secret-value \
#     --secret-id openclaw-hub-secrets \
#     --secret-string '{"SLACK_CLIENT_ID":"...","SLACK_CLIENT_SECRET":"...","SLACK_SIGNING_SECRET":"...","SLACK_APP_TOKEN":"...","SLACK_OAUTH_REDIRECT_URI":"https://admin.getvento.com/slack/callback","ADMIN_PASSWORD":"...","STATE_SECRET":"..."}'

resource "aws_secretsmanager_secret" "hub" {
  name        = "openclaw-hub-secrets"
  description = "Runtime secrets for the openclaw hub service"

  tags = { Name = "openclaw-hub-secrets" }
}
