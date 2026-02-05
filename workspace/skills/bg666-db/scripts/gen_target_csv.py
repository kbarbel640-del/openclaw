#!/usr/bin/env python3
"""BG666 2-4月 周预期进度表 — CSV 单文件版"""
import csv
from pathlib import Path
from datetime import date, timedelta
import calendar

OUTPUT = Path(__file__).parent.parent.parent.parent / "output" / "bg666_2026_feb_target.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

BASE_DAYS = 61
BASE = {
    "注册人数": {"total": 63293, "daily": 1037.59, "src": "channel_data_statistics.register_number"},
    "活跃人数": {"total": 2458053, "daily": 40295.95, "src": "channel_data_statistics.active_number"},
    "ip人数": {"total": 3096137, "daily": 50756.34, "src": "channel_data_statistics.ip_number"},
    "充值": {"total": 249050189, "daily": 4082789.98, "src": "channel_data_statistics.recharge_amount (order_status=1)"},
    "提现": {"total": 216238980, "daily": 3544901.31, "src": "channel_data_statistics.withdraw_amount (order_status=3, finish_time)"},
    "充提差": {"total": 32811209, "daily": 537888.67, "src": "充值-提现（计算字段）"},
    "总投注": {"total": 2069769048.72, "daily": 33930640.14, "src": "channel_game_statistics.bet_amount（不用player_statistics_day）"},
    "首充人数": {"total": 34049, "daily": 558.18, "src": "channel_data_statistics.first_recharge_number（全历史首充）"},
    "充值人数": {"total": 392084, "daily": 6427.61, "src": "channel_data_statistics.recharge_number"},
    "人均充值": {"total": None, "daily": 635.13, "src": "充值/充值人数（计算字段）"},
}
GROWTH = {"2月": 1.05, "3月": 1.05**2, "4月": 1.05**3}  # 逐月复利5%
metrics = list(BASE.keys())

def get_weekly_sundays(year, month):
    days_in = calendar.monthrange(year, month)[1]
    first = date(year, month, 1)
    last = date(year, month, days_in)
    sundays = [first + timedelta(n) for n in range(days_in) if (first + timedelta(n)).weekday() == 6]
    if last not in sundays:
        sundays.append(last)
    return sorted(sundays)

def calc(metric, cum_days, g):
    d = BASE[metric]["daily"]
    if metric == "人均充值":
        return round(d * g, 2)
    elif metric == "充提差":
        return round((BASE["充值"]["daily"] - BASE["提现"]["daily"]) * cum_days * g)
    else:
        return round(d * cum_days * g)

