#!/usr/bin/env python3
"""
Red 召回活動第一版分析
活動期：2/1-2/7（手動派彩）
召回名單：Sheet1 首充流失 5,236人 + Sheet2 活躍流失 2,289人
分析：活動期間存款 vs 1月環比 vs 前後對比
"""

# We'll generate SQL and run via query.py
# Since we can't use pymysql directly, output SQL for exec-bridge

queries = {
    "1_recall_sheet1_definition": """
-- Sheet1: 1月首充後流失（首充在1月 + 最後登錄 < 1/23）
-- 找出這些人在不同時段的存款行為
SELECT 
    '首充流失組(Sheet1)' as group_name,
    COUNT(DISTINCT p.player_id) as total_players,
    
    -- 活動前(1/25-1/31)
    SUM(CASE WHEN psd.statistics_day BETWEEN '2026-01-25' AND '2026-01-31' THEN psd.recharge_amount ELSE 0 END) as deposit_pre_activity,
    COUNT(DISTINCT CASE WHEN psd.statistics_day BETWEEN '2026-01-25' AND '2026-01-31' AND psd.recharge_amount > 0 THEN p.player_id END) as depositors_pre,
    
    -- 活動期(2/1-2/2, 目前可用數據)
    SUM(CASE WHEN psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' THEN psd.recharge_amount ELSE 0 END) as deposit_activity,
    COUNT(DISTINCT CASE WHEN psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd.recharge_amount > 0 THEN p.player_id END) as depositors_activity,
    
    -- 1月全月
    SUM(CASE WHEN psd.statistics_day BETWEEN '2026-01-01' AND '2026-01-31' THEN psd.recharge_amount ELSE 0 END) as deposit_jan_total,
    COUNT(DISTINCT CASE WHEN psd.statistics_day BETWEEN '2026-01-01' AND '2026-01-31' AND psd.recharge_amount > 0 THEN p.player_id END) as depositors_jan,
    
    -- 1月日均
    SUM(CASE WHEN psd.statistics_day BETWEEN '2026-01-01' AND '2026-01-31' THEN psd.recharge_amount ELSE 0 END) / 31 as deposit_jan_daily_avg,
    
    -- 登錄回流
    COUNT(DISTINCT CASE WHEN pl.login_time >= '2026-02-01' THEN p.player_id END) as returned_players
FROM sys_player p
INNER JOIN first_deposit_record fdr ON p.player_id = fdr.player_id
LEFT JOIN player_statistics_day psd ON p.player_id = psd.player_id 
    AND psd.statistics_day BETWEEN '2026-01-01' AND '2026-02-02'
LEFT JOIN player_logininfor pl ON p.player_id = pl.player_id 
    AND pl.login_time >= '2026-02-01'
WHERE fdr.create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59'
    AND p.last_login_time < '2026-01-23'
""",

    "2_recall_sheet2_definition": """
-- Sheet2: 近期活躍後流失（1/18-25投注>=1500 + 最後登錄 < 1/26）
SELECT 
    '活躍流失組(Sheet2)' as group_name,
    COUNT(DISTINCT sub.player_id) as total_players,
    
    SUM(CASE WHEN psd2.statistics_day BETWEEN '2026-01-25' AND '2026-01-31' THEN psd2.recharge_amount ELSE 0 END) as deposit_pre_activity,
    COUNT(DISTINCT CASE WHEN psd2.statistics_day BETWEEN '2026-01-25' AND '2026-01-31' AND psd2.recharge_amount > 0 THEN sub.player_id END) as depositors_pre,
    
    SUM(CASE WHEN psd2.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' THEN psd2.recharge_amount ELSE 0 END) as deposit_activity,
    COUNT(DISTINCT CASE WHEN psd2.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd2.recharge_amount > 0 THEN sub.player_id END) as depositors_activity,
    
    SUM(CASE WHEN psd2.statistics_day BETWEEN '2026-01-01' AND '2026-01-31' THEN psd2.recharge_amount ELSE 0 END) as deposit_jan_total,
    COUNT(DISTINCT CASE WHEN psd2.statistics_day BETWEEN '2026-01-01' AND '2026-01-31' AND psd2.recharge_amount > 0 THEN sub.player_id END) as depositors_jan,
    
    SUM(CASE WHEN psd2.statistics_day BETWEEN '2026-01-01' AND '2026-01-31' THEN psd2.recharge_amount ELSE 0 END) / 31 as deposit_jan_daily_avg,
    
    COUNT(DISTINCT CASE WHEN pl2.login_time >= '2026-02-01' THEN sub.player_id END) as returned_players
FROM (
    SELECT psd.player_id
    FROM player_statistics_day psd
    INNER JOIN sys_player sp ON psd.player_id = sp.player_id
    WHERE psd.statistics_day BETWEEN '2026-01-18' AND '2026-01-25'
    AND sp.last_login_time < '2026-01-26'
    GROUP BY psd.player_id
    HAVING SUM(psd.bet_amount) >= 1500
) sub
LEFT JOIN player_statistics_day psd2 ON sub.player_id = psd2.player_id 
    AND psd2.statistics_day BETWEEN '2026-01-01' AND '2026-02-02'
LEFT JOIN player_logininfor pl2 ON sub.player_id = pl2.player_id 
    AND pl2.login_time >= '2026-02-01'
""",

    "3_daily_trend": """
-- 每日存款趨勢（兩組合併）- 活動前7天 + 活動期
SELECT 
    psd.statistics_day,
    COUNT(DISTINCT CASE WHEN psd.recharge_amount > 0 THEN psd.player_id END) as depositors,
    SUM(psd.recharge_amount) as total_deposit,
    AVG(CASE WHEN psd.recharge_amount > 0 THEN psd.recharge_amount END) as avg_deposit_per_depositor,
    COUNT(DISTINCT CASE WHEN psd.bet_amount > 0 THEN psd.player_id END) as active_players
FROM player_statistics_day psd
WHERE psd.statistics_day BETWEEN '2026-01-25' AND '2026-02-02'
AND psd.player_id IN (
    -- Sheet1
    SELECT p.player_id FROM sys_player p
    INNER JOIN first_deposit_record fdr ON p.player_id = fdr.player_id
    WHERE fdr.create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59'
    AND p.last_login_time < '2026-01-23'
    UNION
    -- Sheet2
    SELECT psd2.player_id FROM player_statistics_day psd2
    INNER JOIN sys_player sp2 ON psd2.player_id = sp2.player_id
    WHERE psd2.statistics_day BETWEEN '2026-01-18' AND '2026-01-25'
    AND sp2.last_login_time < '2026-01-26'
    GROUP BY psd2.player_id
    HAVING SUM(psd2.bet_amount) >= 1500
)
GROUP BY psd.statistics_day
ORDER BY psd.statistics_day
"""
}

for name, sql in queries.items():
    print(f"\n{'='*60}")
    print(f"QUERY: {name}")
    print(f"{'='*60}")
    # Clean up for single line
    clean = ' '.join(sql.strip().split())
    print(clean)
