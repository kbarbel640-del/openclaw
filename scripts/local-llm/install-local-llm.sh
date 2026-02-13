#!/bin/bash
#
# Local LLM Installation Script for OpenClaw
# Platform: Ubuntu 24
# Model: Qwen2.5-1.5B-Instruct-Q4_K_M
# Date: 2026-02-13
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LLAMA_CPP_DIR="/opt/llama.cpp"
MODEL_DIR="/opt/llm-models"
MODEL_FILE="qwen2.5-1.5b-instruct-q4_k_m.gguf"
MODEL_URL="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/${MODEL_FILE}"
SERVICE_FILE="/etc/systemd/system/local-llm.service"
LLM_PORT="8765"
SWAP_SIZE="4G"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_system() {
    log_info "Checking system requirements..."
    
    # Check Ubuntu version
    if ! grep -q "Ubuntu" /etc/os-release; then
        log_warn "Not running Ubuntu. Proceed with caution."
    fi
    
    # Check RAM
    total_ram=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$total_ram" -lt 7 ]; then
        log_error "Insufficient RAM. Need at least 8GB, found ${total_ram}GB"
        exit 1
    fi
    log_info "RAM check passed: ${total_ram}GB"
    
    # Check disk space (need ~5GB for source + model)
    available_space=$(df /opt -BG | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available_space" -lt 5 ]; then
        log_error "Insufficient disk space in /opt. Need 5GB, have ${available_space}GB"
        exit 1
    fi
    log_info "Disk space check passed: ${available_space}GB available"
}

install_dependencies() {
    log_info "Installing dependencies..."
    apt-get update
    apt-get install -y \
        build-essential \
        git \
        cmake \
        curl \
        wget \
        libgomp1 \
        netcat-openbsd
    log_info "Dependencies installed"
}

compile_llama_cpp() {
    log_info "Compiling llama.cpp..."
    
    if [ -d "$LLAMA_CPP_DIR" ]; then
        log_warn "llama.cpp directory exists. Pulling latest..."
        cd "$LLAMA_CPP_DIR"
        git pull
    else
        log_info "Cloning llama.cpp..."
        cd /opt
        git clone https://github.com/ggerganov/llama.cpp.git
        cd "$LLAMA_CPP_DIR"
    fi
    
    log_info "Building with CMake (this may take 5-10 minutes)..."
    cmake -B build
    cmake --build build --config Release -j2
    
    if [ ! -f "./build/bin/llama-server" ]; then
        log_error "llama-server binary not found after compilation"
        exit 1
    fi
    
    log_info "llama.cpp compiled successfully"
}

download_model() {
    log_info "Setting up model directory..."
    
    mkdir -p "$MODEL_DIR"
    cd "$MODEL_DIR"
    
    if [ -f "$MODEL_FILE" ]; then
        log_warn "Model file already exists. Skipping download."
        log_info "To re-download, delete: ${MODEL_DIR}/${MODEL_FILE}"
    else
        log_info "Downloading Qwen2.5-1.5B-Instruct model (~900MB)..."
        log_info "This may take several minutes..."
        
        if wget --progress=bar:force "$MODEL_URL" -O "$MODEL_FILE"; then
            log_info "Model downloaded successfully"
        else
            log_error "Failed to download model"
            exit 1
        fi
    fi
    
    # Verify file size (should be around 900MB)
    file_size=$(du -m "$MODEL_FILE" | cut -f1)
    if [ "$file_size" -lt 800 ]; then
        log_error "Model file seems too small (${file_size}MB). Download may be corrupted."
        exit 1
    fi
    log_info "Model file verified: ${file_size}MB"
}

setup_swap() {
    log_info "Checking swap configuration..."
    
    current_swap=$(free -h | awk '/^Swap:/{print $2}')
    log_info "Current swap: $current_swap"
    
    if [ -f /swapfile ]; then
        log_warn "Swap file already exists. Skipping creation."
        return
    fi
    
    read -p "Create ${SWAP_SIZE} swap file? (recommended) [Y/n]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        log_info "Creating ${SWAP_SIZE} swap file..."
        fallocate -l "$SWAP_SIZE" /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        
        # Make permanent
        if ! grep -q '/swapfile' /etc/fstab; then
            echo '/swapfile none swap sw 0 0' >> /etc/fstab
            log_info "Swap file added to /etc/fstab"
        fi
        
        log_info "Swap file created and activated"
    fi
}

install_systemd_service() {
    log_info "Installing systemd service..."
    
    # Get the script directory (where local-llm.service should be)
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    service_source="${script_dir}/local-llm.service"
    
    if [ -f "$service_source" ]; then
        cp "$service_source" "$SERVICE_FILE"
        log_info "Copied service file from ${service_source}"
    else
        log_warn "Service file not found at ${service_source}"
        log_info "Creating service file from scratch..."
        
        cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Local LLM Server (llama.cpp) for OpenClaw
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=nobody
Group=nogroup
Restart=always
RestartSec=10

# Security
PrivateTmp=yes
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/tmp

# Resources
MemoryMax=3G
MemoryHigh=2.5G
CPUQuota=200%

# Environment
Environment="LLAMA_LOG_LEVEL=warn"

# Start
ExecStart=/opt/llama.cpp/llama-server \
  --model /opt/llm-models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8765 \
  --ctx-size 2048 \
  --threads 2 \
  --n-gpu-layers 0 \
  --batch-size 512 \
  --ubatch-size 128 \
  --parallel 1 \
  --cont-batching \
  --metrics \
  --log-format text \
  --mlock

KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    systemctl daemon-reload
    log_info "Systemd service installed"
}

configure_firewall() {
    log_info "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        # Deny external access to LLM port
        ufw deny "$LLM_PORT" comment "Block external LLM access"
        # Allow from localhost (implicit, but explicit for clarity)
        ufw allow from 127.0.0.1 to any port "$LLM_PORT"
        log_info "UFW rules configured"
    else
        log_warn "UFW not found. Firewall not configured."
        log_warn "Ensure port ${LLM_PORT} is not exposed externally!"
    fi
}

test_service() {
    log_info "Testing service..."
    
    # Start service
    systemctl enable local-llm
    systemctl start local-llm
    
    log_info "Waiting for service to start (10 seconds)..."
    sleep 10
    
    # Check status
    if systemctl is-active --quiet local-llm; then
        log_info "Service is running"
    else
        log_error "Service failed to start"
        log_error "Check logs: journalctl -u local-llm -n 50"
        exit 1
    fi
    
    # Test API
    log_info "Testing API endpoint..."
    if curl -s --max-time 5 http://127.0.0.1:${LLM_PORT}/health > /dev/null 2>&1; then
        log_info "API is responding"
    else
        log_warn "API not responding yet (may need more time to load model)"
        log_info "Monitor with: journalctl -u local-llm -f"
    fi
}

show_summary() {
    cat << EOF

${GREEN}╔════════════════════════════════════════════════════════╗
║                                                        ║
║        Local LLM Installation Complete! 🎉            ║
║                                                        ║
╚════════════════════════════════════════════════════════╝${NC}

${YELLOW}Configuration:${NC}
  Endpoint:  http://127.0.0.1:${LLM_PORT}
  Model:     Qwen2.5-1.5B-Instruct-Q4_K_M
  Context:   2048 tokens
  Memory:    Max 3GB

${YELLOW}Useful Commands:${NC}
  Status:    sudo systemctl status local-llm
  Logs:      sudo journalctl -u local-llm -f
  Restart:   sudo systemctl restart local-llm
  Stop:      sudo systemctl stop local-llm
  Memory:    ps aux | grep llama-server

${YELLOW}API Testing:${NC}
  Health:    curl http://127.0.0.1:${LLM_PORT}/health
  Models:    curl http://127.0.0.1:${LLM_PORT}/v1/models
  Metrics:   curl http://127.0.0.1:${LLM_PORT}/metrics
  
  Chat Test:
  curl http://127.0.0.1:${LLM_PORT}/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{
      "model": "qwen2.5-1.5b-instruct",
      "messages": [{"role": "user", "content": "Hello!"}],
      "max_tokens": 50
    }'

${YELLOW}Next Steps:${NC}
  1. Configure OpenClaw to use local provider
  2. Edit: openclaw/config/openclaw.json
  3. Add provider with baseURL: http://127.0.0.1:${LLM_PORT}/v1
  4. Set up routing rules (utility tasks → local)
  5. Monitor for 24h and adjust resources if needed

${YELLOW}Documentation:${NC}
  See: openclaw/docs/LOCAL_LLM_SETUP.md

${GREEN}Installation completed successfully!${NC}

EOF
}

# Main execution
main() {
    log_info "Starting Local LLM installation for OpenClaw..."
    log_info "This will install llama.cpp and Qwen2.5-1.5B model"
    echo
    
    check_root
    check_system
    install_dependencies
    compile_llama_cpp
    download_model
    setup_swap
    install_systemd_service
    configure_firewall
    test_service
    show_summary
}

# Run main function
main "$@"
