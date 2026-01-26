/**
 * VPC for Clawdbot ECS Fargate Deployment
 * Discord bot requires outbound internet access for WebSocket connections
 */

# VPC
resource "aws_vpc" "clawdbot" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# Internet Gateway for outbound internet access
resource "aws_internet_gateway" "clawdbot" {
  vpc_id = aws_vpc.clawdbot.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Public Subnets (for Fargate tasks with public IP)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.clawdbot.id
  cidr_block              = cidrsubnet(aws_vpc.clawdbot.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

# Route Table for public subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.clawdbot.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.clawdbot.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

# Route Table Association for public subnets
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Data source for available AZs
data "aws_availability_zones" "available" {
  state = "available"
}
