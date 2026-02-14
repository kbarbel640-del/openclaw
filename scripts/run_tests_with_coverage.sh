#!/bin/bash

# OpenClaw Test Coverage Script (Adapted for TypeScript/Node.js)
# Runs vitest with coverage reporting
#
# Usage:
#   ./run_tests_with_coverage.sh           # Run all tests with coverage
#   ./run_tests_with_coverage.sh unit      # Unit tests only
#   ./run_tests_with_coverage.sh e2e       # E2E tests only
#   ./run_tests_with_coverage.sh fast      # Fast unit tests
#   ./run_tests_with_coverage.sh docker    # Docker-based tests

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_MODE="${1:-all}"  # Options: all, unit, e2e, fast, docker
COVERAGE_THRESHOLD="${COVERAGE_THRESHOLD:-80}"

echo -e "${BLUE}🧪 Running OpenClaw Tests with Coverage${NC}"
echo "=================================================="
echo "Test mode: $TEST_MODE"
echo "Coverage threshold: ${COVERAGE_THRESHOLD}%"
echo ""

# Function to run tests with error handling
run_test() {
    local test_name="$1"
    local command="$2"
    local emoji="$3"

    echo -e "\n${BLUE}${emoji} Running ${test_name}...${NC}"
    echo "Command: $command"

    if eval "$command"; then
        echo -e "${GREEN}✅ ${test_name}: PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ ${test_name}: FAILED${NC}"
        return 1
    fi
}

# Track overall status
overall_status=0

# Run tests based on mode
case "$TEST_MODE" in
    "fast"|"unit")
        echo -e "${BLUE}⚡ Running fast unit tests${NC}"
        if ! run_test "Unit Tests" "pnpm test:fast" "⚡"; then
            overall_status=1
        fi
        ;;

    "e2e")
        echo -e "${BLUE}🔄 Running end-to-end tests${NC}"
        if ! run_test "E2E Tests" "pnpm test:e2e" "🔄"; then
            overall_status=1
        fi
        ;;

    "coverage")
        echo -e "${BLUE}📊 Running tests with coverage${NC}"
        if ! run_test "Coverage Tests" "pnpm test:coverage" "📊"; then
            overall_status=1
        fi

        # Check coverage thresholds
        if [ -f "coverage/coverage-summary.json" ]; then
            echo -e "\n${BLUE}📈 Coverage Summary:${NC}"
            cat coverage/coverage-summary.json | jq '.total' 2>/dev/null || echo "Coverage summary available in coverage/index.html"
        fi
        ;;

    "all")
        echo -e "${BLUE}🚀 Running full test suite${NC}"

        # Build first
        echo -e "\n${BLUE}🔨 Building project${NC}"
        if ! run_test "Build" "pnpm build" "🔨"; then
            overall_status=1
        fi

        # Run all tests
        if ! run_test "Full Test Suite" "pnpm test" "🧪"; then
            overall_status=1
        fi

        # Run coverage
        echo -e "\n${BLUE}📊 Generating coverage report${NC}"
        if ! run_test "Coverage Report" "pnpm test:coverage" "📊"; then
            overall_status=1
        fi
        ;;

    "docker")
        echo -e "${BLUE}🐳 Running Docker-based tests${NC}"
        if ! run_test "Docker Tests" "pnpm test:docker:all" "🐳"; then
            overall_status=1
        fi
        ;;

    *)
        echo -e "${RED}❌ Unknown test mode: $TEST_MODE${NC}"
        echo "Valid modes: all, unit, e2e, fast, coverage, docker"
        exit 1
        ;;
esac

# Summary
echo -e "\n=================================================="
if [[ $overall_status -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"

    # Show coverage report location if available
    if [ -f "coverage/index.html" ]; then
        echo -e "${BLUE}📊 Coverage report: coverage/index.html${NC}"
        echo -e "${YELLOW}   Open with: open coverage/index.html${NC}"
    fi
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
fi

echo -e "\n${BLUE}📊 Test Summary:${NC}"
echo "  • Mode: $TEST_MODE"
echo "  • Framework: vitest"
echo "  • Coverage threshold: ${COVERAGE_THRESHOLD}%"

exit $overall_status

# Parse command line arguments
include_integration=false
generate_html=true  # Default to generating HTML

for arg in "$@"; do
    case $arg in
        --integration)
            include_integration=true
            ;;
        --no-html)
            generate_html=false
            ;;
        *)
            print_warning "Unknown argument: $arg"
            ;;
    esac
done

# Create coverage output directory
mkdir -p "/tmp/worldarchitectai/coverage"

# Change to mvp_site directory
cd mvp_site

print_status "🧪 Running tests with coverage analysis..."
print_status "Setting TESTING=true for faster AI model usage"
print_status "HTML output will be saved to: /tmp/worldarchitectai/coverage"

if [ "$include_integration" = true ]; then
    print_status "Integration tests enabled (--integration flag specified)"
else
    print_status "Skipping integration tests (use --integration to include them)"
fi

# Check if coverage is installed
print_status "Checking coverage installation..."

# First, activate the virtual environment
if ! source ../venv/bin/activate; then
    print_error "Failed to activate virtual environment"
    exit 1
fi

# Then check if coverage is importable
if ! python -c "import coverage" 2>/dev/null; then
    print_warning "Coverage tool not found. Installing..."
    if ! pip install coverage; then
        print_error "Failed to install coverage"
        exit 1
    fi
    print_success "Coverage installed successfully"
