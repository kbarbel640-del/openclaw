# Azure CLI Common Gotchas

Critical issues and workarounds for Azure CLI and Azure DevOps commands.

## Work Item Attachments - CRITICAL

> **NEVER use `az rest --body @file` for binary uploads - it corrupts files (uploads 0 bytes)**

Use `curl --data-binary @file` instead:

```bash
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)

# 1. Upload attachment (MUST use curl --data-binary)
UPLOAD_RESPONSE=$(curl -s -X POST \
  "https://dev.azure.com/yammer/engineering/_apis/wit/attachments?fileName=screenshot.png&api-version=7.0" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @"screenshot.png")

ATTACHMENT_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.url')

# 2. Attach to work item (REQUIRED for inline images to render)
curl -s -X PATCH \
  "https://dev.azure.com/yammer/engineering/_apis/wit/workitems/${BUG_ID}?api-version=7.0" \
  -H "Content-Type: application/json-patch+json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "[{\"op\":\"add\",\"path\":\"/relations/-\",\"value\":{\"rel\":\"AttachedFile\",\"url\":\"${ATTACHMENT_URL}\"}}]"

# 3. Reference in HTML field (use <img>, NOT markdown)
# value: "<p><img src=\"${ATTACHMENT_URL}\" alt=\"Screenshot\" /></p>"
```

**Critical gotchas:**

- `az rest --body @file` uploads 0-byte files - ALWAYS use `curl --data-binary`
- Inline images require AttachedFile relation - won't render without it
- Use HTML `<img>` tags in HTML fields - markdown `![](url)` doesn't render
- Use `dev.azure.com` endpoint - URL domain must match attachment relation domain

## PR Images - CRITICAL

> **Use REST API for PR descriptions with images - NOT `az repos pr update`**

`az repos pr update --description` escapes exclamation marks, breaking image markdown.

```bash
# 1. Get token
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)

# 2. Upload image to PR attachments
curl -s -X POST \
  "https://<ORG>.visualstudio.com/<PROJECT>/_apis/git/repositories/<REPO_ID>/pullRequests/<PR_ID>/attachments?fileName=image.png&api-version=7.1-preview.1" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @"image.png"

# 3. Update description via REST (not az repos pr update)
curl -s -X PATCH \
  "https://<ORG>.visualstudio.com/<PROJECT>/_apis/git/repositories/<REPO_ID>/pullrequests/<PR_ID>?api-version=7.1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"description": "![image](URL_FROM_UPLOAD)"}'
```

**Key points:**

- Use PNG format (JPG rendering is inconsistent)
- Extract URL from upload response `.url` field
- Use Python `json.dumps()` for proper escaping
- Use `#ID` for work items, not `AB#ID`

## PR Show Flag Limitations

**IMPORTANT:** `az repos pr show` only accepts `--id` and `--org`. Do NOT pass `-p`, `--project`, or `--repository` - they are not supported and will cause errors.

```bash
# CORRECT
az repos pr show --id 123 --org https://yammer.visualstudio.com

# WRONG - will error
az repos pr show --id 123 -p engineering --repository ios
```

## PR URLs - Never Hardcode

**CRITICAL - PR URLs:** Never hardcode PR URL formats. Always extract from `az repos pr show` output:

```bash
PR_INFO=$(az repos pr show --id 123 --org https://yammer.visualstudio.com -o json)
PR_URL=$(echo "$PR_INFO" | jq -r '"\(.repository.webUrl)/pullrequest/\(.pullRequestId)"')
echo "$PR_URL"  # e.g., https://yammer.visualstudio.com/engineering/_git/ios/pullrequest/123
```

- Use `.repository.webUrl` + `/pullrequest/` + `.pullRequestId`
- Different orgs have different URL patterns (dev.azure.com vs visualstudio.com)

## PR Diff Does Not Exist

> **`az repos pr diff` DOES NOT EXIST** - Use these methods instead:

```bash
# Method 1: Use git locally (RECOMMENDED)
# First get PR details to find source/target branches
az repos pr show --id 123 --query "{source:sourceRefName,target:targetRefName}" -o json

# Then use git diff
git fetch origin
git diff origin/main...origin/feature/x

# Method 2: Use REST API
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<ORG>.visualstudio.com/<PROJECT>/_apis/git/repositories/<REPO>/pullRequests/<PR_ID>/iterations?api-version=7.1" | jq .

# Method 3: Get changed files list via REST
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<ORG>.visualstudio.com/<PROJECT>/_apis/git/repositories/<REPO>/pullRequests/<PR_ID>/commits?api-version=7.1" | jq '.value[].commitId'
```

## Pipeline Runs vs Run

**IMPORTANT:** Use `az pipelines runs list` (with 's'), not `az pipelines run list`.

```bash
# CORRECT
az pipelines runs list --branch my-branch --top 5 -o table

# WRONG
az pipelines run list  # Does not exist
```

## PR Description vs Body

```bash
# az repos pr create uses --description (NOT --body like gh CLI)
az repos pr create --title "Feature X" \
  --description "PR description here" \
  --source-branch feature/x

# WRONG (this is gh CLI syntax)
az repos pr create --body "..."  # Does not work
```

## Default Branch Detection

```bash
# Check default branch first (may be master, not main)
git branch -r | grep 'origin/HEAD'  # Shows default branch
```

## DevOps Token Resource ID

The Azure DevOps resource ID for getting access tokens is:

```
499b84ac-1321-427f-aa17-267ca6975798
```

```bash
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)
```

## WIQL Escaping

```bash
# Escape backslashes in Area Path
az boards query --wiql "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team\\Feature'"

# Use UNDER for hierarchy (not CONTAINS)
```

## Binary File Uploads Summary

| Method                       | Works for Binary? | Notes                    |
| ---------------------------- | ----------------- | ------------------------ |
| `curl --data-binary`         | Yes               | Always use for images    |
| `az rest --body @file`       | NO                | Corrupts files (0 bytes) |
| `az devops invoke --in-file` | NO                | Text only                |
