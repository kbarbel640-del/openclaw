#!/usr/bin/env python3
"""
Interactive setup script for work loops.
Creates config file and provides cron job command.
"""

import json
import os
import subprocess
import sys
from pathlib import Path


def run_cmd(cmd: str) -> str:
    """Run shell command and return output."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()


def prompt(msg: str, default: str = "") -> str:
    """Prompt user for input with optional default."""
    if default:
        result = input(f"{msg} [{default}]: ").strip()
        return result if result else default
    return input(f"{msg}: ").strip()


def get_project_info(owner: str, project_num: int) -> dict | None:
    """Fetch project info via GraphQL."""
    query = f'''
    query {{
      user(login: "{owner}") {{
        projectV2(number: {project_num}) {{
          id
          title
          fields(first: 20) {{
            nodes {{
              ... on ProjectV2SingleSelectField {{
                id
                name
                options {{
                  id
                  name
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    '''
    
    result = run_cmd(f"gh api graphql -f query='{query}' 2>/dev/null")
    if not result:
        return None
    
    try:
        data = json.loads(result)
        return data.get("data", {}).get("user", {}).get("projectV2")
    except json.JSONDecodeError:
        return None


def main():
    print("=" * 60)
    print("Work Loop Setup")
    print("=" * 60)
    print()
    
    # Basic info
    if len(sys.argv) >= 2:
        repo_name = sys.argv[1]
    else:
        repo_name = prompt("Repository name (e.g., 'mahoraga')")
    
    if len(sys.argv) >= 3:
        github_repo = sys.argv[2]
    else:
        github_repo = prompt("GitHub repo (e.g., 'owner/repo')")
    
    if len(sys.argv) >= 4:
        repo_dir = sys.argv[3]
    else:
        default_dir = f"/home/{os.getenv('USER')}/src/{repo_name}"
        repo_dir = prompt("Local repo path", default_dir)
    
    display_name = prompt("Display name", repo_name.replace("-", " ").title())
    
    # Discord
    print()
    print("Discord Configuration:")
    discord_channel = prompt("Discord channel ID")
    discord_channel_name = prompt("Channel name (e.g., '#updates')", "#updates")
    
    # GitHub Project
    print()
    print("GitHub Project Configuration:")
    owner = github_repo.split("/")[0]
    
    print(f"\nFetching projects for {owner}...")
    projects_output = run_cmd(f"gh project list --owner {owner} 2>/dev/null")
    if projects_output:
        print(projects_output)
    
    project_num = int(prompt("Project number"))
    
    print(f"\nFetching project #{project_num} details...")
    project_info = get_project_info(owner, project_num)
    
    if project_info:
        project_id = project_info["id"]
        print(f"Found project: {project_info.get('title', 'Unknown')}")
        print(f"Project ID: {project_id}")
        
        # Find status field
        status_field = None
        status_options = {}
        
        for field in project_info.get("fields", {}).get("nodes", []):
            if field and field.get("name") == "Status":
                status_field = field["id"]
                print(f"\nStatus field ID: {status_field}")
                print("Options:")
                for opt in field.get("options", []):
                    print(f"  {opt['name']}: {opt['id']}")
                    name_lower = opt["name"].lower().replace(" ", "")
                    if name_lower == "ready":
                        status_options["ready"] = opt["id"]
                    elif name_lower == "inprogress":
                        status_options["inProgress"] = opt["id"]
                    elif name_lower == "inreview":
                        status_options["inReview"] = opt["id"]
                    elif name_lower == "done":
                        status_options["done"] = opt["id"]
                break
        
        if not status_field:
            print("\nCould not find Status field automatically.")
            status_field = prompt("Status field ID (PVTSSF_xxx)")
            status_options = {
                "ready": prompt("Ready option ID"),
                "inProgress": prompt("In Progress option ID"),
                "inReview": prompt("In Review option ID"),
                "done": prompt("Done option ID"),
            }
    else:
        print("\nCould not fetch project info automatically.")
        project_id = prompt("Project ID (PVT_xxx)")
        status_field = prompt("Status field ID (PVTSSF_xxx)")
        status_options = {
            "ready": prompt("Ready option ID"),
            "inProgress": prompt("In Progress option ID"),
            "inReview": prompt("In Review option ID"),
            "done": prompt("Done option ID"),
        }
    
    # Optional settings
    print()
    print("Optional Settings (press Enter for defaults):")
    worktree_prefix = prompt("Worktree prefix", f"/tmp/{repo_name}")
    branch_prefix = prompt("Branch prefix", "fix")
    max_agents = int(prompt("Max sub-agents", "3"))
    sub_agent_model = prompt("Sub-agent model", "moonshot/kimi-for-coding")
    coding_standards = prompt("Coding standards file (blank for none)", "")
    
    # Build config
    config = {
        "repo": github_repo,
        "repoDir": repo_dir,
        "displayName": display_name,
        "projectOwner": owner,
        "projectNum": project_num,
        "projectId": project_id,
        "statusField": status_field,
        "statusOptions": status_options,
        "discordChannel": discord_channel,
        "discordChannelName": discord_channel_name,
        "worktreePrefix": worktree_prefix,
        "branchPrefix": branch_prefix,
        "forbiddenPaths": ["/home/dan/clawd"],
        "maxSubAgents": max_agents,
        "subAgentModel": sub_agent_model,
    }
    
    if coding_standards:
        config["codingStandardsFile"] = coding_standards
    
    # Write config
    config_dir = Path.home() / ".config" / "work-loops"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / f"{repo_name}.json"
    
    print()
    print("=" * 60)
    print("Configuration:")
    print(json.dumps(config, indent=2))
    print("=" * 60)
    
    if prompt("\nWrite config?", "y").lower() == "y":
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        print(f"\n✓ Config written to {config_path}")
    
    # Output cron command
    print()
    print("=" * 60)
    print("Next Steps:")
    print("=" * 60)
    print()
    print("1. Ensure gate script is installed:")
    print("   cp scripts/work-loop-gate.sh ~/bin/")
    print("   chmod +x ~/bin/work-loop-gate.sh")
    print()
    print("2. Create the cron job:")
    print(f'''   openclaw cron add \\
     --name "{repo_name}-loop" \\
     --schedule '{{"kind":"every","everyMs":120000}}' \\
     --payload '{{"kind":"script","command":"bash ~/bin/work-loop-gate.sh <JOB_ID> {repo_name} {max_agents}","timeout":30,"model":"sonnet","thinking":"low"}}' \\
     --sessionTarget isolated''')
    print()
    print("3. After creating, get the job ID and update the command:")
    print("   openclaw cron list")
    print(f"   openclaw cron update <job-id> --patch '{{\"payload\":{{\"command\":\"bash ~/bin/work-loop-gate.sh <ACTUAL_JOB_ID> {repo_name} {max_agents}\"}}}}'")
    print()
    print("4. Add issues to your GitHub Project board and drag to Ready!")


if __name__ == "__main__":
    main()
