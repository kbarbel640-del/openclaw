#!/bin/bash
#
# Local LLM API Test Script
# Tests various API endpoints and functionality
#

set -euo pipefail

# Configuration
BASE_URL="http://127.0.0.1:8765"
MODEL="qwen2.5-1.5b-instruct"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() {
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

test_health() {
    echo "Testing /health endpoint..."
    if response=$(curl -s --max-time 5 "${BASE_URL}/health" 2>&1); then
        pass "Health endpoint responding"
        echo "  Response: $response"
    else
        fail "Health endpoint not responding"
        return 1
    fi
}

test_models() {
    echo ""
    echo "Testing /v1/models endpoint..."
    if response=$(curl -s --max-time 5 "${BASE_URL}/v1/models" 2>&1); then
        if echo "$response" | grep -q "object"; then
            pass "Models endpoint responding"
            echo "  Response: $response"
        else
            warn "Unexpected response format"
            echo "  Response: $response"
        fi
    else
        fail "Models endpoint not responding"
        return 1
    fi
}

test_chat_completion() {
    echo ""
    echo "Testing /v1/chat/completions endpoint..."
    
    payload='{
        "model": "'"${MODEL}"'",
        "messages": [
            {"role": "user", "content": "Say OK"}
        ],
        "max_tokens": 10,
        "temperature": 0.3
    }'
    
    start_time=$(date +%s)
    
    if response=$(curl -s --max-time 30 \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${BASE_URL}/v1/chat/completions" 2>&1); then
        
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if echo "$response" | grep -q "choices"; then
            pass "Chat completion successful (${duration}s)"
            
            # Extract and show the response
            content=$(echo "$response" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4)
            echo "  Model response: $content"
            
            # Performance check
            if [ "$duration" -lt 5 ]; then
                pass "Response time acceptable (<5s)"
            elif [ "$duration" -lt 10 ]; then
                warn "Response time slow (${duration}s)"
            else
                fail "Response time too slow (${duration}s)"
            fi
        else
            fail "Unexpected response format"
            echo "  Response: $response"
            return 1
        fi
    else
        fail "Chat completion failed"
        echo "  Error: $response"
        return 1
    fi
}

test_metrics() {
    echo ""
    echo "Testing /metrics endpoint..."
    if response=$(curl -s --max-time 5 "${BASE_URL}/metrics" 2>&1); then
        if echo "$response" | grep -q "llamacpp"; then
            pass "Metrics endpoint responding"
            echo "  Sample metrics:"
            echo "$response" | grep "llamacpp" | head -5 | sed 's/^/    /'
        else
            warn "Metrics available but may not have data yet"
        fi
    else
        warn "Metrics endpoint not available (may not be enabled)"
    fi
}

test_memory_usage() {
    echo ""
    echo "Checking memory usage..."
    if ps aux | grep -q '[l]lama-server'; then
        mem_mb=$(ps aux | grep '[l]lama-server' | awk '{sum+=$6} END {printf "%.0f", sum/1024}')
        echo "  Current memory: ${mem_mb} MB"
        
        if [ "$mem_mb" -lt 2800 ]; then
            pass "Memory usage normal (${mem_mb} MB)"
        elif [ "$mem_mb" -lt 3000 ]; then
            warn "Memory usage elevated (${mem_mb} MB)"
        else
            fail "Memory usage too high (${mem_mb} MB)"
        fi
    else
        fail "llama-server process not found"
        return 1
    fi
}

# Main
main() {
    echo "========================================="
    echo "Local LLM API Test Suite"
    echo "Base URL: $BASE_URL"
    echo "========================================="
    echo ""
    
    # Run tests
    test_health
    test_models
    test_chat_completion
    test_metrics
    test_memory_usage
    
    echo ""
    echo "========================================="
    echo "Test suite completed"
    echo "========================================="
}

main "$@"
