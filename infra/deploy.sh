#!/usr/bin/env bash
#
# Build and push Docker images to ECR, then force a new ECS deployment.
#
# Usage:
#   ./infra/deploy.sh              # deploy both images
#   ./infra/deploy.sh hub          # deploy hub image only
#   ./infra/deploy.sh openclaw     # deploy openclaw image only
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Docker running locally
#   - Terraform outputs available (run from repo root after terraform apply)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read ECR URLs and cluster from Terraform outputs
cd "$SCRIPT_DIR"
HUB_ECR_URL=$(terraform output -raw hub_ecr_url)
OPENCLAW_ECR_URL=$(terraform output -raw openclaw_ecr_url)
CLUSTER=$(terraform output -raw ecs_cluster_name)
cd "$REPO_ROOT"

# Extract registry (account.dkr.ecr.region.amazonaws.com) from ECR URL
REGISTRY="${HUB_ECR_URL%%/*}"
REGION=$(echo "$REGISTRY" | cut -d. -f4)

echo "==> Logging in to ECR ($REGISTRY)"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

TARGET="${1:-all}"

if [ "$TARGET" = "all" ] || [ "$TARGET" = "hub" ]; then
  echo ""
  echo "==> Building hub image"
  docker build \
    -t "$HUB_ECR_URL:latest" \
    -f services/hub/Dockerfile \
    services/hub/

  echo "==> Pushing hub image"
  docker push "$HUB_ECR_URL:latest"
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "openclaw" ]; then
  echo ""
  echo "==> Building openclaw image"
  docker build \
    -t "$OPENCLAW_ECR_URL:latest" \
    -f Dockerfile \
    .

  echo "==> Pushing openclaw image"
  docker push "$OPENCLAW_ECR_URL:latest"
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "hub" ]; then
  echo ""
  echo "==> Forcing new ECS deployment for hub service"
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service hub \
    --force-new-deployment \
    --region "$REGION" \
    --no-cli-pager

  echo ""
  echo "==> Waiting for hub service to stabilize..."
  aws ecs wait services-stable \
    --cluster "$CLUSTER" \
    --services hub \
    --region "$REGION"
fi

echo ""
echo "Deploy complete!"
echo "Hub URL: https://$(terraform -chdir="$SCRIPT_DIR" output -raw hub_url 2>/dev/null | sed 's|https://||' || echo 'admin.getvento.com')"
