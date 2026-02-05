#!/usr/bin/env python3
"""BG666 2-4月 周预期进度表 v3 — xlsxwriter version for Excel compatibility"""
import xlsxwriter
from pathlib import Path
from datetime import date, timedelta
import calendar

OUTPUT = Path(__file__).parent.parent.parent.parent / "output" / "bg666_2026_feb_target_v3.xlsx"

BASE_DAYS = 61
BASE = {
    "注册人数":   {"total": 63293,      "daily": 1037.59},
    "活跃人数":   {"total": 2458053,    "daily": 40295.95},
    "ip人数":     {"total": 3096137,    "daily": 50756.34},
    "充值":       {"total": 249050189,  "daily": 4082789.98},
    "提现":       {"total": 216238980,  "daily": 3544901.31},
    "充提差":     {"total": 32811209,   "daily": 537888.67},
    "总投注":     {"total": 2069769048.72, "daily": 33930640.14},
    "首充人数":   {"total": 34049,      "daily": 558.18},
    "充值人数":   {"total": 392084,     "daily": 6427.61},
    "人均充值":   {"total": None,       "daily": 635.13},
}
GROWTH = {"2月": 0.05, "3月": 0.05, "4月": 0.05}
metrics_order = list(BASE.keys())

sources = {
    "注册人数": "register_number",
    "活跃人数": "active_number",
    "ip人数": "ip_number",
    "充值": "recharge_amount",
    "提现": "withdraw_amount",
    "充提差": "recharge - withdraw",
    "总投注": "bet_amount (game表)",
    "首充人数": "first_recharge_number",
    "充值人数": "recharge_number",
    "人均充值": "充值 / 充值人数",
}

notes = {
    "注册人数": "当日新注册玩家数。来源：channel_data_statistics.register_number，按 statistics_day 汇总所有渠道。",
    "活跃人数": "当日至少登录一次的独立玩家数。来源：channel_data_statistics.active_number。",
    "ip人数": "当日独立 IP 数（含登录+注册 IP）。来源：channel_data_statistics.ip_number。",
    "充值": "当日所有成功充值订单的总金额。来源：channel_data_statistics.recharge_amount。等价于 player_recharge_order WHERE order_status=1 的 SUM(pay_amount)。",
    "提现": "当日所有成功提现订单的总金额。来源：channel_data_statistics.withdraw_amount。等价于 player_withdraw_order WHERE order_status=3 的 SUM(withdraw_amount)，按 finish_time 分日。",
    "充提差": "充值 - 提现。正数=平台净流入，负数=净流出。核心盈利健康指标。",
    "总投注": "当日所有游戏总投注。来源：channel_game_statistics.bet_amount。不要用 player_statistics_day（有差异）。",
    "首充人数": "当日首次充值的玩家数（全历史首充）。来源：channel_data_statistics.first_recharge_number。",
    "充值人数": "当日有成功充值的独立玩家数。来源：channel_data_statistics.recharge_number。",
    "人均充值": "充值 / 充值人数。反映付费玩家的平均充值深度。",
}

target_notes = {
    "预期注册": "= 注册人数日均 x 天数 x (1+增长率)。口径：channel_data_statistics.register_number",
    "预期充值": "= 充值日均 x 天数 x (1+增长率)。口径：channel_data_statistics.recharge_amount（order_status=1 成功订单）",
    "预期投注": "= 总投注日均 x 天数 x (1+增长率)。口径：channel_game_statistics.bet_amount（不用player_statistics_day）",
    "预期首充": "= 首充人数日均 x 天数 x (1+增长率)。口径：channel_data_statistics.first_recharge_number（全历史首充）",
    "预期充值人数": "= 充值人数日均 x 天数 x (1+增长率)。口径：channel_data_statistics.recharge_number（当日有成功充值的独立玩家数）",
}

