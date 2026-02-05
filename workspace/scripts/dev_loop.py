#!/usr/bin/env python3
"""
Dev Loop - 開發態自動循環

讀 TASKS.md 中標記「開發」模式的任務，用 claude -p 非互動模式執行。
每個任務在獨立 git branch 上操作，做完 commit，等杜甫 review + merge。

Usage:
    python dev_loop.py              # 執行一次
    python dev_loop.py --dry-run    # 只顯示會做什麼，不實際執行
"""

import os
import sys
import json
import re
import subprocess
import fcntl
import argparse
from pathlib import Path
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError

# 配置
CLAWD_HOME = Path.home() / "clawd"
LOCK_FILE = CLAWD_HOME / ".dev_loop.lock"
TASKS_FILE = CLAWD_HOME / "TASKS.md"
DEV_PROMPT_FILE = CLAWD_HOME / "scripts" / "dev_prompt.md"
DEV_LOG_DIR = CLAWD_HOME / "logs" / "dev"
MEMORY_FILE = CLAWD_HOME / "memory" / "dev_last_moment.md"
DIRECTIVES_FILE = CLAWD_HOME / "memory" / "dev_directives.md"

# Claude 配置
DEFAULT_MODEL = "sonnet"
MAX_BUDGET_USD = 1
TIMEOUT_SECONDS = 600
ALLOWED_TOOLS = "Read,Edit,Write,Bash(git:*),Bash(npm:*),Bash(python:*),Bash(ls:*),Bash(mkdir:*),Glob,Grep"

# Telegram 配置（從 .env 讀取）
def _load_env():
    env_file = CLAWD_HOME / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))
_load_env()

TELEGRAM_BRIDGE_URL = "http://127.0.0.1:18790"
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
DOFU_CHAT_ID = os.environ.get("DOFU_CHAT_ID", "")
LAST_MSG_ID_FILE = CLAWD_HOME / ".dev_loop_last_msg_id"


