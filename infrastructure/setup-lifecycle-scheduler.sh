#!/bin/bash

# Script to setup AWS EventBridge scheduler for the event lifecycle job
# Runs run_lifecycle_transitions once a day at 09:00 IST: records when events end,
# gifts close and links go off, and emails hosts before anything closes.
# Usage: ./setup-lifecycle-scheduler.sh
#
# Links never go off unless EventLifecycleSettings.enforce_link_off is on AND
# this job has warned the host. Turn enforcement on (Django admin) only after
# this rule has run and its warning emails have arrived.

set -e

# Configuration. Public subnets with a public IP: the NAT gateway is gone
# (see migrate-to-public-subnets.sh), so a task on the old private subnets
# could not reach SES to send the warnings.
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-00903760b47ea9f39"  # staging-public-1 (us-east-1a)
SUBNET_2="subnet-0781ee8d36f10d08e"  # staging-public-2 (us-east-1b)
SG_ID="sg-02c8a03bf690d592f"
REGION="us-east-1"
ACCOUNT_ID="630147069059"

# Once a day is enough: hosts are warned a week ahead, and guest pages switch
# state on time without this job. 03:30 UTC = 09:00 IST, so hosts in India get
# the emails in the morning. cron(Minutes Hours Day-of-month Month Day-of-week Year)
SCHEDULE_EXPRESSION="cron(30 3 * * ? *)"

echo "Setting up AWS EventBridge scheduler for the event lifecycle job"
echo "============================================================="
echo ""
echo "Configuration:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Task Definition: $TASK_DEF"
echo "  Schedule: daily at 03:30 UTC (09:00 IST)"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
echo ""

# Step 1: Ensure IAM role exists (shared with analytics scheduler)
echo "Step 1: Checking IAM role for EventBridge..."
ROLE_NAME="EventBridge-ECSRunTask-Role"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "   Role already exists: $ROLE_NAME"
else
    echo "   Creating IAM role: $ROLE_NAME"

    cat > /tmp/eventbridge-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "events.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/eventbridge-trust-policy.json \
        --description "Allows EventBridge to run ECS tasks"

    echo "   Role created"
    rm -f /tmp/eventbridge-trust-policy.json
fi

# Attach ECS RunTask policy
echo "   Attaching ECS RunTask policy..."
POLICY_NAME="EventBridge-ECSRunTask-Policy"

cat > /tmp/eventbridge-ecs-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RunTask"
      ],
      "Resource": "arn:aws:ecs:$REGION:$ACCOUNT_ID:task-definition/$TASK_DEF"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
        "arn:aws:iam::$ACCOUNT_ID:role/backend-task-role"
      ]
    }
  ]
}
EOF

if aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" >/dev/null 2>&1; then
    echo "   Policy already attached"
else
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document file:///tmp/eventbridge-ecs-policy.json

    echo "   Policy attached"
fi

ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo "   Role ARN: $ROLE_ARN"
rm -f /tmp/eventbridge-ecs-policy.json
echo ""

# Step 2: Create EventBridge rule
echo "Step 2: Creating EventBridge rule..."
RULE_NAME="event-lifecycle-transitions"

if aws events describe-rule --name "$RULE_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "   Rule already exists: $RULE_NAME"
    read -p "   Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        UPDATE_RULE=true
    else
        UPDATE_RULE=false
        echo "   Skipping rule update"
    fi
else
    UPDATE_RULE=true
fi

if [ "$UPDATE_RULE" = true ]; then
    aws events put-rule \
        --name "$RULE_NAME" \
        --description "Runs run_lifecycle_transitions daily at 09:00 IST" \
        --schedule-expression "$SCHEDULE_EXPRESSION" \
        --state ENABLED \
        --region "$REGION"

    echo "   Rule created/updated: $RULE_NAME"
fi

# Step 3: Create ECS target
echo "Step 3: Creating EventBridge target..."
TARGET_ID="lifecycle-transitions-ecs-task"

cat > /tmp/eventbridge-target.json <<EOF
{
  "Id": "$TARGET_ID",
  "Arn": "arn:aws:ecs:$REGION:$ACCOUNT_ID:cluster/$CLUSTER_NAME",
  "RoleArn": "$ROLE_ARN",
  "EcsParameters": {
    "TaskDefinitionArn": "arn:aws:ecs:$REGION:$ACCOUNT_ID:task-definition/$TASK_DEF",
    "LaunchType": "FARGATE",
    "NetworkConfiguration": {
      "awsvpcConfiguration": {
        "Subnets": ["$SUBNET_1", "$SUBNET_2"],
        "SecurityGroups": ["$SG_ID"],
        "AssignPublicIp": "ENABLED"
      }
    }
  },
  "Input": "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"run_lifecycle_transitions\"]}]}"
}
EOF

# Remove existing target if present
aws events remove-targets \
    --rule "$RULE_NAME" \
    --ids "$TARGET_ID" \
    --region "$REGION" 2>/dev/null || true

# Add the target
aws events put-targets \
    --rule "$RULE_NAME" \
    --targets file:///tmp/eventbridge-target.json \
    --region "$REGION"

echo "   Target created: $TARGET_ID"
rm -f /tmp/eventbridge-target.json
echo ""

# Step 4: Verify
echo "Step 4: Verifying setup..."
RULE_STATUS=$(aws events describe-rule --name "$RULE_NAME" --region "$REGION" --query 'State' --output text)
TARGET_COUNT=$(aws events list-targets-by-rule --rule "$RULE_NAME" --region "$REGION" --query 'length(Targets)' --output text)

echo ""
echo "Setup Complete!"
echo "============================================================="
echo "Rule Name:  $RULE_NAME"
echo "Status:     $RULE_STATUS"
echo "Targets:    $TARGET_COUNT"
echo "Schedule:   daily at 03:30 UTC (09:00 IST)"
echo ""
echo "Next Steps:"
echo "1. Watch the first runs in CloudWatch Logs: /ecs/event-registry-staging/backend (grep Lifecycle)"
echo "2. Check recorded transitions on any event in Django admin (Events -> lifecycle inlines)"
echo "3. Only then turn on 'enforce_link_off' in Django admin: Event Lifecycle Settings"
echo ""
echo "To run it once by hand:"
echo "  aws ecs run-task \\"
echo "    --cluster $CLUSTER_NAME \\"
echo "    --task-definition $TASK_DEF \\"
echo "    --launch-type FARGATE \\"
echo "    --network-configuration \"awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=ENABLED}\" \\"
echo "    --overrides '{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"run_lifecycle_transitions\"]}]}'"
echo ""
echo "To preview what would be sent without sending:"
echo "  aws ecs run-task ... --overrides '{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"run_lifecycle_transitions\",\"--dry-run\"]}]}'"
echo ""
echo "To disable the scheduler:"
echo "  aws events disable-rule --name $RULE_NAME --region $REGION"
echo ""
echo "To enable the scheduler:"
echo "  aws events enable-rule --name $RULE_NAME --region $REGION"
echo ""
echo "To delete the scheduler:"
echo "  aws events remove-targets --rule $RULE_NAME --ids $TARGET_ID --region $REGION"
echo "  aws events delete-rule --name $RULE_NAME --region $REGION"
echo ""
