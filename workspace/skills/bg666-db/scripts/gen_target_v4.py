#!/usr/bin/env python3
"""BG666 2-4月 周预期进度表 v4 — pandas ExcelWriter for max compatibility"""
import pandas as pd
from pathlib import Path
from datetime import date, timedelta
import calendar

OUTPUT = Path(__file__).parent.parent.parent.parent / "output" / "bg666_2026_feb_target_v4.xlsx"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

BASE_DAYS = 61
BASE = {
    "注册人数": {"total": 63293, "daily": 1037.59},
    "活跃人数": {"total": 2458053, "daily": 40295.95},
    "ip人数": {"total": 3096137, "daily": 50756.34},
    "充值": {"total": 249050189, "daily": 4082789.98},
    "提现": {"total": 216238980, "daily": 3544901.31},
    "充提差": {"total": 32811209, "daily": 537888.67},
    "总投注": {"total": 2069769048.72, "daily": 33930640.14},
    "首充人数": {"total": 34049, "daily": 558.18},
    "充值人数": {"total": 392084, "daily": 6427.61},
    "人均充值": {"total": None, "daily": 635.13},
}
GROWTH = {"2月": 0.05, "3月": 0.05, "4月": 0.05}

sources = {
    "注册人数": "channel_data_statistics.register_number",
    "活跃人数": "channel_data_statistics.active_number",
    "ip人数": "channel_data_statistics.ip_number",
    "充值": "channel_data_statistics.recharge_amount (order_status=1)",
    "提现": "channel_data_statistics.withdraw_amount (order_status=3, finish_time)",
    "充提差": "充值 - 提现（计算字段）",
    "总投注": "channel_game_statistics.bet_amount（不用player_statistics_day）",
    "首充人数": "channel_data_statistics.first_recharge_number（全历史首充）",
    "充值人数": "channel_data_statistics.recharge_number",
    "人均充值": "充值 / 充值人数（计算字段）",
}

def get_weekly_sundays(year, month):
    days_in = calendar.monthrange(year, month)[1]
    first = date(year, month, 1)
    last = date(year, month, days_in)
    sundays = [d for d in (first + timedelta(n) for n in range(days_in)) if d.weekday() == 6]
    if last not in sundays:
        sundays.append(last)
    return sorted(sundays)

def calc_target(metric, cum_days, g):
    daily = BASE[metric]["daily"]
    if metric == "人均充值":
        return round(daily * (1+g), 2)
    elif metric == "充提差":
        return round((BASE["充值"]["daily"] - BASE["提现"]["daily"]) * cum_days * (1+g))
    else:
        return round(daily * cum_days * (1+g))

