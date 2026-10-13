resource "random_password" "ip_salt" {
  length  = 32
  special = false
}

resource "aws_dynamodb_table" "limits" {
  name         = "${var.name}-limits"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
}

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

data "aws_iam_policy_document" "lambda" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.limits.arn]
  }
}

resource "aws_iam_role_policy" "lambda" {
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_iam_role_policy_attachment" "lambda_bedrock" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockMantleInferenceAccess"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = 30
}

# Run `npm run build` first; it writes dist/handler.mjs.
data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../dist/handler.mjs"
  output_path = "${path.module}/.build/lambda.zip"
}

resource "aws_lambda_function" "api" {
  function_name    = var.name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "handler.handler"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  memory_size      = 512
  timeout          = 30

  reserved_concurrent_executions = var.reserved_concurrency == null ? -1 : var.reserved_concurrency

  environment {
    # The Claude API backup is only switched on when a key is provided.
    variables = merge({
      BEDROCK_REGION        = var.bedrock_region
      MODEL_ID              = var.model_id
      TABLE_NAME            = aws_dynamodb_table.limits.name
      DAILY_BUDGET_USD      = tostring(var.daily_budget_usd)
      PER_IP_DAILY_LIMIT    = tostring(var.per_ip_daily_limit)
      PRICE_INPUT_PER_MTOK  = tostring(var.price_input_per_mtok)
      PRICE_OUTPUT_PER_MTOK = tostring(var.price_output_per_mtok)
      IP_HASH_SALT          = random_password.ip_salt.result
      }, var.anthropic_api_key == "" ? {} : {
      ANTHROPIC_API_KEY  = var.anthropic_api_key
      ANTHROPIC_MODEL_ID = var.anthropic_model_id
    })
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = concat(["https://${aws_cloudfront_distribution.site.domain_name}"], var.extra_allowed_origins)
    allow_methods = ["POST"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

# A Function URL with auth NONE still needs a resource policy that lets anyone invoke it.
# AWS requires both statements; the second only applies to calls that come through the URL.
resource "aws_lambda_permission" "url_public" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "url_invoke" {
  statement_id             = "FunctionURLAllowInvokeAction"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.api.function_name
  principal                = "*"
  invoked_via_function_url = true
}
