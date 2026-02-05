#!/usr/bin/env python3
"""
BG666 漏斗週報自動生成器
- 抓取過去 7 天 + 30 天 + 全量數據
- 生成 HTML + Telegram 文字版
- 支援一鍵重跑
"""

import subprocess
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 配置
SKILL_PATH = Path.home() / "clawd/skills/bg666-db/scripts/query.py"
OUTPUT_DIR = Path.home() / "clawd/output"

def run_query(sql: str) -> list:
    """執行 BG666 SQL 查詢"""
    try:
        result = subprocess.run(
            ["python3", str(SKILL_PATH), "--json", sql],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            print(f"Query error: {result.stderr}", file=sys.stderr)
            return []
        return json.loads(result.stdout) if result.stdout.strip() else []
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return []

def get_funnel_data(days: int = None) -> dict:
    """
    獲取漏斗數據
    days=None: 全量
    days=7: 近7天
    days=30: 近30天
    """
    date_filter = ""
    if days:
        date_filter = f"AND create_time >= DATE_SUB(CURDATE(), INTERVAL {days} DAY)"
    
    # 註冊數
    reg_sql = f"SELECT COUNT(*) as cnt FROM sys_player WHERE 1=1 {date_filter}"
    
    # 首充數（有首充記錄的）
    ftd_sql = f"""
    SELECT COUNT(DISTINCT player_id) as cnt 
    FROM first_deposit_record 
    WHERE 1=1 {date_filter.replace('create_time', 'recharge_time')}
    """
    
    # 二充、三充、四充（根據充值次數）
    recharge_sql = f"""
    SELECT 
        COUNT(CASE WHEN recharge_count >= 2 THEN 1 END) as second_deposit,
        COUNT(CASE WHEN recharge_count >= 3 THEN 1 END) as third_deposit,
        COUNT(CASE WHEN recharge_count >= 4 THEN 1 END) as fourth_deposit
    FROM (
        SELECT player_id, COUNT(*) as recharge_count
        FROM player_recharge_order
        WHERE status = 1 {date_filter}
        GROUP BY player_id
    ) t
    """
    
    reg_result = run_query(reg_sql)
    ftd_result = run_query(ftd_sql)
    recharge_result = run_query(recharge_sql)
    
    registration = reg_result[0]['cnt'] if reg_result else 0
    first_deposit = ftd_result[0]['cnt'] if ftd_result else 0
    
    if recharge_result:
        second_deposit = recharge_result[0].get('second_deposit', 0) or 0
        third_deposit = recharge_result[0].get('third_deposit', 0) or 0
        fourth_deposit = recharge_result[0].get('fourth_deposit', 0) or 0
    else:
        second_deposit = third_deposit = fourth_deposit = 0
    
    return {
        'registration': registration,
        'first_deposit': first_deposit,
        'second_deposit': second_deposit,
        'third_deposit': third_deposit,
        'fourth_deposit': fourth_deposit
    }

def calc_rates(data: dict) -> dict:
    """計算轉化率"""
    def safe_rate(num, denom):
        return round(num / denom * 100, 1) if denom > 0 else 0
    
    return {
        'reg_to_ftd': safe_rate(data['first_deposit'], data['registration']),
        'ftd_to_2nd': safe_rate(data['second_deposit'], data['first_deposit']),
        '2nd_to_3rd': safe_rate(data['third_deposit'], data['second_deposit']),
        '3rd_to_4th': safe_rate(data['fourth_deposit'], data['third_deposit'])
    }

def generate_telegram_report(all_data: dict, recent_data: dict, week_data: dict) -> str:
    """生成 Telegram 文字版報告"""
    all_rates = calc_rates(all_data)
    recent_rates = calc_rates(recent_data)
    week_rates = calc_rates(week_data)
    
    def trend(current, baseline):
        diff = current - baseline
        if diff > 0:
            return f"↑{diff:.1f}%"
        elif diff < 0:
            return f"↓{abs(diff):.1f}%"
        return "→"
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    report = f"""📊 **BG666 漏斗週報**
📅 {today}

**📈 本週數據 (7天)**
• 註冊：{week_data['registration']:,}
• 首充：{week_data['first_deposit']:,} ({week_rates['reg_to_ftd']}%)
• 二充：{week_data['second_deposit']:,} ({week_rates['ftd_to_2nd']}%)
• 三充：{week_data['third_deposit']:,} ({week_rates['2nd_to_3rd']}%)

**📊 轉化率對比**
| 環節 | 本週 | 近30天 | 趨勢 |
|------|------|--------|------|
| 註冊→首充 | {week_rates['reg_to_ftd']}% | {recent_rates['reg_to_ftd']}% | {trend(week_rates['reg_to_ftd'], recent_rates['reg_to_ftd'])} |
| 首充→二充 | {week_rates['ftd_to_2nd']}% | {recent_rates['ftd_to_2nd']}% | {trend(week_rates['ftd_to_2nd'], recent_rates['ftd_to_2nd'])} |
| 二充→三充 | {week_rates['2nd_to_3rd']}% | {recent_rates['2nd_to_3rd']}% | {trend(week_rates['2nd_to_3rd'], recent_rates['2nd_to_3rd'])} |

**💡 本週洞察**
• [待填：根據數據變化填寫]

**📌 建議行動**
• [待填：1-2 條具體建議]
"""
    return report

def generate_html_report(all_data: dict, recent_data: dict, week_data: dict) -> str:
    """生成 HTML 視覺化報告"""
    all_rates = calc_rates(all_data)
    recent_rates = calc_rates(recent_data)
    week_rates = calc_rates(week_data)
    today = datetime.now().strftime("%Y-%m-%d")
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BG666 漏斗週報</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            padding: 40px;
            min-height: 100vh;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{
            text-align: center;
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .subtitle {{ text-align: center; color: #888; margin-bottom: 40px; }}
        .funnels {{ display: flex; gap: 40px; justify-content: center; flex-wrap: wrap; }}
        .funnel-card {{
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            padding: 30px;
            width: 350px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }}
        .funnel-title {{ font-size: 1.4em; margin-bottom: 25px; text-align: center; color: #00d2ff; }}
        .stage {{ margin: 15px 0; }}
        .stage-label {{ display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9em; }}
        .stage-name {{ font-weight: bold; }}
        .stage-stats {{ color: #aaa; }}
        .bar-container {{ background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; height: 35px; }}
        .bar {{
            height: 100%;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 15px;
            font-weight: bold;
        }}
        .bar-1 {{ background: linear-gradient(90deg, #3498db, #2980b9); }}
        .bar-2 {{ background: linear-gradient(90deg, #2ecc71, #27ae60); }}
        .bar-3 {{ background: linear-gradient(90deg, #f39c12, #e67e22); }}
        .bar-4 {{ background: linear-gradient(90deg, #e74c3c, #c0392b); }}
        .comparison {{
            margin-top: 40px;
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            padding: 30px;
        }}
        .comparison h2 {{ color: #00d2ff; margin-bottom: 20px; text-align: center; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 15px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }}
        th {{ color: #00d2ff; }}
        .up {{ color: #2ecc71; }}
        .down {{ color: #e74c3c; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 BG666 漏斗週報</h1>
        <p class="subtitle">數據更新：{today}</p>
        
        <div class="funnels">
            <div class="funnel-card">
                <div class="funnel-title">📅 本週 (7天)</div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">註冊</span>
                        <span class="stage-stats">{week_data['registration']:,}</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-1" style="width:100%">100%</div></div>
                </div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">首充</span>
                        <span class="stage-stats">{week_data['first_deposit']:,} ({week_rates['reg_to_ftd']}%)</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-2" style="width:{week_rates['reg_to_ftd']}%">{week_rates['reg_to_ftd']}%</div></div>
                </div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">二充</span>
                        <span class="stage-stats">{week_data['second_deposit']:,} ({week_rates['ftd_to_2nd']}%)</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-3" style="width:{week_rates['ftd_to_2nd']}%">{week_rates['ftd_to_2nd']}%</div></div>
                </div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">三充</span>
                        <span class="stage-stats">{week_data['third_deposit']:,} ({week_rates['2nd_to_3rd']}%)</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-4" style="width:{week_rates['2nd_to_3rd']}%">{week_rates['2nd_to_3rd']}%</div></div>
                </div>
            </div>
            
            <div class="funnel-card">
                <div class="funnel-title">📈 近30天</div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">註冊</span>
                        <span class="stage-stats">{recent_data['registration']:,}</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-1" style="width:100%">100%</div></div>
                </div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">首充</span>
                        <span class="stage-stats">{recent_data['first_deposit']:,} ({recent_rates['reg_to_ftd']}%)</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-2" style="width:{recent_rates['reg_to_ftd']}%">{recent_rates['reg_to_ftd']}%</div></div>
                </div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">二充</span>
                        <span class="stage-stats">{recent_data['second_deposit']:,} ({recent_rates['ftd_to_2nd']}%)</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-3" style="width:{recent_rates['ftd_to_2nd']}%">{recent_rates['ftd_to_2nd']}%</div></div>
                </div>
                <div class="stage">
                    <div class="stage-label">
                        <span class="stage-name">三充</span>
                        <span class="stage-stats">{recent_data['third_deposit']:,} ({recent_rates['2nd_to_3rd']}%)</span>
                    </div>
                    <div class="bar-container"><div class="bar bar-4" style="width:{recent_rates['2nd_to_3rd']}%">{recent_rates['2nd_to_3rd']}%</div></div>
                </div>
            </div>
        </div>
        
        <div class="comparison">
            <h2>📊 轉化率對比</h2>
            <table>
                <tr><th>轉化環節</th><th>本週</th><th>近30天</th><th>全量</th></tr>
                <tr>
                    <td>註冊→首充</td>
                    <td>{week_rates['reg_to_ftd']}%</td>
                    <td>{recent_rates['reg_to_ftd']}%</td>
                    <td>{all_rates['reg_to_ftd']}%</td>
                </tr>
                <tr>
                    <td>首充→二充</td>
                    <td>{week_rates['ftd_to_2nd']}%</td>
                    <td>{recent_rates['ftd_to_2nd']}%</td>
                    <td>{all_rates['ftd_to_2nd']}%</td>
                </tr>
                <tr>
                    <td>二充→三充</td>
                    <td>{week_rates['2nd_to_3rd']}%</td>
                    <td>{recent_rates['2nd_to_3rd']}%</td>
                    <td>{all_rates['2nd_to_3rd']}%</td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>"""
    return html

def main():
    print("🔄 正在抓取 BG666 漏斗數據...")
    
    # 抓取三組數據
    print("  - 全量數據...")
    all_data = get_funnel_data(None)
    
    print("  - 近30天數據...")
    recent_data = get_funnel_data(30)
    
    print("  - 本週數據 (7天)...")
    week_data = get_funnel_data(7)
    
    # 生成報告
    today = datetime.now().strftime("%Y-%m-%d")
    
    # HTML
    html_path = OUTPUT_DIR / f"bg666_funnel_{today}.html"
    html_content = generate_html_report(all_data, recent_data, week_data)
    html_path.write_text(html_content, encoding='utf-8')
    print(f"✅ HTML 報告：{html_path}")
    
    # Telegram 文字版
    tg_path = OUTPUT_DIR / f"bg666_funnel_{today}.txt"
    tg_content = generate_telegram_report(all_data, recent_data, week_data)
    tg_path.write_text(tg_content, encoding='utf-8')
    print(f"✅ TG 文字版：{tg_path}")
    
    # 輸出到終端
    print("\n" + "="*50)
    print(tg_content)

if __name__ == "__main__":
    main()
