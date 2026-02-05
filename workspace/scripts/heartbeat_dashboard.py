#!/usr/bin/env python3
"""
Heartbeat Dashboard — 心跳效率追蹤
每次心跳結束時呼叫，記錄產出並生成報告
"""

import json
import os
from datetime import datetime, timezone, timedelta

TPE = timezone(timedelta(hours=8))
DASHBOARD_PATH = os.path.expanduser("~/clawd/output/heartbeat_dashboard.json")

def load_data():
    if os.path.exists(DASHBOARD_PATH):
        with open(DASHBOARD_PATH) as f:
            return json.load(f)
    return {"heartbeats": [], "daily_summary": {}}

def save_data(data):
    os.makedirs(os.path.dirname(DASHBOARD_PATH), exist_ok=True)
    with open(DASHBOARD_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def record_heartbeat(outputs=None, sessions_synced=0, projects_pushed=0, 
                     issues_found=0, knowledge_items=0, alignment_score=None):
    """記錄一次心跳的產出"""
    data = load_data()
    now = datetime.now(TPE)
    
    entry = {
        "timestamp": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "hour": now.hour,
        "outputs": outputs or [],          # 具體產出列表
        "sessions_synced": sessions_synced, # 同步了幾個 session
        "projects_pushed": projects_pushed, # 推進了幾個專案
        "issues_found": issues_found,       # 發現幾個問題
        "knowledge_items": knowledge_items, # 同步了幾條知識
        "alignment_score": alignment_score, # 願景對齊分數 (0-100)
        "is_productive": bool(outputs),     # 是否有實際產出
    }
    
    data["heartbeats"].append(entry)
    
    # 保留最近 7 天
    cutoff = (now - timedelta(days=7)).isoformat()
    data["heartbeats"] = [h for h in data["heartbeats"] if h["timestamp"] > cutoff]
    
    # 更新日報
    date_key = now.strftime("%Y-%m-%d")
    if date_key not in data["daily_summary"]:
        data["daily_summary"][date_key] = {
            "total": 0, "productive": 0, "empty": 0,
            "outputs": [], "sessions_synced": 0,
            "projects_pushed": 0, "issues_found": 0,
            "knowledge_items": 0
        }
    
    day = data["daily_summary"][date_key]
    day["total"] += 1
    if entry["is_productive"]:
        day["productive"] += 1
    else:
        day["empty"] += 1
    day["outputs"].extend(outputs or [])
    day["sessions_synced"] += sessions_synced
    day["projects_pushed"] += projects_pushed
    day["issues_found"] += issues_found
    day["knowledge_items"] += knowledge_items
    
    # 清理超過 7 天的日報
    cutoff_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    data["daily_summary"] = {k: v for k, v in data["daily_summary"].items() if k >= cutoff_date}
    
    save_data(data)
    return entry

def generate_report():
    """生成 dashboard 報告"""
    data = load_data()
    now = datetime.now(TPE)
    today = now.strftime("%Y-%m-%d")
    
    # 今日統計
    day = data["daily_summary"].get(today, {
        "total": 0, "productive": 0, "empty": 0,
        "outputs": [], "sessions_synced": 0,
        "projects_pushed": 0, "issues_found": 0,
        "knowledge_items": 0
    })
    
    total = day["total"] or 1  # avoid div by zero
    prod_rate = day["productive"] / total * 100
    
    # 7 天趨勢
    week_total = sum(d["total"] for d in data["daily_summary"].values())
    week_productive = sum(d["productive"] for d in data["daily_summary"].values())
    week_rate = (week_productive / week_total * 100) if week_total else 0
    
    report = f"""📊 心跳效率 Dashboard
━━━━━━━━━━━━━━━━━━
📅 今日 ({today})
  心跳次數：{day['total']}
  有產出：{day['productive']} ({prod_rate:.0f}%)
  空跑：{day['empty']}
  
📦 今日產出
  🔄 Session 同步：{day['sessions_synced']} 次
  🚀 專案推進：{day['projects_pushed']} 次
  ⚠️ 問題發現：{day['issues_found']} 個
  🧠 知識同步：{day['knowledge_items']} 條
  
📈 7 日趨勢
  總心跳：{week_total}
  產出率：{week_rate:.0f}%
  
🎯 今日具體產出：
"""
    for i, output in enumerate(day["outputs"][-10:], 1):  # last 10
        report += f"  {i}. {output}\n"
    
    if not day["outputs"]:
        report += "  （暫無）\n"
    
    return report

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "report":
        print(generate_report())
    else:
        # Demo record
        entry = record_heartbeat(
            outputs=["測試記錄"],
            sessions_synced=1,
            knowledge_items=1
        )
        print(json.dumps(entry, indent=2, ensure_ascii=False))