def main():
    rows = []
    W = rows.append

    # === 标题 ===
    W(["BG666 2026 2-4月 周预期进度表"])
    W(["基准期: 2025-12-01 ~ 2026-01-30 (61天) | 增长假设: 每月复利5% (2月5%/3月10.25%/4月15.76%) | 周结算: 周日"])
    W([])

    # === 基准日均 ===
    W(["[基准日均指标]"])
    W(["指标", "61天总量", "日均", "DB口径"])
    for k, v in BASE.items():
        t = v["total"] if v["total"] else ""
        W([k, t, round(v["daily"], 2), v["src"]])
    W([])

    # === 月度预期总览 ===
    W(["[月度预期总览] 公式: 日均 x 天数 x 复利系数"])
    header = ["月份", "天数", "增长"] + metrics
    W(header)

    months_info = [("2026-02", 2, 28), ("2026-03", 3, 31), ("2026-04", 4, 30)]
    for label, month, days in months_info:
        mname = f"{month}月"
        g = GROWTH[mname]
        row = [label, days, f"{(g-1)*100:.1f}%"]
        for m in metrics:
            row.append(calc(m, days, g))
        W(row)
    W([])

    # === 预期指标口径 ===
    W(["[预期指标口径]"])
    W(["预期注册", "= 注册人数日均 x 天数 x (1+增长率)", "channel_data_statistics.register_number"])
    W(["预期充值", "= 充值日均 x 天数 x (1+增长率)", "channel_data_statistics.recharge_amount (order_status=1)"])
    W(["预期投注", "= 总投注日均 x 天数 x (1+增长率)", "channel_game_statistics.bet_amount（不用player_statistics_day）"])
    W(["预期首充", "= 首充人数日均 x 天数 x (1+增长率)", "channel_data_statistics.first_recharge_number（全历史首充）"])
    W(["预期充值人数", "= 充值人数日均 x 天数 x (1+增长率)", "channel_data_statistics.recharge_number"])
    W([])

    # === 各月周进度 ===
    for label, month, days in months_info:
        mname = f"{month}月"
        g = GROWTH[mname]
        W([f"[{mname} 周预期进度] 增长{(g-1)*100:.1f}%"])
        W(["周结算日", "累计天数", "时间进度"] + metrics)

        sundays = get_weekly_sundays(2026, month)
        first_day = date(2026, month, 1)
        for sunday in sundays:
            cum = (sunday - first_day).days + 1
            row = [sunday.strftime("%Y-%m-%d"), cum, f"{cum/days*100:.1f}%"]
            for m in metrics:
                row.append(calc(m, cum, g))
            W(row)

        # 月度总目标
        row = ["月度总目标", days, "100%"]
        for m in metrics:
            row.append(calc(m, days, g))
        W(row)
        W(["实际累计"])
        W(["差异"])
        W([])

    # === 口径说明 ===
    W(["[口径说明]"])
    W(["指标", "DB来源表", "DB字段", "SQL口径", "备注"])
    notes = [
        ("注册人数", "channel_data_statistics", "register_number", "SUM(register_number) GROUP BY statistics_day", "当日新注册玩家数"),
        ("活跃人数", "channel_data_statistics", "active_number", "SUM(active_number) GROUP BY statistics_day", "当日登录独立玩家数"),
        ("ip人数", "channel_data_statistics", "ip_number", "SUM(ip_number) GROUP BY statistics_day", "不能从logininfor推算（偏小约3600）"),
        ("充值", "channel_data_statistics", "recharge_amount", "SUM(recharge_amount) GROUP BY statistics_day", "order_status=1 成功订单"),
        ("提现", "channel_data_statistics", "withdraw_amount", "SUM(withdraw_amount) GROUP BY statistics_day", "order_status=3（不是1）用finish_time"),
        ("充提差", "计算字段", "recharge-withdraw", "SUM(recharge_amount)-SUM(withdraw_amount)", "正=净流入 负=净流出"),
        ("总投注", "channel_game_statistics", "bet_amount", "SUM(bet_amount) GROUP BY statistics_day", "不用player_statistics_day（有差异）"),
        ("首充人数", "channel_data_statistics", "first_recharge_number", "SUM(first_recharge_number) GROUP BY statistics_day", "全历史首充 不用first_deposit_record"),
        ("充值人数", "channel_data_statistics", "recharge_number", "SUM(recharge_number) GROUP BY statistics_day", "当日有成功充值的独立玩家数"),
        ("人均充值", "计算字段", "充值/充值人数", "SUM(recharge_amount)/SUM(recharge_number)", "付费玩家平均充值深度"),
    ]
    for n in notes:
        W(list(n))
    W([])
    W(["[重要补充]"])
    W(["1. 数据来源: channel_data_statistics(8个指标) + channel_game_statistics(总投注)"])
    W(["2. 基准期: 2025-12-01~2026-01-30 共61天"])
    W(["3. 预期计算: 日均 x 天数 x 复利系数。2月x1.05 3月x1.1025 4月x1.1576"])
    W(["4. 提现成功状态是order_status=3（不是1） 时间用finish_time"])
    W(["5. 总投注必须用channel_game_statistics 不能用player_statistics_day"])
    W(["6. ip人数必须用channel_data_statistics.ip_number 不能从logininfor推算"])
    W(["7. 首充必须从player_recharge_order MIN(pay_date)推导 不能用first_deposit_record"])

    with open(str(OUTPUT), "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    print(f"Done: {OUTPUT}")

if __name__ == "__main__":
    main()
