# AWS VPC Setup for OpenClaw

## Create VPC

1. Go to **VPC > Create VPC** in the AWS Console.
2. Select **"VPC and more"** (creates subnets, route tables, and internet gateway automatically).

## VPC Settings

| Setting | Value |
|---|---|
| **Name tag** | `openclaw` (or your preference) |
| **IPv4 CIDR** | `10.0.0.0/16` |
| **IPv6 CIDR block** | No IPv6 block |
| **Tenancy** | Default |
| **VPC encryption control** | None |

## Subnet and Network Settings

| Setting | Value | Notes |
|---|---|---|
| **Availability Zones** | 2 | Required for 2 public subnets |
| **Public subnets** | 2 | One is used, the other sits idle (no cost) |
| **Private subnets** | 0 | Not needed for a single-instance deployment |
| **NAT gateways** | None | Only needed for private subnets; ~$32/mo each |
| **VPC endpoints** | None | Not needed when EC2 is in a public subnet |

## DNS Options

| Setting | Value |
|---|---|
| **DNS hostnames** | Enabled |
| **DNS resolution** | Enabled |

Both are needed so the EC2 instance gets a public DNS name and internal DNS works correctly. No extra cost.

## Launch EC2 Instance

1. Go to **EC2 > Launch an instance**.
2. Configure the following:

| Setting | Value |
|---|---|
| **AMI** | Ubuntu 24.04 LTS (noble) |
| **Instance type** | t3.small (2 GiB RAM minimum) |
| **Key pair** | Create new — ED25519, .pem format |
| **VPC** | Select the VPC created above |
| **Subnet** | One of the public subnets |
| **Auto-assign public IP** | Enable |
| **Storage** | 20 GiB gp3 |

### Security Group

Create a new security group with these inbound rules:

| Type | Port | Source | Description |
|---|---|---|---|
| SSH | 22 | My IP | SSH access |
| Custom TCP | 18789 | My IP | OpenClaw gateway |

## Install OpenClaw

SSH into the instance (move the .pem file to `~/.ssh/` or your preferred location):

```bash
chmod 600 ~/path/to/your-key.pem
ssh -i ~/path/to/your-key.pem ubuntu@<public-ip>
```

Install Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Install OpenClaw:

```bash
sudo npm i -g clawdbot@latest
```

Verify the installation:

```bash
clawdbot --version
```

## Configure OpenClaw

Set gateway mode and auth token:

```bash
clawdbot config set gateway.mode local
openssl rand -hex 32
# copy the output, then:
clawdbot config set gateway.auth.token <token>
```

Create the credentials directory:

```bash
mkdir -p ~/.clawdbot/credentials
```

### Set Up Auth Profiles

The gateway reads API keys from an auth-profiles file, not environment variables. Create the file for the main agent:

```bash
mkdir -p ~/.clawdbot/agents/main/agent
cat > ~/.clawdbot/agents/main/agent/auth-profiles.json << 'EOF'
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "api_key",
      "provider": "anthropic",
      "key": "<your-anthropic-api-key>"
    }
  }
}
EOF
```

Run `clawdbot doctor` to verify everything is clean.

## Start the Gateway

```bash
nohup clawdbot gateway run --bind loopback --port 18789 --force > /tmp/clawdbot-gateway.log 2>&1 &
```

Verify it started:

```bash
ss -ltnp | grep 18789
tail -n 30 /tmp/clawdbot-gateway.log
```

## Connect via SSH Tunnel

The gateway binds to loopback (`127.0.0.1`) by default, so it is not exposed to the internet. Use an SSH tunnel to access it from your local machine:

```bash
ssh -i ~/path/to/your-key.pem -L 18789:127.0.0.1:18789 -N -f ubuntu@<public-ip>
```

The gateway is now available locally at `ws://localhost:18789`.

To close the tunnel:

```bash
pkill -f "ssh.*-L 18789"
```
