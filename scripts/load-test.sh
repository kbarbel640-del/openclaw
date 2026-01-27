#!/bin/bash
#
# Gateway Load Test Runner
#
# Usage:
#   ./scripts/load-test.sh [options]
#
# Examples:
#   ./scripts/load-test.sh --scenario connections --concurrency 100
#   ./scripts/load-test.sh --scenario chat --rps 5
#   ./scripts/load-test.sh --scenario auth-stress
#
# Environment variables:
#   GATEWAY_URL     Gateway WebSocket URL (default: ws://127.0.0.1:18789)
#   GATEWAY_TOKEN   Authentication token
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Default values
SCENARIO="${SCENARIO:-connections}"
DURATION="${DURATION:-60}"
CONCURRENCY="${CONCURRENCY:-50}"
RAMP_UP="${RAMP_UP:-10}"
RPS="${RPS:-1}"
VERBOSE="${VERBOSE:-}"

# Build args
ARGS=()

if [ -n "$GATEWAY_URL" ]; then
    ARGS+=("--url" "$GATEWAY_URL")
fi

if [ -n "$GATEWAY_TOKEN" ]; then
    ARGS+=("--token" "$GATEWAY_TOKEN")
fi

# Parse command line args
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--scenario)
            SCENARIO="$2"
            shift 2
            ;;
        -d|--duration)
            DURATION="$2"
            shift 2
            ;;
        -c|--concurrency)
            CONCURRENCY="$2"
            shift 2
            ;;
        -r|--ramp-up)
            RAMP_UP="$2"
            shift 2
            ;;
        --rps)
            RPS="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="1"
            shift
            ;;
        --json)
            ARGS+=("--json")
            shift
            ;;
        -u|--url)
            ARGS+=("--url" "$2")
            shift 2
            ;;
        -t|--token)
            ARGS+=("--token" "$2")
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -s, --scenario <name>   Test scenario: connections, chat, auth-stress"
            echo "  -d, --duration <secs>   Test duration in seconds (default: 60)"
            echo "  -c, --concurrency <n>   Number of concurrent connections (default: 50)"
            echo "  -r, --ramp-up <secs>    Ramp-up time in seconds (default: 10)"
            echo "      --rps <n>           Requests per second per user (default: 1)"
            echo "  -v, --verbose           Enable verbose output"
            echo "      --json              Output results as JSON"
            echo "  -u, --url <url>         Gateway WebSocket URL"
            echo "  -t, --token <token>     Authentication token"
            echo "  -h, --help              Show this help"
            echo ""
            echo "Scenarios:"
            echo "  connections   WebSocket connection stress test"
            echo "  chat          Chat message throughput test"
            echo "  auth-stress   Authentication rate limit verification"
            echo ""
            echo "Environment variables:"
            echo "  GATEWAY_URL     Gateway WebSocket URL"
            echo "  GATEWAY_TOKEN   Authentication token"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

ARGS+=("--scenario" "$SCENARIO")
ARGS+=("--duration" "$DURATION")
ARGS+=("--concurrency" "$CONCURRENCY")
ARGS+=("--ramp-up" "$RAMP_UP")
ARGS+=("--rps" "$RPS")

if [ -n "$VERBOSE" ]; then
    ARGS+=("--verbose")
fi

cd "$PROJECT_DIR"

# Check if bun is available
if command -v bun &> /dev/null; then
    exec bun load-tests/run.ts "${ARGS[@]}"
else
    # Fall back to tsx or node with ts-node
    if command -v tsx &> /dev/null; then
        exec tsx load-tests/run.ts "${ARGS[@]}"
    elif command -v npx &> /dev/null; then
        exec npx tsx load-tests/run.ts "${ARGS[@]}"
    else
        echo "Error: bun, tsx, or npx required to run load tests"
        exit 1
    fi
fi
