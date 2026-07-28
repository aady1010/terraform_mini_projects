# 1. AWS ECR Repository to store Docker images
resource "aws_ecr_repository" "app_repo" {
  name                 = "devops-node-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# 2. ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "devops-ecs-cluster"
}

# 3. IAM Execution Role for ECS Tasks (Allows ECS to pull images from ECR)
resource "aws_iam_role" "ecs_execution_role" {
  name = "ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# 4. ECS Fargate Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "node-api-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"  # 0.25 vCPU (Free Tier / Low cost)
  memory                   = "512"  # 512 MB RAM
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "node-api-container"
      image     = "${aws_ecr_repository.app_repo.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]
      environment = [
        { name = "PORT", value = "3000" },
        { name = "DB_HOST", value = split(":", aws_db_instance.mysql.endpoint)[0] },
        { name = "DB_USER", value = "admin" },
        { name = "DB_PASSWORD", value = var.db_password },
        { name = "DB_NAME", value = "companydb" }
      ]
    }
  ])
}

# 5. ECS Fargate Service
resource "aws_ecs_service" "app" {
  name            = "node-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.web_sg.id]
    assign_public_ip = true
  }
}


resource "aws_ecr_repository" "node_api" {
  name                 = "devops-node-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}