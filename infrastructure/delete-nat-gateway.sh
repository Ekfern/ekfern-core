#!/bin/bash
# Delete the NAT Gateway, release its Elastic IP, and remove ECR VPC Interface Endpoints.
#
# WHY: After migrating ECS tasks to public subnets (migrate-to-public-subnets.sh),
# the NAT Gateway is unused. Deleting it saves ~$67/month. Removing the ECR
# interface endpoints saves an additional ~$15/month — ECR pulls now go directly
# over the internet via each task's public IP.
#
# PREREQS:
#   1. Run migrate-to-public-subnets.sh first and verify all smoke tests pass.
#   2. Confirm both ECS services show assignPublicIp=ENABLED and are healthy.
#
# KEPT: SSM interface endpoint (secrets access stays private — worth $7.44/month).
# KEPT: S3 Gateway endpoint (free).

set -e

REGION="us-east-1"
VPC_ID="vpc-0150736050b2f8bc7"
PRIVATE_ROUTE_TABLE="rtb-0f4d2c9b994b1e666"

echo "🗑️  NAT Gateway + ECR Endpoint Cleanup"
echo "======================================="
echo ""

# Safety check: confirm ECS services are on public subnets before proceeding
echo "🔍 Safety check: verifying ECS services are on public subnets..."
BACKEND_IP=$(aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --region "$REGION" \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp' \
  --output text)

if [ "$BACKEND_IP" != "ENABLED" ]; then
  echo "❌ Backend service still has assignPublicIp=$BACKEND_IP"
  echo "   Run migrate-to-public-subnets.sh first and verify smoke tests pass."
  exit 1
fi
echo "  ✅ Backend service: assignPublicIp=ENABLED"

FRONTEND_IP=$(aws ecs describe-services \
  --cluster event-registry-staging \
  --services frontend-service \
  --region "$REGION" \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp' \
  --output text)

if [ "$FRONTEND_IP" != "ENABLED" ]; then
  echo "❌ Frontend service still has assignPublicIp=$FRONTEND_IP"
  echo "   Run migrate-to-public-subnets.sh first and verify smoke tests pass."
  exit 1
fi
echo "  ✅ Frontend service: assignPublicIp=ENABLED"
echo ""

# Step 1: Find NAT Gateway
echo "📌 Step 1: Locating NAT Gateway..."
NAT_GW=$(aws ec2 describe-route-tables \
  --route-table-ids "$PRIVATE_ROUTE_TABLE" \
  --region "$REGION" \
  --query 'RouteTables[0].Routes[?DestinationCidrBlock==`0.0.0.0/0`].NatGatewayId' \
  --output text)

if [ -z "$NAT_GW" ] || [ "$NAT_GW" = "None" ]; then
  echo "  ⚠️  No NAT Gateway route found in private route table — may already be deleted."
else
  echo "  Found NAT Gateway: $NAT_GW"

  # Get Elastic IP allocation
  EIP_ALLOC=$(aws ec2 describe-nat-gateways \
    --nat-gateway-ids "$NAT_GW" \
    --region "$REGION" \
    --query 'NatGateways[0].NatGatewayAddresses[0].AllocationId' \
    --output text)
  echo "  Found Elastic IP allocation: $EIP_ALLOC"
  echo ""

  # Step 2: Remove route from private route table
  echo "📌 Step 2: Removing 0.0.0.0/0 route from private route table..."
  aws ec2 delete-route \
    --route-table-id "$PRIVATE_ROUTE_TABLE" \
    --destination-cidr-block 0.0.0.0/0 \
    --region "$REGION"
  echo "  ✅ Route removed"
  echo ""

  # Step 3: Delete NAT Gateway
  echo "📌 Step 3: Deleting NAT Gateway $NAT_GW..."
  aws ec2 delete-nat-gateway \
    --nat-gateway-id "$NAT_GW" \
    --region "$REGION" \
    --query 'NatGateway.State' \
    --output text
  echo "  ✅ Deletion initiated (takes ~60 seconds)"
  echo ""

  # Step 4: Release Elastic IP
  if [ -n "$EIP_ALLOC" ] && [ "$EIP_ALLOC" != "None" ]; then
    echo "📌 Step 4: Waiting 90 seconds for NAT Gateway to be deleted before releasing EIP..."
    sleep 90
    echo "  Releasing Elastic IP $EIP_ALLOC..."
    aws ec2 release-address \
      --allocation-id "$EIP_ALLOC" \
      --region "$REGION" 2>/dev/null && echo "  ✅ Elastic IP released" || \
      echo "  ⚠️  Could not release EIP yet — NAT Gateway may still be deleting. Run manually:"
    echo "     aws ec2 release-address --allocation-id $EIP_ALLOC --region $REGION"
  fi
fi

echo ""

# Step 5: Delete ECR VPC Interface Endpoints
echo "📌 Step 5: Deleting ECR VPC Interface Endpoints..."
ECR_ENDPOINTS=$(aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region "$REGION" \
  --query 'VpcEndpoints[?contains(ServiceName,`ecr`) && State==`available`].VpcEndpointId' \
  --output text)

if [ -z "$ECR_ENDPOINTS" ] || [ "$ECR_ENDPOINTS" = "None" ]; then
  echo "  ⚠️  No ECR endpoints found — may already be deleted."
else
  echo "  Found ECR endpoints: $ECR_ENDPOINTS"
  aws ec2 delete-vpc-endpoints \
    --vpc-endpoint-ids $ECR_ENDPOINTS \
    --region "$REGION" \
    --query 'Unsuccessful' \
    --output text
  echo "  ✅ ECR endpoints deleted: $ECR_ENDPOINTS"
fi

echo ""
echo "📊 Remaining VPC endpoints:"
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region "$REGION" \
  --query 'VpcEndpoints[?State==`available`].[VpcEndpointId,ServiceName,VpcEndpointType]' \
  --output table

echo ""
echo "======================================="
echo "✅ Cleanup complete!"
echo ""
echo "Monthly savings from this step:"
echo "  NAT Gateway:      ~\$67/month"
echo "  ECR endpoints:    ~\$15/month"
echo "  ─────────────────────────────"
echo "  Total:            ~\$82/month"
echo ""
echo "Next step: Run ./setup-ecr-lifecycle.sh to trim ECR image storage."
