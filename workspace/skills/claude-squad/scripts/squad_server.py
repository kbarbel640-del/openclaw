#!/usr/bin/env python3
"""
Claude Squad HTTP Server
Port 18794 - 遠端控制多個 Claude Code 實例

API:
    GET  /health           健康檢查
    POST /task             建立新任務
    GET  /tasks            列出所有任務
    GET  /task/{id}        取得任務詳情
    POST /task/{id}/cancel 取消任務
    DELETE /task/{id}      清理任務（刪 worktree）
    GET  /task/{id}/diff   取得任務 diff
"""

import argparse
import asyncio
import json
import os
import signal
import sys
from pathlib import Path

from aiohttp import web

# Add parent dir so we can import instance_manager
sys.path.insert(0, str(Path(__file__).parent))
from instance_manager import InstanceManager

CONFIG_FILE = Path(__file__).parent.parent / "config.json"


def load_config() -> dict:
    return json.loads(CONFIG_FILE.read_text())


def create_app(manager: InstanceManager) -> web.Application:
    app = web.Application()
    app["manager"] = manager

    app.router.add_get("/health", handle_health)
    app.router.add_post("/task", handle_create_task)
    app.router.add_get("/tasks", handle_list_tasks)
    app.router.add_get("/task/{id}", handle_get_task)
    app.router.add_post("/task/{id}/cancel", handle_cancel_task)
    app.router.add_delete("/task/{id}", handle_delete_task)
    app.router.add_get("/task/{id}/diff", handle_get_diff)

    return app


# --- Handlers ---

async def handle_health(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    return web.json_response({
        "status": "ok",
        "active": mgr.active_count(),
        "total": len(mgr.instances),
        "pid": os.getpid(),
    })


async def handle_create_task(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    prompt = body.get("prompt")
    if not prompt:
        return web.json_response({"error": "prompt is required"}, status=400)

    repo = body.get("repo", str(Path.home() / "clawd"))

    try:
        inst = await mgr.start(
            prompt=prompt,
            repo_path=repo,
            branch=body.get("branch"),
            model=body.get("model"),
            budget=body.get("budget"),
            allowed_tools=body.get("allowed_tools"),
            system_prompt=body.get("system_prompt"),
        )
        return web.json_response({
            "ok": True,
            "id": inst.id,
            "status": inst.status,
            "branch": inst.branch,
        })
    except RuntimeError as e:
        if "Max concurrent" in str(e):
            return web.json_response({"error": str(e)}, status=429)
        return web.json_response({"error": str(e)}, status=500)
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)
    except FileNotFoundError as e:
        return web.json_response({"error": str(e)}, status=500)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_list_tasks(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    status = request.query.get("status")
    return web.json_response({"tasks": mgr.list_instances(status=status)})


async def handle_get_task(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    inst_id = request.match_info["id"]
    lines = int(request.query.get("lines", "0"))
    try:
        data = mgr.get(inst_id, lines=lines)
        return web.json_response(data)
    except KeyError:
        return web.json_response({"error": "Not found"}, status=404)


async def handle_cancel_task(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    inst_id = request.match_info["id"]
    try:
        inst = await mgr.cancel(inst_id)
        return web.json_response({"ok": True, "status": inst.status})
    except KeyError:
        return web.json_response({"error": "Not found"}, status=404)
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)


async def handle_delete_task(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    inst_id = request.match_info["id"]
    try:
        await mgr.cleanup(inst_id)
        return web.json_response({"ok": True, "cleaned": "worktree removed"})
    except KeyError:
        return web.json_response({"error": "Not found"}, status=404)


async def handle_get_diff(request: web.Request) -> web.Response:
    mgr: InstanceManager = request.app["manager"]
    inst_id = request.match_info["id"]
    try:
        diff = await mgr.get_diff(inst_id)
        return web.json_response({"ok": True, "diff": diff})
    except KeyError:
        return web.json_response({"error": "Not found"}, status=404)


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Claude Squad HTTP Server")
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--host", type=str, default=None)
    args = parser.parse_args()

    config = load_config()
    port = args.port or config["server"]["port"]
    host = args.host or config["server"]["host"]

    manager = InstanceManager(config)
    app = create_app(manager)

    print(f"[squad] Starting on {host}:{port} (pid={os.getpid()})")
    web.run_app(app, host=host, port=port, print=lambda _: None)


if __name__ == "__main__":
    main()
