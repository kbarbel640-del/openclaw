#!/usr/bin/env python3
"""
OpenCode Coder Helper
Quick wrapper for running OpenCode coding tasks with PTY support
"""
import subprocess
import sys
import os

def run_opencode(prompt, workdir=None):
    """
    Run OpenCode with PTY support

    Args:
        prompt: The coding task/prompt
        workdir: Working directory (for context)
    """
    # Construct command
    cmd = ["opencode", "run", prompt]

    # Run with openclaw bash for PTY support
    if workdir:
        # Use openclaw's bash with pty and workdir
        openclaw_cmd = [
            "bash", "pty:true", f"workdir:{workdir}", f"command:opencode run '{prompt}'"
        ]
        print(f"Running OpenCode in directory: {workdir}")
        print(f"Task: {prompt}")
        print("-" * 60)
        subprocess.run(openclaw_cmd, shell=True)
    else:
        # Standard execution
        print(f"Running OpenCode")
        print(f"Task: {prompt}")
        print("-" * 60)
        subprocess.run(cmd)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python opencode_helper.py 'Your coding prompt' [workdir]")
        print("\nExamples:")
        print("  python opencode_helper.py 'Create a Flask REST API' ~/myproject")
        print("  python opencode_helper.py 'Fix the bug in auth.py'")
        sys.exit(1)

    prompt = sys.argv[1]
    workdir = sys.argv[2] if len(sys.argv) > 2 else None

    run_opencode(prompt, workdir)
