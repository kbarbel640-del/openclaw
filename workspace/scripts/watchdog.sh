#!/bin/bash
# Clawdbot 完整健康監控系統 (Comprehensive Health Monitor)
# 作者：杜甫 + Agent 007
# 日期：2026-01-28
# 功能：Gateway 監控、配置驗證、錯誤檢測、資源監控、Telegram 通知

LOG_FILE="/tmp/clawdbot/clawdbot-$(date +%Y-%m-%d).log"
WATCHDOG_LOG="$HOME/clawd/logs/watchdog.log"
TELEGRAM_BOT_TOKEN="8415477831:AAFeyWZS8iAPqrQxYG_e3CxDWR2IrgIxw68"
TELEGRAM_CHAT_ID="-5266835049"  # 🔍 Clawdbot Log 群組

# 確保 log 目錄存在
mkdir -p "$(dirname "$WATCHDOG_LOG")"

# 寫入 log 的函數
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$WATCHDOG_LOG"
}

# 發送 Telegram 通知
send_telegram() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="${message}" \
        -d parse_mode="Markdown" > /dev/null 2>&1
}

# ========== 健康檢查指標 ==========

# 檢查 Node.js 程序數量
check_node_processes() {
    local node_count=$(pgrep -f "node.*clawdbot" | wc -l | tr -d ' ')
    log "🔍 Node.js 程序數：$node_count"
    
    if [ "$node_count" -gt 5 ]; then
        log "⚠️  Node.js 程序數過多 ($node_count)，可能有殘留程序"
        send_telegram "⚠️ *Watchdog 警告*\nNode.js 程序數異常：$node_count 個"
        return 1
    fi
    return 0
}

# 檢查磁碟空間
check_disk_space() {
    local usage=$(df -h ~ | awk 'NR==2 {print $5}' | sed 's/%//')
    log "💾 磁碟使用率：${usage}%"
    
    if [ "$usage" -gt 90 ]; then
        log "⚠️  磁碟空間不足 (${usage}%)"
        send_telegram "⚠️ *Watchdog 警告*\n磁碟空間不足：${usage}% 已使用"
        return 1
    fi
    return 0
}

# 檢查 log 檔案大小
check_log_size() {
    if [ -f "$LOG_FILE" ]; then
        local size=$(du -m "$LOG_FILE" | awk '{print $1}')
        log "📄 Log 檔案大小：${size}MB"
        
        if [ "$size" -gt 100 ]; then
            log "⚠️  Log 檔案過大 (${size}MB)，建議清理"
            send_telegram "⚠️ *Watchdog 警告*\nLog 檔案過大：${size}MB"
            return 1
        fi
    fi
    return 0
}

# 檢查 Gateway 端口是否被佔用
check_port_listening() {
    if lsof -i :18789 -sTCP:LISTEN -t > /dev/null 2>&1; then
        local pid=$(lsof -i :18789 -sTCP:LISTEN -t)
        log "✅ 端口 18789 正在監聽 (PID: $pid)"
        return 0
    else
        log "❌ 端口 18789 未監聽"
        return 1
    fi
}

# 檢查關鍵檔案是否存在
check_critical_files() {
    local missing_files=()
    local critical_files=(
        "$HOME/clawd/AGENTS.md"
        "$HOME/clawd/IDENTITY.md"
        "$HOME/clawd/USER.md"
        "$HOME/.clawdbot/clawdbot.json"
    )
    
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log "⚠️  關鍵檔案遺失：${missing_files[*]}"
        send_telegram "⚠️ *Watchdog 警告*\n關鍵檔案遺失：${missing_files[*]}"
        return 1
    fi
    
    log "✅ 所有關鍵檔案存在"
    return 0
}

# 檢查 Telegram 連接
check_telegram_connectivity() {
    if curl -s -o /dev/null -w "%{http_code}" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | grep -q "200"; then
        log "✅ Telegram 連接正常"
        return 0
    else
        log "❌ Telegram 連接失敗"
        return 1
    fi
}

# 檢查最近的崩潰
check_recent_crashes() {
    if [ -f "$LOG_FILE" ]; then
        local crash_count=$(grep -c "Error\|Exception\|Fatal" "$LOG_FILE" 2>/dev/null || echo "0")
        log "🐞 今日錯誤數：$crash_count"
        
        if [ "$crash_count" -gt 50 ]; then
            log "⚠️  錯誤數過高 ($crash_count)"
            send_telegram "⚠️ *Watchdog 警告*\n今日錯誤數異常：$crash_count"
            return 1
        fi
    fi
    return 0
}

