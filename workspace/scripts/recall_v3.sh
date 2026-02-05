#!/bin/bash
# Red 召回活動分析 - 用 query.py 分步執行
CD="cd /Users/sulaxd/clawd/skills/bg666-db"
Q="python3 scripts/query.py"
OUT="/Users/sulaxd/clawd/output/recall_analysis.txt"

echo "=== Red 召回活動第一版分析 ===" > $OUT
echo "分析時間: $(date)" >> $OUT
echo "" >> $OUT

# 1. Sheet1 + Sheet2 合併後，2/1-2/2 vs 1月 的行為對比
# 用 UNION 合併兩組，直接分析
echo "=== 1. 召回目標整體存款趨勢 (1/20-2/2) ===" >> $OUT
$CD && timeout 120 $Q "
SELECT psd.statistics_day as dt,
  COUNT(DISTINCT psd.player_id) as active,
  COUNT(DISTINCT CASE WHEN psd.recharge_amount > 0 THEN psd.player_id END) as depositors,
  ROUND(SUM(psd.recharge_amount)) as deposit,
  ROUND(SUM(psd.bet_amount)) as bet,
  ROUND(SUM(psd.withdraw_amount)) as withdraw
FROM player_statistics_day psd
INNER JOIN (
  SELECT DISTINCT fdr.player_id FROM first_deposit_record fdr
  LEFT JOIN (SELECT DISTINCT player_id FROM player_logininfor WHERE create_time >= '2026-01-23' AND create_time < '2026-01-30') l ON fdr.player_id = l.player_id
  WHERE fdr.create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59' AND l.player_id IS NULL
  UNION
  SELECT DISTINCT sub.player_id FROM (
    SELECT player_id FROM player_statistics_day WHERE statistics_day BETWEEN '2026-01-18' AND '2026-01-25' GROUP BY player_id HAVING SUM(bet_amount) >= 1500
  ) sub LEFT JOIN (SELECT DISTINCT player_id FROM player_logininfor WHERE create_time >= '2026-01-26' AND create_time < '2026-01-30') l2 ON sub.player_id = l2.player_id
  WHERE l2.player_id IS NULL
) recall ON psd.player_id = recall.player_id
WHERE psd.statistics_day BETWEEN '2026-01-20' AND '2026-02-02'
GROUP BY psd.statistics_day ORDER BY psd.statistics_day
" >> $OUT 2>&1

echo "" >> $OUT
echo "=== 2. Sheet1 首充流失組 (2/1-2/2 回流) ===" >> $OUT
$CD && timeout 120 $Q "
SELECT 
  COUNT(DISTINCT CASE WHEN psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd.recharge_amount > 0 THEN psd.player_id END) as feb_depositors,
  ROUND(SUM(CASE WHEN psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' THEN psd.recharge_amount ELSE 0 END)) as feb_deposit,
  COUNT(DISTINCT CASE WHEN psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd.bet_amount > 0 THEN psd.player_id END) as feb_active,
  COUNT(DISTINCT CASE WHEN psd.statistics_day BETWEEN '2026-01-01' AND '2026-01-22' AND psd.recharge_amount > 0 THEN psd.player_id END) as jan_depositors,
  ROUND(SUM(CASE WHEN psd.statistics_day BETWEEN '2026-01-01' AND '2026-01-22' THEN psd.recharge_amount ELSE 0 END)) as jan_deposit
FROM first_deposit_record fdr
LEFT JOIN (SELECT DISTINCT player_id FROM player_logininfor WHERE create_time >= '2026-01-23' AND create_time < '2026-01-30') l ON fdr.player_id = l.player_id
LEFT JOIN player_statistics_day psd ON fdr.player_id = psd.player_id AND psd.statistics_day BETWEEN '2026-01-01' AND '2026-02-02'
WHERE fdr.create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59' AND l.player_id IS NULL
" >> $OUT 2>&1

echo "" >> $OUT
echo "=== 3. Sheet2 活躍流失組 (2/1-2/2 回流) ===" >> $OUT
$CD && timeout 120 $Q "
SELECT 
  COUNT(DISTINCT CASE WHEN psd2.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd2.recharge_amount > 0 THEN sub.player_id END) as feb_depositors,
  ROUND(SUM(CASE WHEN psd2.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' THEN psd2.recharge_amount ELSE 0 END)) as feb_deposit,
  COUNT(DISTINCT CASE WHEN psd2.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd2.bet_amount > 0 THEN sub.player_id END) as feb_active,
  COUNT(DISTINCT CASE WHEN psd2.statistics_day BETWEEN '2026-01-18' AND '2026-01-25' AND psd2.recharge_amount > 0 THEN sub.player_id END) as jan_depositors,
  ROUND(SUM(CASE WHEN psd2.statistics_day BETWEEN '2026-01-18' AND '2026-01-25' THEN psd2.recharge_amount ELSE 0 END)) as jan_deposit
FROM (
  SELECT player_id FROM player_statistics_day WHERE statistics_day BETWEEN '2026-01-18' AND '2026-01-25' GROUP BY player_id HAVING SUM(bet_amount) >= 1500
) sub
LEFT JOIN (SELECT DISTINCT player_id FROM player_logininfor WHERE create_time >= '2026-01-26' AND create_time < '2026-01-30') l2 ON sub.player_id = l2.player_id
LEFT JOIN player_statistics_day psd2 ON sub.player_id = psd2.player_id AND psd2.statistics_day BETWEEN '2026-01-01' AND '2026-02-02'
WHERE l2.player_id IS NULL
" >> $OUT 2>&1

echo "" >> $OUT
echo "=== 4. 回流玩家 TOP20 (2/1後有存款) ===" >> $OUT
$CD && timeout 120 $Q "
SELECT psd.player_id, ROUND(SUM(psd.recharge_amount)) as feb_deposit, ROUND(SUM(psd.bet_amount)) as feb_bet
FROM player_statistics_day psd
INNER JOIN (
  SELECT DISTINCT fdr.player_id FROM first_deposit_record fdr
  LEFT JOIN (SELECT DISTINCT player_id FROM player_logininfor WHERE create_time >= '2026-01-23' AND create_time < '2026-01-30') l ON fdr.player_id = l.player_id
  WHERE fdr.create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59' AND l.player_id IS NULL
  UNION
  SELECT DISTINCT sub.player_id FROM (
    SELECT player_id FROM player_statistics_day WHERE statistics_day BETWEEN '2026-01-18' AND '2026-01-25' GROUP BY player_id HAVING SUM(bet_amount) >= 1500
  ) sub LEFT JOIN (SELECT DISTINCT player_id FROM player_logininfor WHERE create_time >= '2026-01-26' AND create_time < '2026-01-30') l2 ON sub.player_id = l2.player_id
  WHERE l2.player_id IS NULL
) recall ON psd.player_id = recall.player_id
WHERE psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02' AND psd.recharge_amount > 0
GROUP BY psd.player_id ORDER BY feb_deposit DESC LIMIT 20
" >> $OUT 2>&1

echo "" >> $OUT
echo "=== 分析完成 ===" >> $OUT
cat $OUT
