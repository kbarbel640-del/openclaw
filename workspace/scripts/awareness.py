#!/usr/bin/env python3
"""
Awareness Loop - 無極覺知循環（自我進化版）

每 5 分鐘執行一次，讓 Clawdbot 保持覺知：
1. 收集數據：經絡狀態、文件變更、Telegram 活動
2. 調用 Claude CLI 分析並決定行動
3. 自我優化：Claude 可以建議修改 prompt

Usage:
    python awareness.py              # 執行一次
    python awareness.py --daemon     # 持續運行（每 5 分鐘）
    python awareness.py --no-claude  # 不調用 Claude（僅收集數據）
"""

import os
import sys
import json
import time
import hashlib
import argparse
import subprocess
import re
from pathlib import Path
from datetime import datetime
import fcntl
from urllib.request import urlopen, Request
from urllib.error import URLError

# 配置
LOCK_FILE = Path.home() / "clawd" / ".awareness.lock"
CLAWD_HOME = Path.home() / "clawd"
STATE_FILE = CLAWD_HOME / ".awareness_state.json"
LOG_FILE = CLAWD_HOME / "logs" / "awareness.log"
PROMPT_FILE = CLAWD_HOME / "scripts" / "awareness_prompt.md"
AWARENESS_LOG_DIR = CLAWD_HOME / "logs" / "awareness"

# 從 .env 讀取敏感配置
def _load_env():
    env_file = CLAWD_HOME / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))
_load_env()

# Telegram 配置
TELEGRAM_BRIDGE_URL = os.environ.get("TELEGRAM_BRIDGE_URL", "http://127.0.0.1:18790")
CLAWDBOT_CHAT_ID = os.environ.get("CLAWDBOT_CHAT_ID", "8327498414")

# 備用：Log 群組（bridge 不通時用 bot API）
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_LOG_GROUP = os.environ.get("TELEGRAM_LOG_GROUP", "")

# 服務端點
SERVICES = {
    "exec-bridge": "http://127.0.0.1:18793/health",
    "telegram-bridge": "http://127.0.0.1:18790/health",
    "gateway": "http://127.0.0.1:18789/health",
}

# 監控的文件
WATCHED_FILES = [
    CLAWD_HOME / "CAPABILITIES.md",
    CLAWD_HOME / "CLAUDE.md",
    CLAWD_HOME / "TOOLS.md",
]