def main():
    metrics = list(BASE.keys())
    months_info = [("2026-02", 2, 28), ("2026-03", 3, 31), ("2026-04", 4, 30)]

    # Build DataFrames
    # 1. 基准日均
    base_df = pd.DataFrame([
        {"指标": k, "61天总量": v["total"] if v["total"] else "", "日均": round(v["daily"], 2), "DB口径": sources[k]}
        for k, v in BASE.items()
    ])

    # 2. 月度预期总览
    summary_rows = []
    for label, month, days in months_info:
        mname = f"{month}月"
        g = GROWTH[mname]
        summary_rows.append({
            "月份": label, "天数": days, "增长": f"{g*100:.0f}%",
            "预期注册": round(BASE["注册人数"]["daily"] * days * (1+g)),
            "预期充值": round(BASE["充值"]["daily"] * days * (1+g)),
            "预期投注": round(BASE["总投注"]["daily"] * days * (1+g)),
            "预期首充": round(BASE["首充人数"]["daily"] * days * (1+g)),
            "预期充值人数": round(BASE["充值人数"]["daily"] * days * (1+g)),
        })
    summary_df = pd.DataFrame(summary_rows)

    # 3. 预期口径
    target_notes = pd.DataFrame([
        {"预期指标": "预期注册", "口径说明": "= 注册人数日均 x 天数 x (1+增长率)。来源：channel_data_statistics.register_number"},
        {"预期指标": "预期充值", "口径说明": "= 充值日均 x 天数 x (1+增长率)。来源：channel_data_statistics.recharge_amount (order_status=1)"},
        {"预期指标": "预期投注", "口径说明": "= 总投注日均 x 天数 x (1+增长率)。来源：channel_game_statistics.bet_amount（不用player_statistics_day）"},
        {"预期指标": "预期首充", "口径说明": "= 首充人数日均 x 天数 x (1+增长率)。来源：channel_data_statistics.first_recharge_number（全历史首充）"},
        {"预期指标": "预期充值人数", "口径说明": "= 充值人数日均 x 天数 x (1+增长率)。来源：channel_data_statistics.recharge_number"},
    ])

    with pd.ExcelWriter(str(OUTPUT), engine="openpyxl") as writer:
        # 总览 sheet
        base_df.to_excel(writer, sheet_name="总览", index=False, startrow=1)
        ws = writer.sheets["总览"]
        ws["A1"] = "BG666 2026 2-4月 周预期进度表 | 基准期 2025-12-01~2026-01-30"

        sr = 2 + len(base_df) + 2
        summary_df.to_excel(writer, sheet_name="总览", index=False, startrow=sr)
        ws.cell(sr, 1, "月度预期总览（日均 x 天数 x (1+增长率5%)）")

        nr = sr + 1 + len(summary_df) + 2
        target_notes.to_excel(writer, sheet_name="总览", index=False, startrow=nr)
        ws.cell(nr, 1, "预期指标口径说明")

        # Monthly sheets
        for label, month, days in months_info:
            mname = f"{month}月"
            g = GROWTH[mname]
            sundays = get_weekly_sundays(2026, month)
            first_day = date(2026, month, 1)
            rows = []
            for sunday in sundays:
                cum_days = (sunday - first_day).days + 1
                row = {"周结算日": sunday.strftime("%Y-%m-%d"), "累计天数": cum_days, "时间进度": f"{cum_days/days*100:.1f}%"}
                for m in metrics:
                    row[m] = calc_target(m, cum_days, g)
                rows.append(row)
            # Month total
            total_row = {"周结算日": "月度总目标", "累计天数": days, "时间进度": "100%"}
            for m in metrics:
                total_row[m] = calc_target(m, days, g)
            rows.append(total_row)
            rows.append({"周结算日": "实际累计"})
            rows.append({"周结算日": "差异"})

            df = pd.DataFrame(rows)
            df.to_excel(writer, sheet_name=mname, index=False, startrow=1)
            ws2 = writer.sheets[mname]
            ws2.cell(1, 1, f"2026 {mname} 周预期进度 | 增长假设 {g*100:.0f}%")

        # 口径说明 sheet
        note_rows = [
            {"指标": "注册人数", "DB来源表": "channel_data_statistics", "DB字段": "register_number", "SQL口径": "SUM(register_number) GROUP BY statistics_day", "备注": "当日新注册玩家数"},
            {"指标": "活跃人数", "DB来源表": "channel_data_statistics", "DB字段": "active_number", "SQL口径": "SUM(active_number) GROUP BY statistics_day", "备注": "当日至少登录一次的独立玩家数"},
            {"指标": "ip人数", "DB来源表": "channel_data_statistics", "DB字段": "ip_number", "SQL口径": "SUM(ip_number) GROUP BY statistics_day", "备注": "不能从logininfor推算（偏小约3600）"},
            {"指标": "充值", "DB来源表": "channel_data_statistics", "DB字段": "recharge_amount", "SQL口径": "SUM(recharge_amount) GROUP BY statistics_day", "备注": "order_status=1 成功订单"},
            {"指标": "提现", "DB来源表": "channel_data_statistics", "DB字段": "withdraw_amount", "SQL口径": "SUM(withdraw_amount) GROUP BY statistics_day", "备注": "order_status=3（不是1），用finish_time"},
            {"指标": "充提差", "DB来源表": "计算字段", "DB字段": "recharge-withdraw", "SQL口径": "SUM(recharge_amount)-SUM(withdraw_amount)", "备注": "正=净流入，负=净流出"},
            {"指标": "总投注", "DB来源表": "channel_game_statistics", "DB字段": "bet_amount", "SQL口径": "SUM(bet_amount) GROUP BY statistics_day", "备注": "不用player_statistics_day（有差异）"},
            {"指标": "首充人数", "DB来源表": "channel_data_statistics", "DB字段": "first_recharge_number", "SQL口径": "SUM(first_recharge_number) GROUP BY statistics_day", "备注": "全历史首充，不用first_deposit_record"},
            {"指标": "充值人数", "DB来源表": "channel_data_statistics", "DB字段": "recharge_number", "SQL口径": "SUM(recharge_number) GROUP BY statistics_day", "备注": "当日有成功充值的独立玩家数"},
            {"指标": "人均充值", "DB来源表": "计算字段", "DB字段": "充值/充值人数", "SQL口径": "SUM(recharge_amount)/SUM(recharge_number)", "备注": "付费玩家平均充值深度"},
        ]
        notes_df = pd.DataFrame(note_rows)
        notes_df.to_excel(writer, sheet_name="口径说明", index=False, startrow=1)
        ws3 = writer.sheets["口径说明"]
        ws3.cell(1, 1, "BG666 报表口径说明 | 已与后台逐日对齐验证")

    print(f"Done: {OUTPUT}")

if __name__ == "__main__":
    main()
