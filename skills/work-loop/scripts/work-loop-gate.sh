#!/bin/bash
# Generic work loop gate script
# Reads config from ~/.config/work-loops/{repo-name}.json
#
# Usage: work-loop-gate.sh <cron-job-id> <repo-name> [max-agents]
#
# Priority order:
#   1. Fix blocked PRs (comments indicate issues)
#   2. Verify PRs in "In Review" that haven't been reviewed
#   3. Execute new work from "Ready" column

set -euo pipefail

JOB_ID="${1:?Usage: $0 <cron-job-id> <repo-name> [max-agents]}"
REPO_NAME="${2:?Usage: $0 <cron-job-id> <repo-name> [max-agents]}"
MAX_AGENTS_OVERRIDE="${3:-}"

CONFIG_FILE="$HOME/.config/work-loops/${REPO_NAME}.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo '{"run": false, "reason": "Config not found: '"$CONFIG_FILE"'"}'
  exit 0
fi

# Load config
CONFIG=$(cat "$CONFIG_FILE")

# Extract values from config
REPO=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['repo'])")
REPO_DIR=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['repoDir'])")
PROJECT_OWNER=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['projectOwner'])")
PROJECT_NUM=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['projectNum'])")
PROJECT_ID=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['projectId'])")
STATUS_FIELD=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['statusField'])")
STATUS_IN_PROGRESS=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['statusOptions']['inProgress'])")
STATUS_DONE=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['statusOptions']['done'])")
DISCORD_CHANNEL=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['discordChannel'])")
DISCORD_CHANNEL_NAME=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('discordChannelName', '#updates'))")
WORKTREE_PREFIX=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('worktreePrefix', '/tmp/' + sys.stdin.name))" 2>/dev/null || echo "/tmp/${REPO_NAME}")
WORKTREE_PREFIX=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('worktreePrefix', '/tmp/${REPO_NAME}'))")
BRANCH_PREFIX=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('branchPrefix', 'fix'))")
MAX_AGENTS=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('maxSubAgents', 3))")
SUB_AGENT_MODEL=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('subAgentModel', 'moonshot/kimi-for-coding'))")
CODING_STANDARDS=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('codingStandardsFile', ''))")
FORBIDDEN_PATHS=$(echo "$CONFIG" | python3 -c "import sys,json; print(' '.join(json.load(sys.stdin).get('forbiddenPaths', ['/home/dan/clawd'])))")
DISPLAY_NAME=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('displayName', '${REPO_NAME}'))")

# Override max agents if provided on command line
[ -n "$MAX_AGENTS_OVERRIDE" ] && MAX_AGENTS="$MAX_AGENTS_OVERRIDE"

CRON_SESSION_KEY="agent:main:cron:${JOB_ID}"

# Temp files
BOARD_FILE=$(mktemp)
PRS_FILE=$(mktemp)
WORK_FILE=$(mktemp)
trap "rm -f $BOARD_FILE $PRS_FILE $WORK_FILE" EXIT

# --- Helper: emit JSON and exit ---
emit() { python3 -c "import json,sys; json.dump($1, sys.stdout)"; exit 0; }

