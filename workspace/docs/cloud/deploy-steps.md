# Deploy Steps (Draft v0.1)

## Required Inputs
- GCP Project ID
- Service Account JSON key path
- Region (default: asia-east1)

## Planned GCP Resources
- Cloud Run: control-api, runtime-api
- Cloud SQL: Postgres
- Cloud Storage: openclaw-artifacts
- Secret Manager: auth keys

## High-Level Steps
1. Create service account + roles
2. Create Cloud SQL + database
3. Build container images
4. Deploy control-api + runtime-api
5. Configure domain (optional)
6. Register nodes