def get_weekly_sundays(year, month):
    days_in = calendar.monthrange(year, month)[1]
    first = date(year, month, 1)
    last = date(year, month, days_in)
    sundays = []
    d = first
    while d <= last:
        if d.weekday() == 6:
            sundays.append(d)
        d += timedelta(days=1)
    if last not in sundays:
        sundays.append(last)
    return sorted(sundays)

def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    wb = xlsxwriter.Workbook(str(OUTPUT))

    # Formats
    title_fmt = wb.add_format({'bold': True, 'font_size': 14})
    sub_fmt = wb.add_format({'bold': True, 'font_size': 11, 'font_color': '#666666'})
    hdr_fmt = wb.add_format({'bold': True, 'font_size': 11, 'bg_color': '#D6EAF8', 'border': 1})
    bold_fmt = wb.add_format({'bold': True})
    money_fmt = wb.add_format({'num_format': '#,##0', 'border': 1})
    money2_fmt = wb.add_format({'num_format': '#,##0.00', 'border': 1})
    pct_fmt = wb.add_format({'num_format': '0.0%', 'border': 1})
    cell_fmt = wb.add_format({'border': 1})
    red_fmt = wb.add_format({'bold': True, 'font_color': 'red'})

    # ===== 总览 =====
    ws = wb.add_worksheet("总览")
    ws.set_column('A:A', 18)
    ws.set_column('B:B', 18)
    ws.set_column('C:C', 14)
    ws.set_column('D:D', 22)
    ws.set_column('E:E', 60)
    ws.set_column('F:H', 16)

    ws.write('A1', 'BG666 2026 2-4月 周预期进度表', title_fmt)
    ws.write('A2', '基于 DB 实际数据推算（channel_data_statistics + channel_game_statistics）', sub_fmt)
    ws.write('A3', f'基准期：2025-12-01 ~ 2026-01-30（{BASE_DAYS}天）')
    ws.write('A4', '口径：自然日 | 周结算：周日 | 全部指标已与 Excel 对齐')

    r = 5
    ws.write(r, 0, '基准日均指标', bold_fmt)
    r += 1
    for i, h in enumerate(['指标', '61天总量', '日均', 'DB 字段', '口径说明']):
        ws.write(r, i, h, hdr_fmt)
    r += 1
    for name, data in BASE.items():
        ws.write(r, 0, name, cell_fmt)
        if data['total'] is not None:
            ws.write(r, 1, round(data['total']), money_fmt)
        else:
            ws.write(r, 1, '', cell_fmt)
        ws.write(r, 2, round(data['daily'], 2), money2_fmt)
        ws.write(r, 3, sources.get(name, ''), cell_fmt)
        ws.write(r, 4, notes.get(name, ''), cell_fmt)
        r += 1

    r += 1
    ws.write(r, 0, '增长假设', bold_fmt)
    r += 1
    for m, g in GROWTH.items():
        ws.write(r, 0, m)
        ws.write(r, 1, f'{g*100:.0f}%')
        r += 1

    r += 1
    ws.write(r, 0, '月度预期总览（日均 x 天数 x (1+增长)）', bold_fmt)
    r += 1
    mheaders = ['月份', '天数', '增长', '预期注册', '预期充值', '预期投注', '预期首充', '预期充值人数']
    for i, h in enumerate(mheaders):
        ws.write(r, i, h, hdr_fmt)
    r += 1

    months_info = [('2026-02', 2, 28), ('2026-03', 3, 31), ('2026-04', 4, 30)]
    for label, month, days in months_info:
        mname = f'{month}月'
        g = GROWTH[mname]
        ws.write(r, 0, label, cell_fmt)
        ws.write(r, 1, days, cell_fmt)
        ws.write(r, 2, f'{g*100:.0f}%', cell_fmt)
        ws.write(r, 3, round(BASE['注册人数']['daily'] * days * (1+g)), money_fmt)
        ws.write(r, 4, round(BASE['充值']['daily'] * days * (1+g)), money_fmt)
        ws.write(r, 5, round(BASE['总投注']['daily'] * days * (1+g)), money_fmt)
        ws.write(r, 6, round(BASE['首充人数']['daily'] * days * (1+g)), money_fmt)
        ws.write(r, 7, round(BASE['充值人数']['daily'] * days * (1+g)), money_fmt)
        r += 1

    r += 1
    ws.write(r, 0, '预期指标口径说明', bold_fmt)
    r += 1
    for name, note in target_notes.items():
        ws.write(r, 0, name, bold_fmt)
        ws.write(r, 1, note)
        r += 1
    r += 1
    ws.write(r, 0, '公式', bold_fmt)
    ws.write(r, 1, '预期值 = 基准日均 x 当月天数 x (1+月增长率)。基准日均来自 12/1~1/30 共 61 天 DB 实际数据。')

    # ===== Monthly sheets =====
    for label, month, days in months_info:
        mname = f'{month}月'
        g = GROWTH[mname]
        ws2 = wb.add_worksheet(mname)
        ws2.set_column('A:A', 16)
        ws2.set_column('B:C', 10)
        for i in range(len(metrics_order)):
            ws2.set_column(3+i, 3+i, 16)

        ws2.write('A1', f'2026 {mname} 周预期进度（周日结算）', title_fmt)
        ws2.write('A2', f'增长假设: {g*100:.0f}% | 基准: 12月+1月日均 x (1+{g*100:.0f}%)', sub_fmt)

        cols = ['周结算日', '累计天数', '时间进度'] + metrics_order
        for i, h in enumerate(cols):
            ws2.write(3, i, h, hdr_fmt)

        sundays = get_weekly_sundays(2026, month)
        first_day = date(2026, month, 1)

        for j, sunday in enumerate(sundays):
            row = 4 + j
            cum_days = (sunday - first_day).days + 1
            time_pct = cum_days / days
            ws2.write(row, 0, sunday.strftime('%Y-%m-%d'), cell_fmt)
            ws2.write(row, 1, cum_days, cell_fmt)
            ws2.write(row, 2, time_pct, pct_fmt)

            for k, metric in enumerate(metrics_order):
                daily = BASE[metric]['daily']
                if metric == '人均充值':
                    val = round(daily * (1+g), 2)
                    ws2.write(row, 3+k, val, money2_fmt)
                elif metric == '充提差':
                    val = round(BASE['充值']['daily'] * cum_days * (1+g) - BASE['提现']['daily'] * cum_days * (1+g))
                    ws2.write(row, 3+k, val, money_fmt)
                else:
                    val = round(daily * cum_days * (1+g))
                    ws2.write(row, 3+k, val, money_fmt)

        tr = 4 + len(sundays) + 1
        ws2.write(tr, 0, '月度总目标', bold_fmt)
        for k, metric in enumerate(metrics_order):
            daily = BASE[metric]['daily']
            if metric == '人均充值':
                val = round(daily * (1+g), 2)
                ws2.write(tr, 3+k, val, money2_fmt)
            elif metric == '充提差':
                val = round(BASE['充值']['daily'] * days * (1+g) - BASE['提现']['daily'] * days * (1+g))
                ws2.write(tr, 3+k, val, money_fmt)
            else:
                val = round(daily * days * (1+g))
                ws2.write(tr, 3+k, val, money_fmt)

        ws2.write(tr+1, 0, '实际累计', red_fmt)
        ws2.write(tr+2, 0, '差异', red_fmt)

    # ===== 口径说明 =====
    ws3 = wb.add_worksheet('口径说明')
    ws3.set_column('A:A', 14)
    ws3.set_column('B:B', 28)
    ws3.set_column('C:C', 26)
    ws3.set_column('D:D', 50)
    ws3.set_column('E:E', 80)

    ws3.write('A1', 'BG666 报表口径说明（2026-01-31 对齐确认）', title_fmt)
    ws3.write('A2', '所有指标已与后台 Excel 报表逐日对齐验证（12/27-1/3，8天全部OK）', sub_fmt)

    for i, h in enumerate(['指标', 'DB 来源表', 'DB 字段', 'SQL 口径', '备注']):
        ws3.write(3, i, h, hdr_fmt)

    note_rows = [
        ('注册人数', 'channel_data_statistics', 'register_number',
         'SUM(register_number) GROUP BY statistics_day',
         '当日新注册玩家数，汇总所有渠道。与 sys_player COUNT(create_time) 一致。'),
        ('活跃人数', 'channel_data_statistics', 'active_number',
         'SUM(active_number) GROUP BY statistics_day',
         '当日至少登录一次的独立玩家数。与 player_logininfor COUNT(DISTINCT player_id) 一致。'),
        ('ip人数', 'channel_data_statistics', 'ip_number',
         'SUM(ip_number) GROUP BY statistics_day',
         '当日独立IP数。不能从 player_logininfor DISTINCT ipaddr 得到（偏小约3600）。'),
        ('充值', 'channel_data_statistics', 'recharge_amount',
         'SUM(recharge_amount) GROUP BY statistics_day',
         '当日成功充值订单总金额。与 player_recharge_order WHERE order_status=1 的 SUM(pay_amount) 一致。'),
        ('提现', 'channel_data_statistics', 'withdraw_amount',
         'SUM(withdraw_amount) GROUP BY statistics_day',
         '当日成功提现总金额。order_status=3（不是1），时间用 finish_time。'),
        ('充提差', '计算字段', 'recharge - withdraw',
         'SUM(recharge_amount) - SUM(withdraw_amount)',
         '充值减提现。正=净流入，负=净流出。'),
        ('总投注', 'channel_game_statistics', 'bet_amount',
         'SUM(bet_amount) GROUP BY statistics_day',
         '不要用 player_statistics_day（有差异如12/27差10K）。以本表为准。'),
        ('首充人数', 'channel_data_statistics', 'first_recharge_number',
         'SUM(first_recharge_number) GROUP BY statistics_day',
         '全历史首充。不要用 first_deposit_record 表（二级数据不准）。'),
        ('充值人数', 'channel_data_statistics', 'recharge_number',
         'SUM(recharge_number) GROUP BY statistics_day',
         '当日有成功充值的独立玩家数。'),
        ('人均充值', '计算字段', '充值 / 充值人数',
         'SUM(recharge_amount) / SUM(recharge_number)',
         '付费玩家平均充值深度。'),
    ]
    for j, row in enumerate(note_rows):
        for i, val in enumerate(row):
            ws3.write(4+j, i, val, cell_fmt)

    r = 4 + len(note_rows) + 1
    ws3.write(r, 0, '重要补充', bold_fmt)
    r += 1
    supplements = [
        '1. 数据来源：channel_data_statistics（8个指标）+ channel_game_statistics（总投注）= 两张表覆盖全部 9 个指标。',
        '2. 基准期：2025-12-01 ~ 2026-01-30，共 61 天。',
        '3. 预期计算：日均 x 天数 x (1 + 增长率)。增长率统一 5%。',
        '4. 周结算日：每周日 + 月末（如果月末不是周日则额外加入）。',
        '5. 提现口径：order_status=3 表示成功（不是 1），时间用 finish_time（不是 apply_time）。',
        '6. 总投注必须用 channel_game_statistics，不能用 player_statistics_day。',
        '7. ip人数必须用 channel_data_statistics.ip_number，不能从 logininfor 推算。',
        '8. 首充必须从 player_recharge_order MIN(pay_date) 推导，不能用 first_deposit_record 表。',
    ]
    for s in supplements:
        ws3.write(r, 0, s)
        r += 1

    wb.close()
    print(f'Done: {OUTPUT}')

if __name__ == '__main__':
    main()
