#!/usr/bin/env python3
"""成長指標追蹤 — 每次跑完存入 data/growth-metrics.json"""

import os
import json
import subprocess
from datetime import datetime
from pathlib import Path

HOME = os.path.expanduser("~")
CLAWD = os.path.join(HOME, "clawd")
METRICS_FILE = os.path.join(CLAWD, "data", "growth-metrics.json")

def run(cmd, timeout=5):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except:
        return ""

def load_metrics():
    """載入現有指標數據"""
    if os.path.exists(METRICS_FILE):
        with open(METRICS_FILE) as f:
            return json.load(f)
    return []

def collect_today():
    """收集今日指標"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Skills
    skills_dir = os.path.join(CLAWD, "skills")
    skills = [d for d in os.listdir(skills_dir) 
              if os.path.isdir(os.path.join(skills_dir, d)) and not d.startswith('.')]
    modified = sum(1 for s in skills 
                   if datetime.fromtimestamp(os.path.getmtime(os.path.join(skills_dir, s))).strftime("%Y-%m-%d") == today)
    
    # Memory
    today_file = os.path.join(CLAWD, "memory", f"{today}.md")
    daily_lines = 0
    if os.path.exists(today_file):
        with open(today_file) as f:
            daily_lines = len(f.readlines())
    commits_today = int(run(f"cd {CLAWD} && git log --oneline --since='midnight' 2>/dev/null | wc -l") or 0)
    
    # Calibrations
    cal_dir = os.path.join(HOME, "Documents/幣塔/data/calibrations")
    cal_today = 0
    cal_total = 0
    if os.path.isdir(cal_dir):
        for f in os.listdir(cal_dir):
            cal_total += 1
            if today in f:
                cal_today += 1
    
    # Corrections（從今日 memory 找糾正記錄）
    corrections_today = 0
    if os.path.exists(today_file):
        with open(today_file) as f:
            content = f.read()
        corrections_today = content.count("糾正") + content.count("correction") + content.count("⚠️ 錯誤")
    
    return {
        "date": today,
        "skills": {"total": len(skills), "modified": modified},
        "memory": {"daily_lines": daily_lines, "commits_today": commits_today},
        "calibrations": {"today": cal_today, "total": cal_total},
        "corrections": {"today": corrections_today},
    }

def main():
    metrics = load_metrics()
    today_data = collect_today()
    today = today_data["date"]
    
    # 更新或新增今日記錄
    updated = False
    for i, m in enumerate(metrics):
        if m.get("date") == today:
            metrics[i] = today_data
            updated = True
            break
    if not updated:
        metrics.append(today_data)
    
    # 只保留最近 90 天
    metrics = metrics[-90:]
    
    os.makedirs(os.path.dirname(METRICS_FILE), exist_ok=True)
    with open(METRICS_FILE, "w") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    
    print(f"📈 成長指標已更新: {today}")
    print(f"   Skills: {today_data['skills']['total']}個 | Memory: {today_data['memory']['daily_lines']}行")
    print(f"   Commits: {today_data['memory']['commits_today']} | 校準: {today_data['calibrations']['today']}筆")

if __name__ == "__main__":
    main()
