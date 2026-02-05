#!/usr/bin/env python3
"""
Instance Manager - 管理多個 Claude Code 實例
每個任務跑在獨立的 git worktree，互不干擾。
"""

import asyncio
import json
import os
import signal
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError


@dataclass
class Instance:
    id: str
    prompt: str
    repo_path: str
    branch: str
    worktree_path: str
    model: str
    budget: float
    status: str  # running / completed / failed / cancelled
    pid: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    returncode: Optional[int] = None
    created_at: str = ""
    finished_at: Optional[str] = None
    cost_usd: Optional[float] = None
    system_prompt: Optional[str] = None
    allowed_tools: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> dict:
        """Short summary for list view."""
        return {
            "id": self.id,
            "prompt": self.prompt[:120],
            "status": self.status,
            "branch": self.branch,
            "repo_path": self.repo_path,
            "model": self.model,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "cost_usd": self.cost_usd,
        }


class InstanceManager:
    def __init__(self, config: dict):
        self.config = config
        self.instances: dict[str, Instance] = {}
        self._tasks: dict[str, asyncio.Task] = {}

        self.claude_bin = config["claude"]["binary"]
        self.default_model = config["claude"]["default_model"]
        self.default_budget = config["claude"]["max_budget_usd"]
        self.default_tools = config["claude"]["allowed_tools"]
        self.timeout = config["claude"]["timeout_seconds"]
        self.worktree_base = Path(config["worktree_base"])
        self.max_concurrent = config["limits"]["max_concurrent"]
        self.notifications = config.get("notifications", {})

        self.worktree_base.mkdir(parents=True, exist_ok=True)
        self._state_file = self.worktree_base.parent / "state.json"
        self._load_state()

    # --- Public API ---

    def active_count(self) -> int:
        return sum(1 for i in self.instances.values() if i.status == "running")

    async def start(
        self,
        prompt: str,
        repo_path: str,
        branch: Optional[str] = None,
        model: Optional[str] = None,
        budget: Optional[float] = None,
        allowed_tools: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> Instance:
        if self.active_count() >= self.max_concurrent:
            raise RuntimeError("Max concurrent limit reached")

        repo = Path(repo_path).expanduser().resolve()
        if not (repo / ".git").exists() and not repo.joinpath(".git").is_file():
            raise ValueError(f"Not a git repo: {repo}")

        if not Path(self.claude_bin).exists():
            raise FileNotFoundError(f"Claude binary not found: {self.claude_bin}")

        now = datetime.now()
        inst_id = f"sq-{now.strftime('%Y%m%d-%H%M%S')}"

        if not branch:
            slug = re.sub(r'[^a-z0-9]+', '-', prompt[:30].lower()).strip('-')
            branch = f"squad/{now.strftime('%Y%m%d')}-{slug}"

        wt_path = str(self.worktree_base / inst_id)

        # Create git worktree
        await self._run_git(repo, ["worktree", "add", wt_path, "-b", branch, "HEAD"])

        inst = Instance(
            id=inst_id,
            prompt=prompt,
            repo_path=str(repo),
            branch=branch,
            worktree_path=wt_path,
            model=model or self.default_model,
            budget=budget if budget is not None else self.default_budget,
            status="running",
            created_at=now.isoformat(),
            system_prompt=system_prompt,
            allowed_tools=allowed_tools,
        )

        self.instances[inst_id] = inst
        self._save_state()

        # Launch claude subprocess in background
        task = asyncio.create_task(self._run_claude(inst))
        self._tasks[inst_id] = task
        return inst

    async def cancel(self, inst_id: str) -> Instance:
        inst = self._get(inst_id)
        if inst.status != "running":
            raise ValueError(f"Instance {inst_id} is not running (status={inst.status})")
        if inst.pid:
            try:
                os.kill(inst.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        inst.status = "cancelled"
        inst.finished_at = datetime.now().isoformat()
        self._save_state()
        return inst

    async def cleanup(self, inst_id: str) -> None:
        inst = self._get(inst_id)
        if inst.status == "running":
            await self.cancel(inst_id)

        # Remove worktree
        repo = Path(inst.repo_path)
        try:
            await self._run_git(repo, ["worktree", "remove", inst.worktree_path, "--force"])
        except Exception:
            pass  # worktree may already be gone

        # Remove branch
        try:
            await self._run_git(repo, ["branch", "-D", inst.branch])
        except Exception:
            pass

        # Remove task ref
        self._tasks.pop(inst_id, None)
        del self.instances[inst_id]
        self._save_state()

    def list_instances(self, status: Optional[str] = None) -> list[dict]:
        instances = self.instances.values()
        if status:
            instances = [i for i in instances if i.status == status]
        return [i.summary() for i in sorted(instances, key=lambda x: x.created_at, reverse=True)]

    def get(self, inst_id: str, lines: int = 0) -> dict:
        inst = self._get(inst_id)
        d = inst.to_dict()
        if lines > 0 and inst.stdout:
            d["stdout"] = "\n".join(inst.stdout.split("\n")[-lines:])
        return d

    async def get_diff(self, inst_id: str) -> str:
        inst = self._get(inst_id)
        wt = Path(inst.worktree_path)
        if not wt.exists():
            return "(worktree removed)"
        proc = await asyncio.create_subprocess_exec(
            "git", "diff", "HEAD",
            cwd=str(wt),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        return stdout.decode(errors="replace")

    # --- Internal ---

    def _get(self, inst_id: str) -> Instance:
        if inst_id not in self.instances:
            raise KeyError(f"Instance not found: {inst_id}")
        return self.instances[inst_id]

    async def _run_git(self, repo: Path, args: list[str]) -> str:
        proc = await asyncio.create_subprocess_exec(
            "git", "-C", str(repo), *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"git {' '.join(args)} failed: {stderr.decode(errors='replace')}")
        return stdout.decode(errors="replace")

    async def _run_claude(self, inst: Instance):
        """Run claude -p subprocess and wait for completion."""
        tools = inst.allowed_tools or self.default_tools
        cmd = [
            self.claude_bin, "-p",
            "--model", inst.model,
            "--allowedTools", tools,
            "--max-budget-usd", str(inst.budget),
            "--output-format", "json",
        ]
        if inst.system_prompt:
            cmd.extend(["--append-system-prompt", inst.system_prompt])
        cmd.append(inst.prompt)

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=inst.worktree_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            inst.pid = proc.pid
            self._save_state()

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=self.timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                inst.status = "failed"
                inst.stderr = "Timeout exceeded"
                inst.returncode = -1
                inst.finished_at = datetime.now().isoformat()
                self._save_state()
                await self._notify(inst)
                return

            inst.stdout = stdout.decode(errors="replace")
            inst.stderr = stderr.decode(errors="replace")
            inst.returncode = proc.returncode
            inst.status = "completed" if proc.returncode == 0 else "failed"
            inst.finished_at = datetime.now().isoformat()

            # Parse cost from JSON output
            self._parse_cost(inst)

            # Auto-commit in worktree
            await self._auto_commit(inst)

            self._save_state()
            await self._notify(inst)

        except Exception as e:
            inst.status = "failed"
            inst.stderr = str(e)
            inst.returncode = -1
            inst.finished_at = datetime.now().isoformat()
            self._save_state()
            await self._notify(inst)

    def _parse_cost(self, inst: Instance):
        try:
            data = json.loads(inst.stdout)
            # claude --output-format json returns cost info
            cost = data.get("cost_usd") or data.get("usage", {}).get("cost_usd")
            if cost is not None:
                inst.cost_usd = float(cost)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    async def _auto_commit(self, inst: Instance):
        """Git add + commit in worktree if there are changes."""
        wt = Path(inst.worktree_path)
        if not wt.exists():
            return
        try:
            # Check for changes
            proc = await asyncio.create_subprocess_exec(
                "git", "status", "--porcelain",
                cwd=str(wt),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            if not stdout.decode().strip():
                return

            # Stage + commit
            await asyncio.create_subprocess_exec(
                "git", "add", "-A", cwd=str(wt),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            msg = f"[squad] {inst.id}: {inst.prompt[:60]}"
            proc = await asyncio.create_subprocess_exec(
                "git", "commit", "-m", msg,
                cwd=str(wt),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
        except Exception:
            pass

    async def _notify(self, inst: Instance):
        """Send Telegram notification via http_bridge."""
        bridge_url = self.notifications.get("telegram_bridge_url")
        chat_id = self.notifications.get("notify_chat")
        if not bridge_url or not chat_id:
            return

        status_emoji = "✅" if inst.status == "completed" else "❌" if inst.status == "failed" else "🚫"

        # Get diffstat
        diffstat = ""
        try:
            wt = Path(inst.worktree_path)
            if wt.exists():
                proc = await asyncio.create_subprocess_exec(
                    "git", "diff", "HEAD~1", "--stat",
                    cwd=str(wt),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                diffstat = stdout.decode(errors="replace").strip()
        except Exception:
            pass

        lines = [
            f"📦 Squad 任務完成",
            f"ID: {inst.id}",
            f"狀態: {status_emoji} {inst.status}",
            f"Repo: {inst.repo_path}",
            f"分支: {inst.branch}",
            f"模型: {inst.model}",
        ]
        if inst.cost_usd is not None:
            lines.append(f"花費: ${inst.cost_usd:.2f}")
        if diffstat:
            lines.append(f"\n{diffstat}")

        message = "\n".join(lines)

        try:
            data = json.dumps({"chat_id": chat_id, "text": message}).encode()
            req = Request(
                f"{bridge_url}/send",
                data=data,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            urlopen(req, timeout=5)
        except Exception:
            pass

    # --- State persistence ---

    def _save_state(self):
        try:
            data = {k: v.to_dict() for k, v in self.instances.items()}
            self._state_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        except Exception:
            pass

    def _load_state(self):
        if not self._state_file.exists():
            return
        try:
            data = json.loads(self._state_file.read_text())
            for k, v in data.items():
                # Mark running instances as failed on restart
                if v.get("status") == "running":
                    v["status"] = "failed"
                    v["stderr"] = (v.get("stderr", "") + "\nServer restarted").strip()
                    v["finished_at"] = v.get("finished_at") or datetime.now().isoformat()
                self.instances[k] = Instance(**{
                    f: v.get(f) for f in Instance.__dataclass_fields__
                    if f in v
                })
        except Exception:
            pass