def log(msg: str):
    """寫入日誌"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    DEV_LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = DEV_LOG_DIR / "dev_loop.log"
    with open(log_file, "a") as f:
        f.write(line + "\n")


def parse_tasks() -> list[dict]:
    """從 TASKS.md 找出模式=開發的任務"""
    if not TASKS_FILE.exists():
        return []

    content = TASKS_FILE.read_text()
    tasks = []

    # 匹配表格行，找含有「開發」模式的任務
    # 格式: | ID | 任務 | 交付物 | 完成標準 | 模式 | 來源 |
    for line in content.split("\n"):
        line = line.strip()
        if not line.startswith("|"):
            continue
        cols = [c.strip() for c in line.split("|")]
        # cols[0] 和 cols[-1] 是空的（因為開頭和結尾的 |）
        cols = [c for c in cols if c != ""]

        if len(cols) < 5:
            continue

        # 跳過表頭和分隔線
        if cols[0] in ("ID", "----", "----|", ""):
            continue
        if "---" in cols[0]:
            continue

        # 檢查模式欄位（第 5 欄，index 4）
        mode = cols[4] if len(cols) > 4 else ""
        if mode == "開發":
            task_id = cols[0].strip()
            # 跳過已完成（刪除線）的任務
            if task_id.startswith("~~"):
                continue
            tasks.append({
                "id": task_id,
                "name": cols[1].strip(),
                "deliverable": cols[2].strip() if len(cols) > 2 else "",
                "criteria": cols[3].strip() if len(cols) > 3 else "",
                "mode": mode,
                "source": cols[5].strip() if len(cols) > 5 else "",
            })

    return tasks


def branch_exists(branch: str) -> bool:
    """檢查 git branch 是否已存在"""
    result = subprocess.run(
        ["git", "branch", "--list", branch],
        capture_output=True, text=True, cwd=CLAWD_HOME
    )
    return branch in result.stdout


def current_branch() -> str:
    """取得當前 branch 名稱"""
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True, text=True, cwd=CLAWD_HOME
    )
    return result.stdout.strip()


def git_checkout_branch(task_id: str) -> str:
    """建立或切換到任務分支"""
    branch = f"dev/{task_id}"
    if branch_exists(branch):
        log(f"切換到已有分支: {branch}")
        subprocess.run(["git", "checkout", branch], cwd=CLAWD_HOME, check=True)
    else:
        log(f"建立新分支: {branch}")
        subprocess.run(["git", "checkout", "-b", branch], cwd=CLAWD_HOME, check=True)
    return branch


def git_commit(task_id: str, task_name: str):
    """在分支上 commit 所有變更"""
    # 先看有沒有變更
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, cwd=CLAWD_HOME
    )
    if not result.stdout.strip():
        log("沒有變更需要 commit")
        return

    subprocess.run(["git", "add", "-A"], cwd=CLAWD_HOME, check=True)
    msg = f"[dev-loop] {task_id}: {task_name}"
    subprocess.run(
        ["git", "commit", "-m", msg],
        cwd=CLAWD_HOME, check=True
    )
    log(f"已 commit: {msg}")


def git_return_to_main():
    """回到 main 分支"""
    subprocess.run(["git", "checkout", "main"], cwd=CLAWD_HOME, check=True)


def load_dev_memory() -> str:
    """載入開發態記憶"""
    if MEMORY_FILE.exists():
        return MEMORY_FILE.read_text()
    return ""


def load_directives() -> str:
    """載入杜甫的指示（執行前讀取，讓杜甫可以影響決策）"""
    if DIRECTIVES_FILE.exists():
        return DIRECTIVES_FILE.read_text()
    return ""


def load_dev_prompt() -> str:
    """載入開發態 system prompt"""
    if DEV_PROMPT_FILE.exists():
        return DEV_PROMPT_FILE.read_text()
    return "你是開發態 Claude，專注完成指定的開發任務。"


def build_task_prompt(task: dict, memory: str) -> str:
    """組合任務 prompt"""
    parts = [
        f"# 開發任務: {task['id']}",
        f"",
        f"**任務**: {task['name']}",
        f"**交付物**: {task['deliverable']}",
        f"**完成標準**: {task['criteria']}",
    ]

    # 杜甫的指示（最高優先）
    directives = load_directives()
    if directives:
        parts.extend([
            "",
            "---",
            "",
            "## 杜甫的指示（優先遵守）",
            "",
            directives,
        ])

    if memory:
        parts.extend([
            "",
            "---",
            "",
            "## 上一輪開發記憶",
            "",
            memory,
        ])

    return "\n".join(parts)


def call_claude(task: dict, memory: str) -> dict:
    """調用 claude -p 執行任務"""
    system_prompt = load_dev_prompt()
    task_prompt = build_task_prompt(task, memory)

    # 決定模型（任務名稱含 [opus] 則用 opus）
    model = DEFAULT_MODEL
    if "[opus]" in task["name"].lower():
        model = "opus"

    cmd = [
        "claude", "-p",
        "--model", model,
        "--allowedTools", ALLOWED_TOOLS,
        "--max-budget-usd", str(MAX_BUDGET_USD),
        "--append-system-prompt", system_prompt,
        "--output-format", "json",
        task_prompt,
    ]

    log(f"調用 claude -p (model={model}, budget=${MAX_BUDGET_USD})")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=CLAWD_HOME,
            timeout=TIMEOUT_SECONDS,
        )

        output = {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr[:500] if result.stderr else "",
        }

        if result.returncode == 0:
            log("claude -p 執行完成")
            # 嘗試解析 JSON 輸出
            try:
                parsed = json.loads(result.stdout)
                output["parsed"] = parsed
            except json.JSONDecodeError:
                output["raw"] = result.stdout[:2000]
        else:
            log(f"claude -p 返回非零: {result.returncode}")
            log(f"  stderr: {result.stderr[:300]}")

        return output

    except subprocess.TimeoutExpired:
        log(f"claude -p 超時 ({TIMEOUT_SECONDS}s)")
        return {"error": "timeout", "returncode": -1}
    except FileNotFoundError:
        log("claude CLI 未找到")
        return {"error": "claude not found", "returncode": -1}
    except Exception as e:
        log(f"claude -p 錯誤: {e}")
        return {"error": str(e), "returncode": -1}


def save_dev_log(task: dict, claude_output: dict):
    """保存開發日誌"""
    DEV_LOG_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = DEV_LOG_DIR / f"{today}.jsonl"

    entry = {
        "timestamp": datetime.now().isoformat(),
        "task": task,
        "claude_output": {
            "returncode": claude_output.get("returncode"),
            "error": claude_output.get("error"),
            # 不存完整 stdout（太大），只存摘要
            "stdout_len": len(claude_output.get("stdout", "")),
            "stderr": claude_output.get("stderr", ""),
        },
    }

    with open(log_file, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def send_telegram(message: str) -> int | None:
    """透過 Bot API 發摘要給杜甫，返回 message_id"""
    import urllib.parse
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = json.dumps({
            "chat_id": DOFU_CHAT_ID,
            "text": message,
        }).encode()
        req = Request(url, data=data, method="POST",
                     headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if result.get("ok"):
                msg_id = result["result"]["message_id"]
                log(f"已發送摘要給杜甫 (msg_id={msg_id})")
                # 記住 msg_id，下次用來撈回覆
                LAST_MSG_ID_FILE.write_text(str(msg_id))
                return msg_id
    except Exception as e:
        log(f"Telegram 發送失敗: {e}")
    return None


def fetch_dofu_replies() -> list[str]:
    """檢查杜甫是否有回覆上次的摘要，有的話存到 directives"""
    if not LAST_MSG_ID_FILE.exists():
        return []

    last_msg_id = int(LAST_MSG_ID_FILE.read_text().strip())

    try:
        # 用 getUpdates 太複雜，直接用 http_bridge 讀跟 bot 的對話
        # Bot API: getUpdates 需要 webhook 衝突，改用 http_bridge 讀 Dofu 跟 bot 的聊天
        url = f"{TELEGRAM_BRIDGE_URL}/messages?chat={DOFU_CHAT_ID}&limit=10"
        req = Request(url, method="GET")
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            messages = data.get("messages", [])

        # 找在 last_msg_id 之後、由杜甫發的消息（排除 bot 自己發的）
        replies = []
        for msg in messages:
            # http_bridge 的 message id 跟 bot API 的不同體系
            # 簡單方案：看時間順序，找 reply_to 或者就看最近的非 bot 消息
            sender = msg.get("sender", "")
            text = msg.get("text", "")
            if text and sender != "x01clawbot" and sender != "":
                replies.append(text)

        if replies:
            log(f"收到杜甫 {len(replies)} 則回覆")
            # 寫入 directives
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            directive_content = f"# 杜甫指示（{timestamp}）\n\n"
            for r in replies:
                directive_content += f"- {r}\n"
            DIRECTIVES_FILE.parent.mkdir(parents=True, exist_ok=True)
            DIRECTIVES_FILE.write_text(directive_content)
            log(f"已更新 dev_directives.md")

        return replies

    except Exception as e:
        log(f"撈回覆失敗: {e}")
        return []


def build_summary(task: dict, claude_output: dict, branch: str) -> str:
    """組合發給杜甫的 Telegram 摘要"""
    status = "✅ 完成" if claude_output.get("returncode") == 0 else "❌ 失敗"

    lines = [
        f"🔧 Dev Loop 報告",
        f"",
        f"任務: {task['id']} - {task['name']}",
        f"狀態: {status}",
        f"分支: {branch}",
    ]

    if claude_output.get("error"):
        lines.append(f"錯誤: {claude_output['error']}")

    # 嘗試從 claude 輸出提取摘要
    parsed = claude_output.get("parsed")
    if parsed and isinstance(parsed, dict):
        result_text = parsed.get("result", "")
        if isinstance(result_text, str) and result_text:
            snippet = result_text[:300]
            if len(result_text) > 300:
                snippet += "..."
            lines.extend(["", f"摘要: {snippet}"])

    lines.extend([
        "",
        "回覆此消息 = 老闆指示（下輪生效）",
    ])

    return "\n".join(lines)


def update_task_status(task_id: str, new_status: str = "完成"):
    """更新 TASKS.md 中任務的狀態（加刪除線標記完成）"""
    # 這個比較複雜，先只記 log，讓 claude -p 自己在執行時更新
    log(f"任務 {task_id} 狀態: {new_status}")


def main():
    parser = argparse.ArgumentParser(description="開發態自動循環")
    parser.add_argument("--dry-run", action="store_true", help="只顯示會做什麼")
    args = parser.parse_args()

    # File lock 防重複
    lock_fp = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except IOError:
        print("另一個 dev_loop 正在執行，跳過")
        return

    log("=" * 50)
    log("🔧 開發態循環啟動")

    # 0. 先檢查杜甫有沒有回覆上次的摘要
    fetch_dofu_replies()

    # 1. 讀 TASKS.md，找開發態任務
    tasks = parse_tasks()

    if not tasks:
        log("沒有開發態任務，退出")
        return

    log(f"找到 {len(tasks)} 個開發態任務")
    for t in tasks:
        log(f"  - {t['id']}: {t['name']}")

    # 2. 只取第一個任務（每輪只做一個）
    task = tasks[0]
    log(f"本輪處理: {task['id']} - {task['name']}")

    if args.dry_run:
        log("(dry-run) 會執行以下步驟:")
        log(f"  1. git checkout -b dev/{task['id']}")
        log(f"  2. claude -p 執行任務")
        log(f"  3. git commit 在分支上")
        log(f"  4. git checkout main")
        return

    # 3. 記住原始分支
    original_branch = current_branch()
    branch = f"dev/{task['id']}"
    claude_output = {"returncode": -1, "error": "not started"}

    try:
        # 4. 切換到任務分支
        branch = git_checkout_branch(task["id"])

        # 5. 載入記憶
        memory = load_dev_memory()

        # 6. 調用 claude -p
        claude_output = call_claude(task, memory)

        # 7. 保存日誌
        save_dev_log(task, claude_output)

        # 8. Git commit（在分支上）
        if claude_output.get("returncode") == 0:
            git_commit(task["id"], task["name"])
        else:
            log("claude 執行失敗，不 commit")

    except Exception as e:
        log(f"執行錯誤: {e}")
        import traceback
        traceback.print_exc()
        claude_output = {"returncode": -1, "error": str(e)}

    finally:
        # 9. 回到原始分支
        try:
            if current_branch() != original_branch:
                subprocess.run(
                    ["git", "checkout", original_branch],
                    cwd=CLAWD_HOME, check=True
                )
                log(f"已回到分支: {original_branch}")
        except Exception as e:
            log(f"回到原始分支失敗: {e}")

    # 10. 發 Telegram 摘要給杜甫
    summary = build_summary(task, claude_output, branch)
    send_telegram(summary)

    log("🔧 開發態循環結束")


if __name__ == "__main__":
    main()
