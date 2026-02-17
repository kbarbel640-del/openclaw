# ── ALB Security Group ──────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "openclaw-alb-"
  description = "ALB: allow HTTPS inbound"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "openclaw-sg-alb" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from internet"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from internet (redirects to HTTPS)"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_hub" {
  security_group_id            = aws_security_group.alb.id
  description                  = "To hub service"
  from_port                    = 9876
  to_port                      = 9876
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.hub.id
}

# ── Hub Security Group ─────────────────────────────────────────

resource "aws_security_group" "hub" {
  name_prefix = "openclaw-hub-"
  description = "Hub: allow traffic from ALB and to instances"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "openclaw-sg-hub" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "hub_from_alb" {
  security_group_id            = aws_security_group.hub.id
  description                  = "From ALB"
  from_port                    = 9876
  to_port                      = 9876
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "hub_to_instances" {
  security_group_id            = aws_security_group.hub.id
  description                  = "To openclaw instances"
  from_port                    = 18789
  to_port                      = 18790
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.instances.id
}

resource "aws_vpc_security_group_egress_rule" "hub_to_internet" {
  security_group_id = aws_security_group.hub.id
  description       = "Internet access (APIs, Slack, etc.)"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ── Instances Security Group ──────────────────────────────────

resource "aws_security_group" "instances" {
  name_prefix = "openclaw-instances-"
  description = "OpenClaw instances: allow traffic from hub"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "openclaw-sg-instances" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "instances_from_hub" {
  security_group_id            = aws_security_group.instances.id
  description                  = "From hub (gateway + bridge)"
  from_port                    = 18789
  to_port                      = 18790
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.hub.id
}

resource "aws_vpc_security_group_egress_rule" "instances_to_internet" {
  security_group_id = aws_security_group.instances.id
  description       = "Internet access (LLM APIs)"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ── EFS Security Group ────────────────────────────────────────

resource "aws_security_group" "efs" {
  name_prefix = "openclaw-efs-"
  description = "EFS: allow NFS from hub and instances"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "openclaw-sg-efs" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "efs_from_hub" {
  security_group_id            = aws_security_group.efs.id
  description                  = "NFS from hub"
  from_port                    = 2049
  to_port                      = 2049
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.hub.id
}

resource "aws_vpc_security_group_ingress_rule" "efs_from_instances" {
  security_group_id            = aws_security_group.efs.id
  description                  = "NFS from instances"
  from_port                    = 2049
  to_port                      = 2049
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.instances.id
}

resource "aws_vpc_security_group_egress_rule" "efs_egress" {
  security_group_id = aws_security_group.efs.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
