resource "aws_efs_file_system" "main" {
  encrypted = true

  tags = { Name = "openclaw-efs" }
}

resource "aws_efs_mount_target" "private" {
  count           = 2
  file_system_id  = aws_efs_file_system.main.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

# Access point for hub data (SQLite DB)
resource "aws_efs_access_point" "hub_data" {
  file_system_id = aws_efs_file_system.main.id

  posix_user {
    uid = 1000
    gid = 1000
  }

  root_directory {
    path = "/hub-data"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "755"
    }
  }

  tags = { Name = "openclaw-efs-hub-data" }
}

# Access point for openclaw instance configs
resource "aws_efs_access_point" "instance_data" {
  file_system_id = aws_efs_file_system.main.id

  posix_user {
    uid = 1000
    gid = 1000
  }

  root_directory {
    path = "/instance-data"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "755"
    }
  }

  tags = { Name = "openclaw-efs-instance-data" }
}