def log(msg: str):
    """寫入日誌"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def load_state() -> dict:
    """載入狀態"""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except:
            pass
    return {"file_hashes": {}, "last_run": None, "service_status": {}}


def save_state(state: dict):
    """保存狀態"""
    state["last_run"] = datetime.now().isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def get_file_hash(filepath: Path) -> str:
    """計算文件 hash"""
    if not filepath.exists():
        return ""
    return hashlib.md5(filepath.read_bytes()).hexdigest()


def check_service(name: str, url: str) -> tuple[bool, str]:
    """檢查服務健康狀態"""
    try:
        req = Request(url, method="GET")
        with urlopen(req, timeout=5) as resp:
            data = resp.read().decode()
            return True, data[:100]
    except URLError as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)


def get_recent_chats() -> list[dict]:
    """獲取最近有未讀消息的聊天"""
    try:
        url = f"{TELEGRAM_BRIDGE_URL}/chats?limit=30"
        req = Request(url, method="GET")
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            chats = data.get("chats", [])
            # 只返回有未讀消息的
            return [c for c in chats if c.get("unread", 0) > 0]
    except Exception as e:
        log(f"獲取聊天列表失敗: {e}")
        return []


def get_recent_messages(chat_id: str, limit: int = 5) -> list[dict]:
    """獲取某個聊天的最近消息"""
    try:
        url = f"{TELEGRAM_BRIDGE_URL}/messages?chat={chat_id}&limit={limit}"
        req = Request(url, method="GET")
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get("messages", [])
    except Exception as e:
        log(f"獲取消息失敗: {e}")
        return []


def summarize_telegram_activity() -> dict:
    """總結 Telegram 最近活動"""
    result = {
        "unread_chats": [],
        "total_unread": 0,
        "recent_senders": set()
    }

    try:
        # 獲取有未讀消息的聊天
        chats = get_recent_chats()

        for chat in chats:
            chat_name = chat.get("name", "Unknown")
            unread = chat.get("unread", 0)
            chat_id = chat.get("id")

            if unread > 0:
                result["unread_chats"].append({
                    "name": chat_name,
                    "unread": unread,
                    "id": chat_id
                })
                result["total_unread"] += unread

                # 獲取最近幾條消息看看是誰發的
                messages = get_recent_messages(str(chat_id), limit=3)
                for msg in messages:
                    sender = msg.get("sender", "")
                    if sender and sender != "Dofu":
                        result["recent_senders"].add(sender)

        result["recent_senders"] = list(result["recent_senders"])

    except Exception as e:
        log(f"總結 Telegram 活動失敗: {e}")

    return result


def send_to_clawdbot(message: str) -> bool:
    """透過杜甫的 Telegram 發送消息給 @x01clawbot"""
    try:
        url = f"{TELEGRAM_BRIDGE_URL}/send"
        data = json.dumps({
            "chat": CLAWDBOT_CHAT_ID,
            "message": message
        }).encode()
        req = Request(url, data=data, method="POST",
                     headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if result.get("success"):
                log(f"✓ 已發送給 @x01clawdbot")
                return True
    except Exception as e:
        log(f"http_bridge 發送失敗: {e}")

    # 備用：用 bot API 發到 Log 群組
    return send_telegram_fallback(message)


def send_telegram_fallback(message: str) -> bool:
    """備用：用 Bot API 發到 Log 群組"""
    try:
        import urllib.parse
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = urllib.parse.urlencode({
            "chat_id": TELEGRAM_LOG_GROUP,
            "text": f"[Awareness 備用通道]\n{message}",
            "parse_mode": "Markdown"
        }).encode()
        req = Request(url, data=data, method="POST")
        with urlopen(req, timeout=10) as resp:
            log("✓ 已發送到 Log 群組（備用）")
            return True
    except Exception as e:
        log(f"Telegram 備用發送也失敗: {e}")
        return False


def inject_to_clawdbot(message: str):
    """注入消息到 Clawdbot（透過 gateway API）"""
    try:
        import urllib.parse
        # 使用 clawdbot 的 session send 功能
        result = subprocess.run(
            ["clawdbot", "message", "send",
             "--channel", "internal",
             "--target", "agent:main:main",
             "--message", message],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0
    except Exception as e:
        log(f"注入失敗: {e}")
        return False


def send_start_notification():
    """發送開始通知"""
    msg = "🧘 覺知循環開始\n\n正在檢查經絡與文件狀態..."
    send_to_clawdbot(msg)


def run_awareness_check(notify_start: bool = False) -> dict:
    """執行覺知檢查"""
    if notify_start:
        send_start_notification()

    state = load_state()
    report = {
        "timestamp": datetime.now().isoformat(),
        "services": {},
        "file_changes": [],
        "issues": [],
        "actions": []
    }

    # ===== 1. 內觀：檢查經絡 =====
    log("🔍 內觀：檢查經絡...")

    for name, url in SERVICES.items():
        ok, detail = check_service(name, url)
        report["services"][name] = {"ok": ok, "detail": detail}

        prev_status = state.get("service_status", {}).get(name, True)

        if ok:
            log(f"  ✓ {name}: 通")
            if not prev_status:
                # 從斷到通，恢復了
                report["actions"].append(f"{name} 經絡恢復")
        else:
            log(f"  ✗ {name}: 斷 ({detail})")
            report["issues"].append(f"{name} 經絡不通")

            # 提供修復建議
            if name == "exec-bridge":
                report["actions"].append("exec 不通時用: curl -X POST http://127.0.0.1:18793/exec")

        state.setdefault("service_status", {})[name] = ok

    # ===== 2. 外察：檢查文件變更 =====
    log("📖 外察：檢查文件更新...")

    for filepath in WATCHED_FILES:
        current_hash = get_file_hash(filepath)
        prev_hash = state.get("file_hashes", {}).get(str(filepath), "")

        if current_hash != prev_hash and prev_hash != "":
            log(f"  📝 {filepath.name} 有更新")
            report["file_changes"].append(filepath.name)
            report["actions"].append(f"重新讀取 {filepath.name}")

        state.setdefault("file_hashes", {})[str(filepath)] = current_hash

    # ===== 3. 檢查今日 memory =====
    today = datetime.now().strftime("%Y-%m-%d")
    memory_file = CLAWD_HOME / "memory" / f"{today}.md"
    if memory_file.exists():
        current_hash = get_file_hash(memory_file)
        prev_hash = state.get("file_hashes", {}).get(str(memory_file), "")

        if current_hash != prev_hash and prev_hash != "":
            log(f"  📝 今日 memory 有更新")
            report["file_changes"].append(f"memory/{today}.md")

        state["file_hashes"][str(memory_file)] = current_hash

    # ===== 4. 外界：檢查 Telegram 活動 =====
    log("📱 外界：檢查 Telegram 消息...")

    telegram_activity = summarize_telegram_activity()
    report["telegram"] = telegram_activity

    if telegram_activity["total_unread"] > 0:
        log(f"  📬 {telegram_activity['total_unread']} 則未讀消息")
        for chat in telegram_activity["unread_chats"][:5]:  # 最多顯示 5 個
            log(f"    - {chat['name']}: {chat['unread']} 則")

        if telegram_activity["recent_senders"]:
            senders = ", ".join(telegram_activity["recent_senders"][:5])
            report["actions"].append(f"有人找你: {senders}")
    else:
        log("  ✓ 沒有未讀消息")

    # 保存狀態
    save_state(state)

    return report


def load_prompt_template() -> str:
    """載入 prompt 模板"""
    if PROMPT_FILE.exists():
        return PROMPT_FILE.read_text()
    return "分析以下系統狀態，決定是否需要通知。"


def load_memory() -> str:
    """載入 MEMORY.md（杜甫的完整地圖）"""
    memory_file = CLAWD_HOME / "MEMORY.md"
    if memory_file.exists():
        return memory_file.read_text()
    return ""


def call_clawdbot(prompt: str, context: str, timeout: int = 300) -> str:
    """調用 Clawdbot Agent 分析並執行"""
    # 組合消息
    message = f"{prompt}\n\n---\n\n## 當前狀態數據\n\n```json\n{context}\n```"

    try:
        result = subprocess.run(
            ["clawdbot", "agent", "--agent", "main", "-m", message, "--json"],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode != 0:
            log(f"Clawdbot agent 返回非零 (code={result.returncode})")
            log(f"  stderr: {result.stderr[:300] if result.stderr else 'empty'}")
            return ""

        # 解析 JSON 結果
        try:
            data = json.loads(result.stdout)
            if data.get("status") == "ok":
                payloads = data.get("result", {}).get("payloads", [])
                # 合併所有回覆
                texts = [p.get("text", "") for p in payloads if p.get("text")]
                return "\n\n".join(texts)
            else:
                log(f"Clawdbot agent 狀態: {data.get('status')}")
                return ""
        except json.JSONDecodeError:
            log("無法解析 Clawdbot 回應")
            return result.stdout

    except subprocess.TimeoutExpired:
        log("Clawdbot agent 超時")
        return ""
    except FileNotFoundError:
        log("Clawdbot CLI 未安裝")
        return ""
    except Exception as e:
        log(f"Clawdbot agent 錯誤: {e}")
        return ""


def parse_claude_output(output: str) -> dict:
    """解析 Claude 輸出"""
    result = {
        "report": "",
        "prompt_update": "",
        "log": ""
    }

    # 解析 [REPORT] 區塊
    report_match = re.search(r'\[REPORT\]\s*\n(.*?)(?=\n\[|$)', output, re.DOTALL)
    if report_match:
        result["report"] = report_match.group(1).strip()

    # 解析 [PROMPT_UPDATE] 區塊
    update_match = re.search(r'\[PROMPT_UPDATE\]\s*\n(.*?)(?=\n\[|$)', output, re.DOTALL)
    if update_match:
        result["prompt_update"] = update_match.group(1).strip()

    # 解析 [LOG] 區塊
    log_match = re.search(r'\[LOG\]\s*\n(.*?)(?=\n\[|$)', output, re.DOTALL)
    if log_match:
        result["log"] = log_match.group(1).strip()

    return result


def update_prompt_if_needed(update_suggestion: str) -> bool:
    """根據建議更新 prompt 模板"""
    if not update_suggestion or update_suggestion.upper() in ["NONE", "無", "N/A"]:
        return False

    # 讀取當前 prompt
    current_prompt = load_prompt_template()

    # 在 prompt 末尾添加更新記錄
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    update_section = f"\n\n---\n## 自我優化記錄\n\n### {timestamp}\n{update_suggestion}\n"

    # 檢查是否已有「自我優化記錄」區塊
    if "## 自我優化記錄" in current_prompt:
        # 在現有區塊末尾添加
        new_prompt = current_prompt + f"\n### {timestamp}\n{update_suggestion}\n"
    else:
        # 創建新區塊
        new_prompt = current_prompt + update_section

    # 寫回文件
    PROMPT_FILE.write_text(new_prompt)
    log(f"Prompt 已更新: {update_suggestion[:50]}...")
    return True


def save_awareness_log(data: dict, claude_output: dict):
    """保存詳細的 awareness log"""
    AWARENESS_LOG_DIR.mkdir(parents=True, exist_ok=True)

    today = datetime.now().strftime("%Y-%m-%d")
    log_file = AWARENESS_LOG_DIR / f"{today}.jsonl"

    entry = {
        "timestamp": datetime.now().isoformat(),
        "data": data,
        "claude_output": claude_output
    }

    with open(log_file, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def format_report(report: dict) -> str:
    """格式化報告（備用，當 Claude 不可用時）"""
    lines = ["🧘 *覺知循環報告*", ""]

    # 經絡狀態
    lines.append("*經絡狀態:*")
    for name, status in report["services"].items():
        icon = "✓" if status["ok"] else "✗"
        lines.append(f"  {icon} {name}")

    # 文件變更
    if report["file_changes"]:
        lines.append("")
        lines.append("*文件更新:*")
        for f in report["file_changes"]:
            lines.append(f"  📝 {f}")

    # Telegram 活動
    telegram = report.get("telegram", {})
    if telegram.get("total_unread", 0) > 0:
        lines.append("")
        lines.append(f"*📱 Telegram ({telegram['total_unread']} 則未讀):*")
        for chat in telegram.get("unread_chats", [])[:5]:
            lines.append(f"  • {chat['name']}: {chat['unread']} 則")

    # 問題
    if report["issues"]:
        lines.append("")
        lines.append("*⚠️ 問題:*")
        for issue in report["issues"]:
            lines.append(f"  - {issue}")

    # 建議行動
    if report["actions"]:
        lines.append("")
        lines.append("*建議行動:*")
        for action in report["actions"]:
            lines.append(f"  → {action}")

    return "\n".join(lines)


def should_notify(report: dict) -> bool:
    """判斷是否需要通知"""
    # 有問題一定通知
    if report["issues"]:
        return True
    # 有文件變更通知
    if report["file_changes"]:
        return True
    # 有恢復通知
    if any("恢復" in a for a in report["actions"]):
        return True
    # 有未讀 Telegram 消息通知
    telegram = report.get("telegram", {})
    if telegram.get("total_unread", 0) > 0:
        return True
    return False


def load_clawdbot_memory() -> str:
    """載入 Clawdbot 自己的記憶快照（上一輪留給這一輪的）"""
    f = CLAWD_HOME / "memory" / "clawdbot_last_moment.md"
    if f.exists():
        return f.read_text()
    return ""


def load_today_memory() -> str:
    """載入今日工作日誌"""
    today = datetime.now().strftime("%Y-%m-%d")
    f = CLAWD_HOME / "memory" / f"{today}.md"
    if f.exists():
        return f.read_text()
    return ""


def run_with_clawdbot(data: dict) -> str:
    """用 Clawdbot Agent 分析數據並執行行動"""
    # 載入 prompt 模板
    prompt = load_prompt_template()

    # 恢復記憶：注入 Clawdbot 自己的上輪快照 + 今日日誌
    clawdbot_memory = load_clawdbot_memory()
    today_memory = load_today_memory()

    memory_section = ""
    if clawdbot_memory:
        memory_section += f"\n\n---\n\n## 上一輪的你留下的記憶\n\n{clawdbot_memory}"
    if today_memory:
        memory_section += f"\n\n---\n\n## 今日工作日誌\n\n{today_memory}"

    if memory_section:
        prompt += memory_section

    # 準備 context
    context = json.dumps(data, ensure_ascii=False, indent=2)

    # 調用 Clawdbot（它會自己分析、讀消息、執行操作）
    log("🤖 調用 Clawdbot Agent...")
    result = call_clawdbot(prompt, context)

    # 保存 log
    save_awareness_log(data, {"clawdbot_response": result})

    return result


def main():
    parser = argparse.ArgumentParser(description="無極覺知循環（Clawdbot 版）")
    parser.add_argument("--daemon", action="store_true", help="持續運行模式")
    parser.add_argument("--interval", type=int, default=300, help="循環間隔（秒），預設 300")
    parser.add_argument("--no-agent", action="store_true", help="不調用 Clawdbot（僅收集數據）")
    parser.add_argument("--quiet", action="store_true", help="安靜模式，只在有問題時通知")
    args = parser.parse_args()

    # 防止重複執行（file lock）
    lock_fp = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except IOError:
        # 另一個 awareness 進程正在跑
        print("另一個覺知循環正在執行，跳過")
        return

    log("=" * 50)
    log("🧘 覺知循環啟動（Clawdbot 版）")

    if args.daemon:
        log(f"持續運行模式，間隔 {args.interval} 秒")
        while True:
            try:
                # 1. 收集數據
                data = run_awareness_check()

                if args.no_agent:
                    # 不用 Clawdbot，使用舊的固定格式
                    if should_notify(data) or not args.quiet:
                        message = format_report(data)
                        send_to_clawdbot(message)
                else:
                    # 讓 Clawdbot 處理一切
                    result = run_with_clawdbot(data)
                    if result:
                        log(f"Clawdbot 完成處理")
                    else:
                        log("Clawdbot 無回應")

                log(f"下次檢查: {args.interval} 秒後")
                time.sleep(args.interval)

            except KeyboardInterrupt:
                log("收到中斷信號，退出")
                break
            except Exception as e:
                log(f"錯誤: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(60)
    else:
        # 單次執行
        data = run_awareness_check()

        if args.no_agent:
            message = format_report(data)
            print(message)
            if should_notify(data):
                send_to_clawdbot(message)
        else:
            # 讓 Clawdbot 處理一切
            result = run_with_clawdbot(data)
            print("=== Clawdbot 處理結果 ===")
            print(result if result else "（無回應）")


if __name__ == "__main__":
    main()
