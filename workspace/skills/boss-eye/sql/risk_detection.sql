-- 老領班風控偵測 SQL 查詢集
-- 專抓打水、腳本、通道漏水

-- ============================================
-- 1. 極速重複注單偵測（腳本特徵）
-- 同一秒內下注多筆，極大概率是腳本
-- ============================================
SELECT 
    user_id, 
    COUNT(*) as flash_bets,
    GROUP_CONCAT(amount ORDER BY bet_time) as amounts,
    DATE_FORMAT(MAX(bet_time), '%Y-%m-%d %H:%i:%s') as last_bet_time,
    UNIX_TIMESTAMP(bet_time) as timestamp_second
FROM bet_logs 
WHERE bet_time > NOW() - INTERVAL 10 MINUTE
GROUP BY user_id, UNIX_TIMESTAMP(bet_time)
HAVING flash_bets > 2  -- 同一秒內超過2筆
ORDER BY flash_bets DESC, last_bet_time DESC
LIMIT 20;

-- ============================================
-- 2. 整數大額下注模式（打水特徵）
-- 打水團隊為了算水方便，常下注 5000, 10000 等整數
-- ============================================
SELECT 
    user_id, 
    COUNT(*) as pattern_count,
    SUM(amount) as total_volume,
    AVG(amount) as avg_amount,
    MIN(bet_time) as first_bet_time,
    MAX(bet_time) as last_bet_time,
    GROUP_CONCAT(DISTINCT amount ORDER BY amount) as amount_patterns,
    COUNT(DISTINCT amount) as unique_amounts
FROM bet_logs 
WHERE amount IN (1000, 2000, 5000, 10000, 20000, 50000)
    AND bet_time > NOW() - INTERVAL 1 HOUR
GROUP BY user_id 
HAVING pattern_count > 4  -- 1小時內超過4筆整數下注
    AND unique_amounts <= 3  -- 使用不超過3種不同金額（模式化）
ORDER BY pattern_count DESC, total_volume DESC
LIMIT 20;

-- ============================================
-- 3. 異常下注頻率（機器人特徵）
-- 人類無法達到的下注頻率
-- ============================================
SELECT 
    user_id,
    COUNT(*) as bets_last_hour,
    COUNT(*) / 60 as bets_per_minute,
    MIN(bet_time) as first_bet,
    MAX(bet_time) as last_bet,
    TIMESTAMPDIFF(SECOND, MIN(bet_time), MAX(bet_time)) as time_span_seconds,
    CASE 
        WHEN TIMESTAMPDIFF(SECOND, MIN(bet_time), MAX(bet_time)) > 0 
        THEN COUNT(*) / TIMESTAMPDIFF(SECOND, MIN(bet_time), MAX(bet_time))
        ELSE 0 
    END as bets_per_second
FROM bet_logs 
WHERE bet_time > NOW() - INTERVAL 1 HOUR
GROUP BY user_id
HAVING bets_last_hour > 60  -- 1小時內超過60筆
    AND bets_per_second > 0.1  -- 平均每秒超過0.1筆
ORDER BY bets_per_second DESC, bets_last_hour DESC
LIMIT 20;

-- ============================================
-- 4. 充值通道漏水分析
-- Matomo 點擊 vs 實際入帳對比
-- ============================================
-- 今日充值統計
SELECT 
    DATE(create_time) as deposit_date,
    COUNT(*) as total_orders,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as success_amount,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_orders,
    SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed_amount,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_orders,
    ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM player_recharge_order 
WHERE DATE(create_time) >= CURDATE() - INTERVAL 7 DAY
GROUP BY DATE(create_time)
ORDER BY deposit_date DESC;

-- 充值渠道分析
SELECT 
    channel,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as success_amount,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_orders,
    ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate,
    AVG(CASE WHEN status = 'success' THEN amount ELSE NULL END) as avg_success_amount
FROM player_recharge_order 
WHERE DATE(create_time) = CURDATE()
    AND channel IS NOT NULL
    AND channel != ''
GROUP BY channel
HAVING total_orders >= 5
ORDER BY success_rate ASC, total_orders DESC;

-- ============================================
-- 5. VIP 玩家異常行為
-- 高價值玩家的風險行為
-- ============================================
SELECT 
    p.user_id,
    p.vip_level,
    p.total_deposit,
    p.total_bet_amount,
    COUNT(b.bet_id) as today_bets,
    SUM(b.amount) as today_bet_amount,
    MIN(b.bet_time) as first_bet_today,
    MAX(b.bet_time) as last_bet_today,
    CASE 
        WHEN COUNT(b.bet_id) > 0 
        THEN TIMESTAMPDIFF(SECOND, MIN(b.bet_time), MAX(b.bet_time)) / COUNT(b.bet_id)
        ELSE NULL 
    END as avg_seconds_per_bet
