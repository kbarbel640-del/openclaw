#!/usr/bin/env python3
"""系統健康檢查腳本 — 每次心跳跑一次，輸出精簡報告"""

import os
import sys
import json
import subprocess
import glob
from datetime import datetime, timedelta
from pathlib import Path

HOME = os.path.expanduser("~")
CLAWD = os.path.join(HOME, "clawd")
VERBOSE = "--verbose" in sys.argv or "-v" in sys.argv

def run(cmd, timeout=5):
    """執行外部命令，回傳 stdout"""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except:
        return ""

def time_ago(ts):
    """時間戳轉 '2h前' 格式"""
    if not ts:
        return "未知"
    delta = datetime.now() - ts
    if delta.days > 0:
        return f"{delta.days}d前"
    hours = delta.seconds // 3600
    if hours > 0:
        return f"{hours}h前"
    mins = delta.seconds // 60
    return f"{mins}m前"

def mtime(path):
    """取得檔案修改時間"""
    try:
        return datetime.fromtimestamp(os.path.getmtime(path))
    except:
        return None

def check_skills():
    """A. Skills 健康"""
    skills_dir = os.path.join(CLAWD, "skills")
    today = datetime.now().strftime("%Y-%m-%d")
    
    skills = [d for d in os.listdir(skills_dir) 
              if os.path.isdir(os.path.join(skills_dir, d)) and not d.startswith('.')]
    total = len(skills)
    
    added_today = []
    modified_today = []
    incomplete = []
    details = []
    
    for s in sorted(skills):
        sp = os.path.join(skills_dir, s)
        mt = mtime(sp)
        if mt and mt.strftime("%Y-%m-%d") == today:
            # 用 git 判斷是新增還是修改
            modified_today.append(s)
        
        # 檢查完整性：只有 SKILL.md 沒有其他任何檔案
        # 注意：純指令型 skill（只有 SKILL.md）是正常的，不算不完整
        # 不完整 = 有 SKILL.md 但裡面是空的或小於 50 bytes
        skill_md = os.path.join(sp, "SKILL.md")
        if os.path.exists(skill_md):
            size = os.path.getsize(skill_md)
            if size < 50:
                incomplete.append(s)
        else:
            incomplete.append(s)
        
        if VERBOSE and mt:
            details.append(f"  {s}: {mt.strftime('%m-%d %H:%M')}")
    
    summary = f"🔧 Skills: 共{total}個 | 今日{len(modified_today)}修改 | 不完整: {len(incomplete)}"
    if incomplete:
        summary += f" ⚠️ [{', '.join(incomplete)}]"
    
    return {"summary": summary, "details": details, 
            "total": total, "modified": len(modified_today), "incomplete": len(incomplete)}

def check_memory():
    """B. 記憶健康"""
    mem_dir = os.path.join(CLAWD, "memory")
    today = datetime.now().strftime("%Y-%m-%d")
    today_file = os.path.join(mem_dir, f"{today}.md")
    
    # 檔案數和大小
    mem_files = run(f"find {mem_dir} -type f 2>/dev/null | wc -l")
    
    # 今日記錄
    daily_lines = 0
    if os.path.exists(today_file):
        with open(today_file) as f:
            daily_lines = len(f.readlines())
    daily_status = f"今日已記錄({daily_lines}行)" if daily_lines > 0 else "今日未記錄 ⚠️"
    
    # MEMORY.md 最後更新
    memory_md = mtime(os.path.join(CLAWD, "MEMORY.md"))
    memory_ago = time_ago(memory_md) if memory_md else "不存在 ⚠️"
    
    # 最近 git commit
    commit_info = run(f"cd {CLAWD} && git log -1 --format='%ar|||%s' 2>/dev/null")
    if "|||" in commit_info:
        commit_ago, commit_msg = commit_info.split("|||", 1)
    else:
        commit_ago, commit_msg = "未知", ""
    
    summary = f"🧠 Memory: {daily_status} | 上次commit: {commit_ago} | MEMORY.md: {memory_ago}更新"
    
    return {"summary": summary, "daily_lines": daily_lines,
            "commits_today": int(run(f"cd {CLAWD} && git log --oneline --since='midnight' 2>/dev/null | wc -l") or 0)}

