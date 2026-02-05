#!/usr/bin/env bash
set -euo pipefail

# Placeholder deploy script (Draft v0.1)
# Required env:
#   PROJECT_ID
#   REGION (default: asia-east1)
#   SA_KEY_PATH

: "${PROJECT_ID:?PROJECT_ID required}"
: "${SA_KEY_PATH:?SA_KEY_PATH required}"
REGION=${REGION:-asia-east1}

# 1) Auth
# gcloud auth activate-service-account --key-file "$SA_KEY_PATH"
# gcloud config set project "$PROJECT_ID"

# 2) Create Cloud SQL (Postgres)
# gcloud sql instances create openclaw-sql --database-version=POSTGRES_15 --region="$REGION" --cpu=2 --memory=8GB
# gcloud sql databases create openclaw --instance=openclaw-sql

# 3) Create Storage bucket
# gsutil mb -l "$REGION" gs://$PROJECT_ID-openclaw-artifacts

# 4) Build + deploy Cloud Run services
# gcloud run deploy control-api --source . --region "$REGION" --allow-unauthenticated=false
# gcloud run deploy runtime-api --source . --region "$REGION" --allow-unauthenticated=false

# 5) Configure secrets (tokens, encryption keys)
# gcloud secrets create openclaw-app-key --data-file=key.txt

# 6) Verify endpoints
# curl -H "Authorization: Bearer <token>" https://control-api...