# --- 1. Count active sub-agents ---
ACTIVE=$(openclaw sessions --json --active 5 2>/dev/null \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
sessions = data if isinstance(data, list) else data.get('sessions', [])
count = sum(1 for s in sessions if s.get('spawnedBy') == '${CRON_SESSION_KEY}')
print(count)
" 2>/dev/null || echo "0")

CAPACITY=$((MAX_AGENTS - ACTIVE))

if [ "$CAPACITY" -le 0 ]; then
  emit "{'run': False, 'reason': '${ACTIVE} sub-agents active (max ${MAX_AGENTS})'}"
fi

# --- 2. Query board and open PRs ---
gh project item-list "$PROJECT_NUM" --owner "$PROJECT_OWNER" -L 50 --format json >"$BOARD_FILE" 2>/dev/null || echo '{"items":[]}' >"$BOARD_FILE"
gh pr list --repo "$REPO" --state open --json number,title,headRefName,comments --limit 20 >"$PRS_FILE" 2>/dev/null || echo '[]' >"$PRS_FILE"

# --- 3. Analyze board and PRs ---
python3 - "$BOARD_FILE" "$PRS_FILE" "$WORK_FILE" "$BRANCH_PREFIX" << 'PYEOF'
import sys, json

board_file, prs_file, work_file, branch_prefix = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

with open(board_file) as f:
    board = json.load(f)
with open(prs_file) as f:
    prs = json.load(f)

items = board.get('items', [])

ready, in_progress, in_review = [], [], []

for i in items:
    status = i.get('status', '')
    num = i.get('content', {}).get('number', 0)
    title = i.get('title', '')
    item_id = i.get('id', '')
    entry = {'number': num, 'title': title, 'id': item_id}
    
    if status == 'Ready':
        ready.append(entry)
    elif status == 'In progress':
        in_progress.append(entry)
    elif status == 'In review':
        in_review.append(entry)

# PR lookup by issue number
pr_by_issue = {}
for pr in prs:
    branch = pr.get('headRefName', '')
    if branch.startswith(f'{branch_prefix}/'):
        try:
            issue_num = int(branch.split('/')[1].split('-')[0])
            pr_by_issue[issue_num] = pr
        except:
            pass

result = None

# Priority 1: Blocked PRs
blocked_keywords = ['blocked', 'not merge', 'do not merge', 'issues found', 'coding standards violation', '❌', 'required fix', 'not ready']
for pr in prs:
    comments = pr.get('comments', [])
    for comment in comments:
        body = comment.get('body', '').lower()
        if any(kw in body for kw in blocked_keywords):
            # Check if there's a newer "fixed" comment
            fixed_keywords = ['fixed', 'ready for re-review', 'addressed', 'resolved']
            is_fixed = False
            for c2 in comments:
                if any(fk in c2.get('body', '').lower() for fk in fixed_keywords):
                    is_fixed = True
                    break
            if not is_fixed:
                result = {
                    "type": "fix",
                    "pr_number": pr['number'],
                    "pr_title": pr['title'],
                    "branch": pr['headRefName'],
                    "block_reason": comment.get('body', '')[:800]
                }
                break
    if result:
        break

# Priority 2: Unreviewed PRs
if not result:
    for item in in_review:
        issue_num = item['number']
        pr = pr_by_issue.get(issue_num)
        if pr and len(pr.get('comments', [])) == 0:
            result = {
                "type": "verify",
                "pr_number": pr['number'],
                "pr_title": pr['title'],
                "issue_number": issue_num,
                "issue_title": item['title']
            }
            break

# Priority 3: Ready items
if not result and ready:
    top = ready[0]
    result = {
        "type": "execute",
        "issue_number": top['number'],
        "issue_title": top['title'],
        "item_id": top['id']
    }

if not result:
    parts = []
    if in_progress: parts.append(f"{len(in_progress)} in progress")
    if in_review: parts.append(f"{len(in_review)} in review")
    summary = ', '.join(parts) if parts else 'board empty'
    result = {"type": "idle", "reason": f"No actionable work ({summary})"}

with open(work_file, 'w') as f:
    json.dump(result, f)
PYEOF

WORK_ITEM=$(cat "$WORK_FILE")
WORK_TYPE=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin).get('type','error'))")

