#!/usr/bin/env python3
"""
GitHub Fork Creation Helper
Creates a fork and pushes your branch to it.

Usage:
    python3 create-fork-helper.py
    
Or with token:
    GITHUB_TOKEN="your-token" python3 create-fork-helper.py
"""

import os
import sys
import json
import time
import subprocess
from urllib.request import Request, urlopen
from urllib.error import URLError

# Configuration
GITHUB_USER = "trungutt"
UPSTREAM_REPO = "openclaw/openclaw"
FORK_REPO = f"{GITHUB_USER}/openclaw"
BRANCH_NAME = "optimize/docker-buildkit-cache"

def print_header(text):
    """Print a formatted header"""
    print("\n" + "╔" + "═" * 66 + "╗")
    print("║  " + text.ljust(64) + "║")
    print("╚" + "═" * 66 + "╝\n")

def print_step(num, text):
    """Print a step"""
    print(f"Step {num}: {text}")

def print_success(text):
    """Print success message"""
    print(f"✓ {text}")

def print_error(text):
    """Print error message"""
    print(f"✗ {text}", file=sys.stderr)

def print_info(text):
    """Print info message"""
    print(f"ℹ {text}")

def get_github_token():
    """Get GitHub token from environment or prompt user"""
    token = os.environ.get("GITHUB_TOKEN")
    
    if not token:
        print_info("GITHUB_TOKEN not set in environment")
        print("\nTo get a token:")
        print("  1. Go to: https://github.com/settings/tokens")
        print("  2. Click 'Generate new token' (classic)")
        print("  3. Select scopes: repo, admin:repo_hook")
        print("  4. Copy the token")
        print()
        token = input("Paste your GitHub token: ").strip()
    
    if not token:
        print_error("No token provided")
        sys.exit(1)
    
    return token

def api_request(endpoint, method="GET", data=None, token=None):
    """Make GitHub API request"""
    url = f"https://api.github.com{endpoint}"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "OpenClaw-Fork-Helper"
    }
    
    if token:
        headers["Authorization"] = f"token {token}"
    
    if data:
        data = json.dumps(data).encode('utf-8')
    
    try:
        req = Request(url, data=data, headers=headers, method=method)
        with urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except URLError as e:
        error_data = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        try:
            return json.loads(error_data)
        except:
            return {"error": str(error_data)}

def create_fork(token):
    """Create fork via GitHub API"""
    print_step(1, "Creating fork...")
    
    response = api_request(
        f"/repos/{UPSTREAM_REPO}/forks",
        method="POST",
        data={},
        token=token
    )
    
    if "id" in response:
        print_success("Fork created or already exists")
        return True
    elif "message" in response and "Validation Failed" in response["message"]:
        print_info("Fork already exists (or creation in progress)")
        return True
    else:
        print_error(f"Fork creation failed: {response}")
        return False

def wait_for_fork(token, timeout=60):
    """Wait for fork to be ready"""
    print_step(2, f"Waiting for fork to be ready (max {timeout}s)...")
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        response = api_request(f"/repos/{FORK_REPO}", token=token)
        
        if "id" in response:
            print_success("Fork is ready!")
            return True
        
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(2)
    
    print_error(f"Fork not ready after {timeout}s")
    return False

def add_git_remote():
    """Add fork as git remote"""
    print_step(3, "Adding fork as git remote...")
    
    # Check if remote already exists
    result = subprocess.run(["git", "remote"], capture_output=True, text=True)
    if "fork" in result.stdout:
        print_info("Fork remote already exists")
        return True
    
    # Add remote
    result = subprocess.run(
        ["git", "remote", "add", "fork", f"https://github.com/{FORK_REPO}.git"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print_success("Fork remote added")
        return True
    else:
        print_error(f"Failed to add remote: {result.stderr}")
        return False

def push_branch():
    """Push branch to fork"""
    print_step(4, f"Pushing branch '{BRANCH_NAME}' to fork...")
    
    result = subprocess.run(
        ["git", "push", "-u", "fork", BRANCH_NAME],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print_success("Branch pushed successfully!")
        return True
    else:
        print_error(f"Failed to push branch: {result.stderr}")
        return False

def main():
    """Main execution"""
    print_header("GitHub Fork Creation Helper")
    
    # Get token
    token = get_github_token()
    print_success("Token obtained")
    print()
    
    # Create fork
    if not create_fork(token):
        sys.exit(1)
    print()
    
    # Wait for fork
    if not wait_for_fork(token):
        print_info("Fork might still be creating. Continuing anyway...")
    print()
    
    # Add remote
    if not add_git_remote():
        sys.exit(1)
    print()
    
    # Push branch
    if not push_branch():
        sys.exit(1)
    print()
    
    # Success!
    print_header("✅ FORK & PUSH COMPLETE!")
    
    print(f"Your branch is now on GitHub:")
    print(f"  https://github.com/{FORK_REPO}/tree/{BRANCH_NAME}")
    print()
    print("Next steps:")
    print()
    print("1. View your fork:")
    print(f"   https://github.com/{FORK_REPO}")
    print()
    print("2. Create Pull Request:")
    print(f"   https://github.com/{FORK_REPO}/pull/new/{BRANCH_NAME}")
    print()
    print("   Or use GitHub CLI:")
    print(f"   gh pr create --repo {UPSTREAM_REPO} --base main --head {GITHUB_USER}:{BRANCH_NAME}")
    print()
    print("3. Use PR_SUMMARY.md as PR description template")
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("\nAborted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
