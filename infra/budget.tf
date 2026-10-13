resource "aws_budgets_budget" "monthly" {
  provider     = aws.us_east_1
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# Kill switch: an alert alone does not stop spending. Once actual monthly spend passes the budget,
# AWS Budgets attaches this deny policy to the Lambda role, so every model call fails (the API answers 502).
# To restore service: raise the budget or wait for the next month, then detach the policy
# (AWS console → Budgets → the budget → Actions → reset, or detach it from the role in IAM).
data "aws_iam_policy_document" "deny_bedrock" {
  statement {
    effect    = "Deny"
    actions   = ["bedrock-mantle:*", "bedrock:*"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "deny_bedrock" {
  count  = var.budget_kill_switch ? 1 : 0
  name   = "${var.name}-deny-bedrock"
  policy = data.aws_iam_policy_document.deny_bedrock.json
}

data "aws_iam_policy_document" "budgets_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "budget_action" {
  count              = var.budget_kill_switch ? 1 : 0
  name               = "${var.name}-budget-action"
  assume_role_policy = data.aws_iam_policy_document.budgets_trust.json
}

data "aws_iam_policy_document" "budget_action" {
  statement {
    actions   = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
    resources = [aws_iam_role.lambda.arn]
  }
}

resource "aws_iam_role_policy" "budget_action" {
  count  = var.budget_kill_switch ? 1 : 0
  role   = aws_iam_role.budget_action[0].id
  policy = data.aws_iam_policy_document.budget_action.json
}

resource "aws_budgets_budget_action" "deny_bedrock" {
  provider           = aws.us_east_1
  count              = var.budget_kill_switch ? 1 : 0
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "APPLY_IAM_POLICY"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budget_action[0].arn

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 100
  }

  definition {
    iam_action_definition {
      policy_arn = aws_iam_policy.deny_bedrock[0].arn
      roles      = [aws_iam_role.lambda.name]
    }
  }

  subscriber {
    address           = var.alert_email
    subscription_type = "EMAIL"
  }
}
