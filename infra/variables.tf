variable "name" {
  type    = string
  default = "ask-my-cv"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "bedrock_region" {
  description = "Region where the model is enabled in Amazon Bedrock."
  type        = string
  default     = "eu-central-1"
}

variable "model_id" {
  type    = string
  default = "anthropic.claude-haiku-5-5"
}

variable "anthropic_api_key" {
  description = "Claude API key used as a backup when Bedrock fails. Empty = no backup."
  type        = string
  default     = ""
  sensitive   = true
}

variable "anthropic_model_id" {
  description = "Claude API model id for the backup."
  type        = string
  default     = "claude-haiku-5-5"
}

variable "price_input_per_mtok" {
  description = "USD per million input tokens for model_id in bedrock_region (check the Bedrock pricing page)."
  type        = number
  default     = 0.1
}

variable "price_output_per_mtok" {
  type    = number
  default = 0.5
}

variable "daily_budget_usd" {
  description = "Hard daily cap on model spend; the API answers 429 once it is reached."
  type        = number
  default     = 0.1
}

variable "per_ip_daily_limit" {
  type    = number
  default = 30
}

variable "monthly_budget_usd" {
  description = "AWS Budgets alert threshold for the whole account."
  type        = number
  default     = 5
}

variable "alert_email" {
  description = "Where AWS Budgets sends cost alerts."
  type        = string
}

variable "extra_allowed_origins" {
  description = "Extra origins allowed to call the API (e.g. a custom domain or http://localhost:8080)."
  type        = list(string)
  default     = []
}

variable "reserved_concurrency" {
  description = "Max concurrent Lambda executions (caps burst traffic). null = no reservation; new AWS accounts with a low concurrency quota cannot reserve any."
  type        = number
  default     = null
}

variable "budget_kill_switch" {
  description = "When actual monthly spend passes monthly_budget_usd, AWS Budgets attaches a policy that denies Bedrock to the Lambda role."
  type        = bool
  default     = true
}
