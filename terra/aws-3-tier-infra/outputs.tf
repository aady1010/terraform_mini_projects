output "web_server_public_ip" {
  description = "The public IP address of the deployed Web Server"
  value       = aws_instance.web.public_ip
}

output "database_endpoint" {
  description = "The internal endpoint URL for the MySQL RDS instance"
  value       = aws_db_instance.mysql.endpoint
}

output "ecr_repository_url" {
  description = "The URL of the ECR Repository"
  value       = aws_ecr_repository.app_repo.repository_url
}