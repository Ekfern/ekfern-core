#!/bin/bash
# Migrate ECS services from private subnets to public subnets.
#
# WHY: Eliminates the NAT Gateway ($67/month) by giving ECS tasks direct internet
# access via public IPs. Security is maintained — both SGs only allow inbound
# from the ALB (sg-053cea6211c9e7db5), so tasks remain unreachable from the internet.
#
# PREREQS: Run this BEFORE delete-nat-gateway.sh.
# After running, wait for services to stabilize (both services show runningCount=1)
# before proceeding to delete-nat-gateway.sh.

set -e

REGION="us-east-1"
CLUSTER="event-registry-staging"
PUBLIC_SUBNET_1="subnet-00903760b47ea9f39"  # staging-public-1 (us-east-1a)
PUBLIC_SUBNET_2="subnet-0781ee8d36f10d08e"  # staging-public-2 (us-east-1b)
BACKEND_SG="sg-02c8a03bf690d592f"
FRONTEND_SG="sg-0616bc6241976f231"

echo "🚀 Migrating ECS services to public subnets"
echo "============================================"
echo ""
echo "Target subnets:"
echo "  Public subnet 1: $PUBLIC_SUBNET_1 (us-east-1a)"
echo "  Public subnet 2: $PUBLIC_SUBNET_2 (us-east-1b)"
echo ""
echo "Security groups (inbound locked to ALB only):"
echo "  Backend SG:  $BACKEND_SG  (port 8000 from ALB)"
echo "  Frontend SG: $FRONTEND_SG (port 3000 from ALB)"
echo ""

# Move backend service to public subnets
echo "📦 Updating backend-service..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service backend-service \
  --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET_1,$PUBLIC_SUBNET_2],securityGroups=[$BACKEND_SG],assignPublicIp=ENABLED}" \
  --force-new-deployment \
  --region "$REGION" \
  --query 'service.{service:serviceName,status:status,running:runningCount,desired:desiredCount}' \
  --output table

echo ""

# Move frontend service to public subnets
echo "📦 Updating frontend-service..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service frontend-service \
  --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET_1,$PUBLIC_SUBNET_2],securityGroups=[$FRONTEND_SG],assignPublicIp=ENABLED}" \
  --force-new-deployment \
  --region "$REGION" \
  --query 'service.{service:serviceName,status:status,running:runningCount,desired:desiredCount}' \
  --output table

echo ""
echo "✅ Service updates initiated. Waiting for stabilization..."
echo ""

# Wait for both services to stabilize
echo "⏳ Waiting for backend-service to stabilize (up to 5 minutes)..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services backend-service \
  --region "$REGION" && echo "✅ backend-service stable" || echo "⚠️  backend-service wait timed out — check manually"

echo ""
echo "⏳ Waiting for frontend-service to stabilize (up to 5 minutes)..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services frontend-service \
  --region "$REGION" && echo "✅ frontend-service stable" || echo "⚠️  frontend-service wait timed out — check manually"

echo ""
echo "📊 Final service status:"
aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services backend-service frontend-service \
  --region "$REGION" \
  --query 'services[*].[serviceName,runningCount,desiredCount,networkConfiguration.awsvpcConfiguration.assignPublicIp]' \
  --output table

echo ""
echo "🔍 Smoke tests:"
echo ""

# Health check
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://ekfern.com/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo "  ✅ /api/health → $HEALTH"
else
  echo "  ❌ /api/health → $HEALTH (expected 200)"
fi

# Frontend
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://ekfern.com/" 2>/dev/null || echo "000")
if [ "$FRONTEND" = "200" ]; then
  echo "  ✅ / → $FRONTEND"
else
  echo "  ❌ / → $FRONTEND (expected 200)"
fi

# Admin
ADMIN=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://admin.ekfern.com/api/admin/login/" 2>/dev/null || echo "000")
if [ "$ADMIN" = "200" ]; then
  echo "  ✅ /api/admin/login/ → $ADMIN"
else
  echo "  ❌ /api/admin/login/ → $ADMIN (expected 200)"
fi

echo ""
echo "============================================"
echo ""
if [ "$HEALTH" = "200" ] && [ "$FRONTEND" = "200" ] && [ "$ADMIN" = "200" ]; then
  echo "✅ All smoke tests passed."
  echo ""
  echo "Next step: Run ./delete-nat-gateway.sh to delete the NAT Gateway and save ~\$67/month."
else
  echo "⚠️  Some smoke tests failed. Investigate before running delete-nat-gateway.sh."
  echo ""
  echo "To rollback, re-run setup-nat-gateway.sh and revert ECS services to private subnets:"
  echo "  aws ecs update-service --cluster $CLUSTER --service backend-service \\"
  echo "    --network-configuration 'awsvpcConfiguration={subnets=[subnet-047b6a50234127a66,subnet-043a1224e8eb0640d],securityGroups=[$BACKEND_SG],assignPublicIp=DISABLED}' \\"
  echo "    --force-new-deployment --region $REGION"
fi