else
    print_status "Coverage already installed"
fi

# Find all test files in tests subdirectory, excluding venv, prototype, manual_tests, and test_integration
test_files=()
while IFS= read -r -d '' file; do
    test_files+=("$file")
done < <(find ./tests -name "test_*.py" -type f \
    ! -path "./venv/*" \
    ! -path "./node_modules/*" \
    ! -path "./prototype/*" \
    ! -path "./tests/manual_tests/*" \
    ! -path "./tests/test_integration/*" \
    -print0)

# Also include test_integration directories if not in GitHub export mode
if [ "$include_integration" = true ]; then
    # Check for test_integration in both root and tests/ directory
    if [ -d "./test_integration" ]; then
        print_status "Including integration tests from test_integration/"
        while IFS= read -r -d '' file; do
            test_files+=("$file")
        done < <(find ./test_integration -name "test_*.py" -type f -print0)
    fi

    if [ -d "./tests/test_integration" ]; then
        print_status "Including integration tests from tests/test_integration/"
        while IFS= read -r -d '' file; do
            test_files+=("$file")
        done < <(find ./tests/test_integration -name "test_*.py" -type f -print0)
    fi
fi

# Check if any test files exist
if [ ${#test_files[@]} -eq 0 ]; then
    if [ "$include_integration" = false ]; then
        print_warning "No unit test files found in tests/ directory"
    else
        print_warning "No test files found (checked both unit and integration tests)"
    fi
    exit 0
fi

print_status "Found ${#test_files[@]} test file(s) for coverage analysis"
print_status "Running tests SEQUENTIALLY to ensure accurate coverage tracking..."
echo

# Start coverage tracking
start_time=$(date +%s)
print_status "⏱️  Starting coverage analysis at $(date)"

# Clear any previous coverage data
source ../venv/bin/activate && coverage erase

# Initialize counters
total_tests=0
passed_tests=0
failed_tests=0
failed_test_files=()

# Run tests sequentially with coverage
for test_file in "${test_files[@]}"; do
    if [ -f "$test_file" ]; then
        total_tests=$((total_tests + 1))
        echo -n "[$total_tests/${#test_files[@]}] Running: $test_file ... "

        if TESTING=true source ../venv/bin/activate && coverage run --append --source=. "$VPYTHON" "$test_file" >/dev/null 2>&1; then
            passed_tests=$((passed_tests + 1))
            print_success "✓"
        else
            failed_tests=$((failed_tests + 1))
            failed_test_files+=("$test_file")
            print_error "✗"
        fi
    fi
done

# Calculate test execution time
test_end_time=$(date +%s)
test_duration=$((test_end_time - start_time))

echo
print_status "⏱️  Test execution completed in ${test_duration}s"
print_status "📊 Generating coverage report..."

# Generate coverage reports
coverage_start_time=$(date +%s)

# Generate terminal coverage report
source ../venv/bin/activate && coverage report > coverage_report.txt
coverage_report_exit_code=$?

# Display key coverage metrics
if [ $coverage_report_exit_code -eq 0 ]; then
    print_success "Coverage report generated successfully"

    # Extract and display key metrics
    echo
    print_status "📈 Coverage Summary:"
    echo "----------------------------------------"

    # Show overall coverage
    overall_coverage=$(tail -1 coverage_report.txt | awk '{print $4}')
    echo "Overall Coverage: $overall_coverage"

    # Show key file coverage
    echo
    echo "Key Files Coverage:"
    grep -E "(main\.py|gemini_service\.py|game_state\.py|firestore_service\.py)" coverage_report.txt | head -10

    echo "----------------------------------------"

    # Display full report
    echo
    print_status "📋 Full Coverage Report:"
    cat coverage_report.txt

else
    print_error "Failed to generate coverage report"
fi

# Generate HTML report if enabled
if [ "$generate_html" = true ]; then
    print_status "🌐 Generating HTML coverage report..."
    if source ../venv/bin/activate && coverage html --directory="/tmp/worldarchitectai/coverage"; then
        print_success "HTML coverage report generated in /tmp/worldarchitectai/coverage/"
        print_status "Open /tmp/worldarchitectai/coverage/index.html in your browser to view detailed coverage"
    else
        print_error "Failed to generate HTML coverage report"
    fi
else
    print_status "HTML report skipped (--no-html specified)"
fi

# Calculate coverage generation time
coverage_end_time=$(date +%s)
coverage_duration=$((coverage_end_time - coverage_start_time))
total_duration=$((coverage_end_time - start_time))

# Print timing summary
echo
print_status "⏱️  Timing Summary:"
echo "  Test execution: ${test_duration}s"
echo "  Coverage generation: ${coverage_duration}s"
echo "  Total time: ${total_duration}s"

# Print test summary
echo
print_status "🧪 Test Summary:"
echo "  Total tests: $total_tests"
echo "  Passed: $passed_tests"
echo "  Failed: $failed_tests"

# Show failed test details if any
if [ $failed_tests -gt 0 ]; then
    echo
    print_warning "Failed test files:"
    for failed_file in "${failed_test_files[@]}"; do
        echo "  - $failed_file"
    done
fi

# Final status
if [ $failed_tests -eq 0 ]; then
    print_success "✅ All tests passed with coverage analysis complete!"
    exit 0
else
    print_error "❌ $failed_tests test(s) failed"
    exit 1
fi
