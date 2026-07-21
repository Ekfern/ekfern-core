#!/bin/bash
# Configure ECR image lifecycle policies for both repositories.
#
# WHY: No lifecycle policy exists. ECR is storing 74.5 GB of accumulated image
# layers ($7.45/month and growing with every deploy). This policy keeps the last
# 5 images per repo and expires everything older, recovering most of that storage
# within 24 hours of running.
#
# Safe to run at any time — does not affect running tasks (ECS pulls the image
# once on task start; the running container is unaffected by later ECR cleanup).

set -e

REGION="us-east-1"

POLICY='{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 5 images, expire older ones",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 5
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}'

echo "🗂️  Setting ECR Lifecycle Policies"
echo "==================================="
echo ""
echo "Policy: keep last 5 images, expire all older images."
echo "ECR processes lifecycle policies within 24 hours of application."
echo ""

echo "📦 Applying to event-registry-backend-staging..."
aws ecr put-lifecycle-policy \
  --repository-name event-registry-backend-staging \
  --lifecycle-policy-text "$POLICY" \
  --region "$REGION" \
  --query 'repositoryName' \
  --output text
echo "  ✅ Done"

echo ""
echo "📦 Applying to event-registry-frontend-staging..."
aws ecr put-lifecycle-policy \
  --repository-name event-registry-frontend-staging \
  --lifecycle-policy-text "$POLICY" \
  --region "$REGION" \
  --query 'repositoryName' \
  --output text
echo "  ✅ Done"

echo ""
echo "📊 Current image counts:"
echo ""

BACKEND_COUNT=$(aws ecr describe-images \
  --repository-name event-registry-backend-staging \
  --region "$REGION" \
  --query 'length(imageDetails)' \
  --output text 2>/dev/null || echo "unknown")
echo "  backend-staging:  $BACKEND_COUNT images"

FRONTEND_COUNT=$(aws ecr describe-images \
  --repository-name event-registry-frontend-staging \
  --region "$REGION" \
  --query 'length(imageDetails)' \
  --output text 2>/dev/null || echo "unknown")
echo "  frontend-staging: $FRONTEND_COUNT images"

echo ""
echo "==================================="
echo "✅ Lifecycle policies applied."
echo ""
echo "ECR will clean up old images within 24 hours."
echo "Expected storage drop: ~70 GB → ~5 GB (saving ~\$6.50/month)."