# --- 4. Handle based on type ---
case "$WORK_TYPE" in
  error|idle)
    REASON=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reason','unknown'))")
    emit "{'run': False, 'reason': '${REASON}'}"
    ;;
    
  fix)
    PR_NUM=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['pr_number'])")
    PR_TITLE=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['pr_title'])" | sed 's/"/\\"/g')
    BRANCH=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['branch'])")
    BLOCK_REASON=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['block_reason'])" | sed 's/"/\\"/g' | head -20)
    
    cat << FIXEOF
{"run": true, "message": "You are fixing a BLOCKED PR for ${DISPLAY_NAME}.\n\n## PR #${PR_NUM}: ${PR_TITLE}\n\n## Why It's Blocked\n${BLOCK_REASON}\n\n## Your Task\n1. Clone: git clone --branch ${BRANCH} git@github.com:${REPO}.git /tmp/fix-pr-${PR_NUM}\n2. Fix the issues mentioned above\n3. Read coding standards from /home/dan/clawd/WORK-LOOP.md\n4. Commit and push\n5. Add comment: 'Fixed - ready for re-review'\n\n## FORBIDDEN\n${FORBIDDEN_PATHS}\n\nUse model ${SUB_AGENT_MODEL} for sub-agents.\nPost status to Discord ${DISCORD_CHANNEL_NAME} (${DISCORD_CHANNEL})", "taskType": "fix", "prNumber": ${PR_NUM}, "repo": "${REPO_NAME}"}
FIXEOF
    ;;
    
  verify)
    PR_NUM=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['pr_number'])")
    PR_TITLE=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['pr_title'])" | sed 's/"/\\"/g')
    ISSUE_NUM=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['issue_number'])")
    ISSUE_TITLE=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['issue_title'])" | sed 's/"/\\"/g')
    
    cat << VERIFYEOF
{"run": true, "message": "VERIFY PR #${PR_NUM} for ${DISPLAY_NAME}: ${PR_TITLE}\nFor Issue #${ISSUE_NUM}: ${ISSUE_TITLE}\n\n## Review Checklist\n1. Diff matches issue\n2. Only expected files changed\n3. Follows coding standards (see /home/dan/clawd/WORK-LOOP.md)\n\n## Commands\ngh pr view ${PR_NUM} --repo ${REPO}\ngh pr diff ${PR_NUM} --repo ${REPO}\n\n## Decision\n- CLEAN: gh-as-ada pr merge ${PR_NUM} --repo ${REPO} --squash --delete-branch\n- ISSUES: Comment on PR, do NOT merge\n\n## Important\n- try/finally for cleanup is OK\n- try/except that swallows errors is NOT OK\n\n## FORBIDDEN\n${FORBIDDEN_PATHS}", "taskType": "verify", "prNumber": ${PR_NUM}, "repo": "${REPO_NAME}"}
VERIFYEOF
    ;;
    
  execute)
    ISSUE_NUM=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['issue_number'])")
    ISSUE_TITLE=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['issue_title'])" | sed 's/"/\\"/g')
    ITEM_ID=$(echo "$WORK_ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['item_id'])")
    
    ISSUE_BODY=$(gh-as-ada issue view "$ISSUE_NUM" --repo "$REPO" --json body --jq '.body' 2>/dev/null | head -150 | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" | sed 's/^"//;s/"$//') || ISSUE_BODY="(could not fetch)"
    
    BRANCH="${BRANCH_PREFIX}/${ISSUE_NUM}"
    WORKTREE="${WORKTREE_PREFIX}-${ISSUE_NUM}"
    
    cd "$REPO_DIR"
    git fetch origin main --quiet >/dev/null 2>&1 || true
    git checkout main --quiet >/dev/null 2>&1 || true
    git pull --quiet >/dev/null 2>&1 || true
    
    [ -d "$WORKTREE" ] && (git worktree remove "$WORKTREE" --force >/dev/null 2>&1 || rm -rf "$WORKTREE")
    git branch -D "$BRANCH" >/dev/null 2>&1 || true
    
    if ! git worktree add "$WORKTREE" -b "$BRANCH" origin/main >/dev/null 2>&1; then
      emit "{'run': False, 'reason': 'Failed to create worktree for #${ISSUE_NUM}'}"
    fi
    
    gh api graphql -f query="mutation { updateProjectV2ItemFieldValue(input: { projectId: \"${PROJECT_ID}\", itemId: \"${ITEM_ID}\", fieldId: \"${STATUS_FIELD}\", value: { singleSelectOptionId: \"${STATUS_IN_PROGRESS}\" } }) { projectV2Item { id } } }" >/dev/null 2>&1 || true
    
    STANDARDS_NOTE=""
    [ -n "$CODING_STANDARDS" ] && STANDARDS_NOTE="Check ${WORKTREE}/${CODING_STANDARDS} for repo-specific standards."
    
    cat << EXECEOF
{"run": true, "message": "Execute issue #${ISSUE_NUM} for ${DISPLAY_NAME}: ${ISSUE_TITLE}\n\n## Description\n${ISSUE_BODY}\n\n## Workspace\nWorktree: ${WORKTREE} (branch ${BRANCH})\n\n## Instructions\n1. Read /home/dan/clawd/WORK-LOOP.md for execution model\n2. ${STANDARDS_NOTE}\n3. Work ONLY in ${WORKTREE}\n4. Commit, push, create PR: gh-as-ada pr create\n5. Post status to Discord ${DISCORD_CHANNEL_NAME} (${DISCORD_CHANNEL})\n\n## FORBIDDEN\n${FORBIDDEN_PATHS}\n\nUse ${SUB_AGENT_MODEL} for sub-agents.", "taskType": "execute", "issueNumber": ${ISSUE_NUM}, "repo": "${REPO_NAME}"}
EXECEOF
    ;;
    
  *)
    emit "{'run': False, 'reason': 'Unknown work type: ${WORK_TYPE}'}"
    ;;
esac
