output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "api_url" {
  value = aws_lambda_function_url.api.function_url
}

output "distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "log_group" {
  value = aws_cloudwatch_log_group.api.name
}
