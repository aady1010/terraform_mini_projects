variable "vpc_cidr" {
    type = string
    default = "10.0.0.0/16"
}

variable "aws_region" {
  type        = string
  description = "AWS region for infrastructure deployment"
  default     = "us-east-1"
}

variable "db_password" {
  type        = string
  description = "Master password for the RDS database"
  sensitive   = true
  default     = "SuperSecurePassword123!" # Override via environment or CLI flags
}