# 統計報告
generate_health_report() {
    local status_emoji="✅"
    local status_text="健康"
    
    if ! check_gateway_running; then
        status_emoji="❌"
        status_text="異常"
    fi
    
    local node_count=$(pgrep -f "node.*clawdbot" | wc -l | tr -d ' ')
    local disk_usage=$(df -h ~ | awk 'NR==2 {print $5}')
    local uptime=$(uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')
    
    log "========== 健康報告 =========="
    log "$status_emoji 系統狀態：$status_text"
    log "🔍 Node 程序：$node_count"
    log "💾 磁碟使用：$disk_usage"
    log "⏱️  系統運行：$uptime"
    log "================================="
}

# 檢查 gateway 是否運行
check_gateway_running() {
    clawdbot gateway status 2>&1 | grep -q "Runtime: running"
    return $?
}

# 檢查 gateway 是否已安裝
check_gateway_installed() {
    clawdbot gateway status 2>&1 | grep -q "LaunchAgent (loaded)\|Runtime: running"
    return $?
}

# 檢查最近 5 分鐘內是否有 EBADF 錯誤
check_ebadf_errors() {
    if [ ! -f "$LOG_FILE" ]; then
        return 1
    fi
    
    # 計算 5 分鐘前的時間戳
    five_min_ago=$(date -v-5M '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d '5 minutes ago' '+%Y-%m-%d %H:%M:%S')
    
    # 檢查最近的 EBADF 錯誤
    recent_errors=$(tail -500 "$LOG_FILE" | grep -c "spawn EBADF" 2>/dev/null || echo "0")
    
    [ "$recent_errors" -gt 0 ]
}

# 檢查並修復配置檔中的無效 name 欄位
fix_invalid_config() {
    local config_file="$HOME/.clawdbot/clawdbot.json"
    
    # 檢查是否有 Unrecognized key: "name" 錯誤
    if clawdbot gateway status 2>&1 | grep -q 'Unrecognized key: "name"'; then
        log "⚠️  檢測到配置檔中有無效的 name 欄位，正在清理..."
        
        # 備份配置檔
        cp "$config_file" "${config_file}.backup-$(date +%Y%m%d-%H%M%S)"
        
        # 移除所有 telegram groups 中的 name 欄位
        jq 'walk(if type == "object" and has("requireMention") then del(.name) else . end)' "$config_file" > "${config_file}.tmp"
        mv "${config_file}.tmp" "$config_file"
        
        log "✅ 配置檔已清理"
        return 0
    fi
    return 1
}

# 主要邏輯
main() {
    log "========== Watchdog 巡檢開始 =========="
    
    # 0. 檢查 gateway 是否已安裝
    if ! check_gateway_installed; then
        log "⚠️  Gateway 未安裝，嘗試安裝..."
        send_telegram "🚨 *Clawdbot Watchdog*\nGateway 未安裝，正在安裝..."
        
        clawdbot gateway install >> "$WATCHDOG_LOG" 2>&1
        sleep 3
        
        if check_gateway_running; then
            log "✅ Gateway 安裝並啟動成功"
            send_telegram "✅ Gateway 已成功安裝並啟動"
        else
            log "❌ Gateway 安裝失敗"
            send_telegram "❌ *嚴重錯誤*\nGateway 安裝失敗，需要人工介入"
        fi
        return
    fi
    
    # 1. 檢查 gateway 是否運行
    if ! check_gateway_running; then
        log "⚠️  Gateway 未運行，嘗試啟動..."
        send_telegram "🚨 *Clawdbot Watchdog*\nGateway 未運行，正在啟動..."
        
        clawdbot gateway start >> "$WATCHDOG_LOG" 2>&1
        sleep 3
        
        if check_gateway_running; then
            log "✅ Gateway 啟動成功"
            send_telegram "✅ Gateway 已成功啟動"
        else
            log "❌ Gateway 啟動失敗"
            send_telegram "❌ *嚴重錯誤*\nGateway 啟動失敗，需要人工介入"
        fi
        return
    fi
    
    # 2. 檢查並修復配置檔問題
    if fix_invalid_config; then
        log "⚠️  配置檔已修復，重啟 Gateway..."
        clawdbot gateway restart >> "$WATCHDOG_LOG" 2>&1
        sleep 3
        
        if check_gateway_running; then
            log "✅ Gateway 重啟成功"
            send_telegram "✅ *Clawdbot Watchdog*\n配置檔問題已修復，Gateway 運行正常"
        fi
        return
    fi
    
    # 3. 檢查 EBADF 錯誤
    if check_ebadf_errors; then
        log "⚠️  檢測到 EBADF 錯誤，執行 launchctl kickstart..."
        send_telegram "🔧 *Clawdbot Watchdog*\n檢測到 EBADF 錯誤，正在執行 kickstart..."

        # 使用 launchctl kickstart -k 強制重啟（比 stop/start 更可靠）
        # -k = kill existing instance first
        launchctl kickstart -k gui/501/com.clawdbot.gateway >> "$WATCHDOG_LOG" 2>&1
        local kickstart_result=$?
        sleep 3

        # 驗證修復
        if check_gateway_running; then
            log "✅ Kickstart 成功，Gateway 已恢復"
            send_telegram "✅ EBADF 問題已修復，Gateway 運行正常"
        elif [ $kickstart_result -ne 0 ]; then
            # kickstart 失敗，可能服務未載入，嘗試 bootstrap
            log "⚠️  Kickstart 失敗，嘗試 bootstrap..."
            launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.clawdbot.gateway.plist >> "$WATCHDOG_LOG" 2>&1
            sleep 3

            if check_gateway_running; then
                log "✅ Bootstrap 成功，Gateway 已恢復"
                send_telegram "✅ Gateway 已通過 bootstrap 恢復"
            else
                log "❌ Bootstrap 也失敗"
                send_telegram "❌ *嚴重錯誤*\nKickstart + Bootstrap 都失敗，需要人工介入"
            fi
        else
            log "❌ Kickstart 後 Gateway 仍未運行"
            send_telegram "❌ *嚴重錯誤*\nKickstart 失敗，需要人工介入"
        fi
        return
    fi
    
    # 4. 執行完整健康檢查
    log "\n========== 完整健康檢查 =========="
    
    local issues_found=0
    
    # 檢查所有指標
    check_node_processes || ((issues_found++))
    check_disk_space || ((issues_found++))
    check_log_size || ((issues_found++))
    check_port_listening || ((issues_found++))
    check_critical_files || ((issues_found++))
    check_telegram_connectivity || ((issues_found++))
    check_recent_crashes || ((issues_found++))
    
    # 生成報告
    generate_health_report
    
    if [ "$issues_found" -eq 0 ]; then
        log "✅ 所有健康檢查通過，系統運行良好"
    else
        log "⚠️  發現 $issues_found 個問題，請注意"
    fi
    
    log "\n========== Watchdog 巡檢結束 ==========\n"
}

# 執行主程式
main