FROM sys_player p
LEFT JOIN bet_logs b ON p.user_id = b.user_id 
    AND DATE(b.bet_time) = CURDATE()
WHERE p.vip_level >= 3  -- VIP3 以上
    AND p.status = 'active'
    AND p.total_deposit > 10000  -- 總充值超過1萬
GROUP BY p.user_id, p.vip_level, p.total_deposit, p.total_bet_amount
HAVING today_bets > 50  -- 今日下注超過50筆
    AND avg_seconds_per_bet < 10  -- 平均每注間隔小於10秒
ORDER BY today_bets DESC, avg_seconds_per_bet ASC
LIMIT 20;

-- ============================================
-- 6. 今日關鍵指標儀表板
-- ============================================
SELECT 
    -- 注單統計
    (SELECT COUNT(*) FROM bet_logs WHERE DATE(bet_time) = CURDATE()) as total_bets_today,
    (SELECT SUM(amount) FROM bet_logs WHERE DATE(bet_time) = CURDATE()) as total_bet_amount_today,
    (SELECT COUNT(DISTINCT user_id) FROM bet_logs WHERE DATE(bet_time) = CURDATE()) as active_users_today,
    
    -- 充值統計
    (SELECT COUNT(*) FROM player_recharge_order WHERE DATE(create_time) = CURDATE() AND status = 'success') as success_deposits_today,
    (SELECT SUM(amount) FROM player_recharge_order WHERE DATE(create_time) = CURDATE() AND status = 'success') as success_deposit_amount_today,
    (SELECT COUNT(DISTINCT user_id) FROM player_recharge_order WHERE DATE(create_time) = CURDATE() AND status = 'success') as deposit_users_today,
    
    -- 風控指標
    (SELECT COUNT(DISTINCT user_id) FROM (
        SELECT user_id, UNIX_TIMESTAMP(bet_time) as ts_second
        FROM bet_logs 
        WHERE bet_time > NOW() - INTERVAL 10 MINUTE
        GROUP BY user_id, UNIX_TIMESTAMP(bet_time)
        HAVING COUNT(*) > 2
    ) as flash_users) as flash_users_count,
    
    (SELECT COUNT(DISTINCT user_id) FROM (
        SELECT user_id
        FROM bet_logs 
        WHERE amount IN (1000, 2000, 5000, 10000, 20000, 50000)
            AND bet_time > NOW() - INTERVAL 1 HOUR
        GROUP BY user_id 
        HAVING COUNT(*) > 4
    ) as pattern_users) as pattern_users_count,
    
    -- 時間指標
    NOW() as current_time,
    CURDATE() as today_date;

-- ============================================
-- 7. 歷史風險玩家追蹤
-- ============================================
CREATE TABLE IF NOT EXISTS risk_player_history (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    risk_type ENUM('flash_bet', 'amount_pattern', 'frequency', 'other') NOT NULL,
    risk_score INT DEFAULT 0,
    detection_time DATETIME NOT NULL,
    details JSON,
    action_taken ENUM('none', 'warned', 'limited', 'banned') DEFAULT 'none',
    action_time DATETIME,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_time DATETIME,
    notes TEXT,
    INDEX idx_user_id (user_id),
    INDEX idx_detection_time (detection_time),
    INDEX idx_risk_type (risk_type),
    INDEX idx_resolved (resolved)
);

-- 插入風險玩家記錄
INSERT INTO risk_player_history (
    user_id, risk_type, risk_score, detection_time, details, action_taken
) VALUES (
    :user_id, :risk_type, :risk_score, NOW(), :details, 'none'
);

-- 查詢未解決的風險玩家
SELECT 
    r.user_id,
    p.username,
    p.vip_level,
    p.total_deposit,
    COUNT(r.record_id) as risk_count,
    GROUP_CONCAT(DISTINCT r.risk_type) as risk_types,
    MAX(r.detection_time) as latest_detection,
    MAX(r.risk_score) as max_risk_score
FROM risk_player_history r
LEFT JOIN sys_player p ON r.user_id = p.user_id
WHERE r.resolved = FALSE
    AND r.detection_time > NOW() - INTERVAL 7 DAY
GROUP BY r.user_id, p.username, p.vip_level, p.total_deposit
HAVING risk_count >= 2  -- 7天內被偵測到2次以上
ORDER BY max_risk_score DESC, risk_count DESC
LIMIT 50;