/**
 * S3 Bucket for Artifact Storage
 */

resource "aws_s3_bucket" "artifacts" {
  bucket = var.artifacts_bucket_name

  tags = {
    Name = "${var.project_name}-artifacts"
  }
}

# S3 bucket versioning (disabled for cost optimization)
resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.bucket
  versioning_configuration {
    status = "Suspended"
  }
}

# S3 bucket server-side encryption (SSE-S3)
resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket public access block (private bucket)
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configuration (auto-expire old artifacts)
resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id      = "expire-old-artifacts"
    status  = "Enabled"

    filter {}

    expiration {
      days = var.artifacts_bucket_ttl_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}
