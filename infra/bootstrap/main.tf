# One-time setup, applied locally with your own AWS credentials:
#   terraform init && terraform apply -var="github_repo=<owner>/<repo>"
# Creates the Terraform state bucket and the two roles GitHub Actions assumes through OIDC.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.80" }
  }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "github_repo" {
  description = "owner/name of the GitHub repository allowed to assume the roles."
  type        = string
}

variable "github_repo_subject" {
  description = "Optional: repository part of the OIDC sub claim when GitHub issues immutable ids (owner@owner_id/repo@repo_id). Leave empty unless deploys fail with a sub mismatch."
  type        = string
  default     = ""
}

variable "deploy_branch" {
  type    = string
  default = "main"
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = "ask-my-cv" } }
}

data "aws_caller_identity" "me" {}

resource "aws_s3_bucket" "state" {
  bucket = "ask-my-cv-tfstate-${data.aws_caller_identity.me.account_id}"
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Only workflows running on the deploy branch can deploy.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      # GitHub issues sub as owner/repo or, with immutable ids, owner@id/repo@id; accept both.
      values = compact([
        "repo:${var.github_repo}:ref:refs/heads/${var.deploy_branch}",
        var.github_repo_subject == "" ? "" : "repo:${var.github_repo_subject}:ref:refs/heads/${var.deploy_branch}",
      ])
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "ask-my-cv-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

# PowerUser covers Lambda, S3, CloudFront, DynamoDB, Budgets and logs; IAM is limited to this project's roles.
resource "aws_iam_role_policy_attachment" "deploy_poweruser" {
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

data "aws_iam_policy_document" "deploy_iam" {
  statement {
    actions = [
      "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:TagRole", "iam:UntagRole", "iam:UpdateAssumeRolePolicy",
      "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
      "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole", "iam:PassRole",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.me.account_id}:role/ask-my-cv-*"]
  }
  # The budget kill switch policy (infra/budget.tf).
  statement {
    actions = [
      "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy", "iam:GetPolicyVersion", "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion", "iam:DeletePolicyVersion", "iam:TagPolicy", "iam:UntagPolicy",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.me.account_id}:policy/ask-my-cv-*"]
  }
}

resource "aws_iam_role_policy" "deploy_iam" {
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_iam.json
}

data "aws_iam_policy_document" "eval_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Any branch or pull request of this repository (forks never receive OIDC tokens).
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = compact(["repo:${var.github_repo}:*", var.github_repo_subject == "" ? "" : "repo:${var.github_repo_subject}:*"])
    }
  }
}

resource "aws_iam_role" "eval" {
  name               = "ask-my-cv-github-eval"
  assume_role_policy = data.aws_iam_policy_document.eval_trust.json
}

# Evals only call the model: no access to anything else in the account.
resource "aws_iam_role_policy_attachment" "eval_bedrock" {
  role       = aws_iam_role.eval.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockMantleInferenceAccess"
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}

output "eval_role_arn" {
  value = aws_iam_role.eval.arn
}