def check_bita():
    """C. 幣塔資料系統"""
    bita_base = os.path.join(HOME, "Documents/幣塔")
    
    # Growth profiles
    gp_dir = os.path.join(bita_base, "data/growth-profiles")
    if os.path.isdir(gp_dir):
        profiles = [f for f in os.listdir(gp_dir) if f.endswith('.json')]
        profile_count = len(profiles)
    else:
        profiles = []
        profile_count = 0
    
    # Calibrations today
    cal_dir = os.path.join(bita_base, "data/calibrations")
    today = datetime.now().strftime("%Y-%m-%d")
    cal_today = 0
    if os.path.isdir(cal_dir):
        for f in os.listdir(cal_dir):
            if today in f:
                cal_today += 1
    
    # Daily latest
    daily_dir = os.path.join(bita_base, "data/daily")
    latest_daily = ""
    if os.path.isdir(daily_dir):
        days = sorted(os.listdir(daily_dir))
        latest_daily = days[-1] if days else "無"
    
    # push_enabled
    config_path = os.path.join(bita_base, "config.json")
    push = "?"
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                cfg = json.load(f)
            push = "ON" if cfg.get("push_enabled") else "OFF"
        except:
            push = "ERR"
    
    profile_str = f"{profile_count}/7 profiles"
    if profile_count < 7:
        profile_str += " ⚠️"
    
    summary = f"📁 幣塔: {profile_str} | 今日{cal_today}筆校準 | push={push}"
    
    return {"summary": summary, "profiles": profile_count, "cal_today": cal_today}

def _curl_status(url):
    """curl with status + body snippet"""
    raw = run(f"curl -s -m 3 -w 'HTTPSTATUS:%{{http_code}}' {url}")
    if "HTTPSTATUS:" not in raw:
        return {"ok": False, "status": "err", "body": raw[:120]}
    body, status = raw.split("HTTPSTATUS:", 1)
    status = status.strip()
    ok = status.startswith("2") and ("ok" in body.lower() or "true" in body.lower())
    return {"ok": ok, "status": status, "body": body.strip()[:120]}

def check_services():
    """D. 服務健康"""
    services = {
        "exec-bridge": "http://host.docker.internal:18793/health",
        "userbot": "http://host.docker.internal:18790/health",
    }
    results = {}
    parts = []
    details = []
    for name, url in services.items():
        info = _curl_status(url)
        results[name] = info["ok"]
        parts.append(f"{name} {'✅' if info['ok'] else '❌'}")
        details.append(f"{name}: status={info['status']} body={info['body']}")
    
    summary = f"🔌 服務: {' | '.join(parts)}"
    return {"summary": summary, "details": details, **results}

def check_workspace():
    """E. 工作區健康"""
    # 總檔案數
    file_count = run(f"find {CLAWD} -type f 2>/dev/null | wc -l").strip()
    
    # git status
    uncommitted = run(f"cd {CLAWD} && git status --porcelain 2>/dev/null | wc -l").strip()
    
    # output 大檔案
    big_files = run(f"find {CLAWD}/output -type f -size +10M 2>/dev/null | wc -l").strip()
    output_status = "clean" if big_files == "0" else f"{big_files}個大檔 ⚠️"
    
    summary = f"💾 工作區: {file_count}檔案 | git: {uncommitted} uncommitted | output: {output_status}"
    
    return {"summary": summary, "files": int(file_count or 0), 
            "uncommitted": int(uncommitted or 0)}

def main():
    results = {}
    checks = [
        ("skills", check_skills),
        ("memory", check_memory),
        ("bita", check_bita),
        ("services", check_services),
        ("workspace", check_workspace),
    ]
    
    print("📊 系統健康報告")
    for key, fn in checks:
        try:
            r = fn()
            results[key] = r
            print(r["summary"])
            if VERBOSE and r.get("details"):
                for d in r["details"]:
                    print(d)
        except Exception as e:
            print(f"⚠️ {key} 檢查失敗: {e}")
    
    # 異常摘要
    alerts = []
    if results.get("memory", {}).get("daily_lines", 0) == 0:
        alerts.append("今日未寫 memory")
    if results.get("services") and not results["services"].get("exec-bridge"):
        alerts.append("exec-bridge 掛了")
    if results.get("services") and not results["services"].get("userbot"):
        alerts.append("userbot 掛了")
    if results.get("skills", {}).get("incomplete", 0) > 0:
        alerts.append("有不完整 skill")
    
    if alerts:
        print(f"\n⚠️ 需注意: {' | '.join(alerts)}")
    
    return results

if __name__ == "__main__":
    main()
