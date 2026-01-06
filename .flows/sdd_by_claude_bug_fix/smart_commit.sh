#!/bin/bash

################################################################################
# Smart Commit for SDD Flow
#
# Purpose: Intelligent git commit with proper message generation
# Analyzes changes and creates descriptive commit message
################################################################################

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Helper functions
log_info() { echo -e "${BLUE}[COMMIT]${NC} $1"; }
log_success() { echo -e "${GREEN}[COMMIT]${NC} ✅ $1"; }
log_warning() { echo -e "${YELLOW}[COMMIT]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[COMMIT]${NC} ❌ $1"; }

usage() {
    cat << 'EOF'
Smart Commit for SDD Flow

Automatically generates intelligent commit messages based on changes

USAGE:
    ./smart_commit.sh [message-prefix]
    ./smart_commit.sh "Add feature"
    ./smart_commit.sh --feature "My Feature"
    ./smart_commit.sh --feature "My Feature" --auto  # No prompts

OPTIONS:
    --feature <name>    Feature name for SDD-specific message
    --auto              Skip confirmation (for AI agents)
    --help, -h          Show this help

EXIT CODES:
    0: Commit successful
    1: Nothing to commit
    2: Git error
EOF
}

# Parse arguments
COMMIT_PREFIX=""
FEATURE_NAME=""
AUTO="true"  # Always auto mode by default

while [[ $# -gt 0 ]]; do
    case $1 in
        --feature)
            FEATURE_NAME="$2"
            shift 2
            ;;
        --manual)
            AUTO="false"  # Only manual mode when explicitly requested
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            COMMIT_PREFIX="$1"
            shift
            ;;
    esac
done

# Check if in git repo
if [ ! -d ".git" ]; then
    log_error "Not in a git repository"
    exit 2
fi

# Get current branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
log_info "Current branch: $current_branch"

# Check if there are changes to commit
git_status=$(git status --porcelain)

if [ -z "$git_status" ]; then
    log_info "No changes to commit"
    exit 0
fi

log_info "Found changes to commit:"
echo "$git_status" | sed 's/^/  /'

# Determine commit type and message
if [ -n "$FEATURE_NAME" ]; then
    # SDD feature commit
    commit_type="docs(sdd)"
    commit_message="add SDD for $FEATURE_NAME"
    
    # Add details about what was created
    if echo "$git_status" | grep -q "docs/sdd/"; then
        commit_body="Generated complete SDD package with requirements, UI flow, gaps, tests, and executable cards"
    else
        commit_body="Update SDD documentation and templates"
    fi
else
    # General commit
    # Determine type based on changed files
    if echo "$git_status" | grep -q "^M"; then
        commit_type="chore"
        commit_message="update system files"
    elif echo "$git_status" | grep -q "^A"; then
        commit_type="feat"
        commit_message="add new functionality"
    elif echo "$git_status" | grep -q "^D"; then
        commit_type="chore"
        commit_message="remove obsolete files"
    else
        commit_type="chore"
        commit_message="system update"
    fi
    
    commit_body="Various updates to SDD Flow system"
fi

# Apply prefix if provided
if [ -n "$COMMIT_PREFIX" ]; then
    commit_message="$COMMIT_PREFIX: $commit_message"
fi

# Show commit details
echo ""
log_info "Commit Details:"
echo "  Type: $commit_type"
echo "  Message: $commit_message"
echo "  Body: $commit_body"

# Confirm before committing (skip if auto mode, which is default)
if [ "$AUTO" = "true" ]; then
    log_info "Auto mode: executing commit without confirmation"
else
n    read -p "Execute commit? [y/N]: " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Commit cancelled"
        exit 0
    fi
fi

# Stage changes if needed
echo ""
log_info "Staging changes..."
git add -A
echo -n "  " && git diff --cached --stat | tail -1

# Generate final commit message
cat > /tmp/commit-msg.txt << EOF
$commit_message

$commit_body
EOF

# Show the commit command
log_info "Executing: git commit -F /tmp/commit-msg.txt"

# Execute commit
if git commit -F /tmp/commit-msg.txt; then
    commit_hash=$(git rev-parse --short HEAD)
    log_success "Commit successful: $commit_hash"
    
    # Show what was committed
    echo ""
    log_info "Committed changes:"
    git show --stat $commit_hash | tail -3
    
    # Copy to clipboard if possible
    if command -v xclip &> /dev/null; then
        echo "$commit_hash: $commit_message" | xclip -selection clipboard
        log_info "Commit hash copied to clipboard"
    elif command -v pbcopy &> /dev/null; then
        echo "$commit_hash: $commit_message" | pbcopy
        log_info "Commit hash copied to clipboard"
    fi
else
    log_error "Commit failed"
    exit 2
fi

# Verify commit exists
git log -1 --oneline
echo ""
log_success "Commit verification complete"

# Clean up
rm -f /tmp/commit-msg.txt

# Give next steps
if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
    echo ""
    log_info "Next steps:"
    echo "  - Push branch: git push -u origin $current_branch"
    echo "  - Create PR: gh pr create --title \"$commit_message\""
fi

exit 0
