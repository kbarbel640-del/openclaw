#!/usr/bin/env python3
"""
老領班風控偵測系統 (Boss Eye)
數據抓取 → AI 推理 → 老領班點評完整閉環

系統角色：在柬埔寨西港做了15年的老領班，黑白兩道通吃，一眼看穿盤口貓膩。
"""

import os
import sys
import json
import time
import yaml
from datetime import datetime
from pathlib import Path

# 添加技能目錄到路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pymysql
    import requests
except ImportError:
    print("❌ 缺少依賴：pymysql, requests, pyyaml")
    print("請執行：pip install pymysql requests pyyaml")
    sys.exit(1)

class BettingEmpireAgent:
    """老領班風控偵測代理"""
    
    def __init__(self, config_path=None):
        self.load_config(config_path)
        self.setup_logging()
        
    def load_config(self, config_path=None):
        """加載配置"""
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "config", "database.yaml")
        
        # 默認配置
        self.config = {
            'bg666': {
                'host': os.getenv('BG666_DB_HOST', 'localhost'),
                'user': os.getenv('BG666_DB_USER', 'root'),
                'password': os.getenv('BG666_DB_PASSWORD', ''),
                'database': os.getenv('BG666_DB_NAME', 'ry-cloud'),
                'port': int(os.getenv('BG666_DB_PORT', 3306))
            },
            'matomo': {
                'url': os.getenv('MATOMO_URL', 'https://your-matomo.com/index.php'),
                'token': os.getenv('MATOMO_TOKEN', 'your_token'),
                'site_id': os.getenv('MATOMO_SITE_ID', '1')
            },
            'telegram': {
                'bot_token': os.getenv('TELEGRAM_BOT_TOKEN', ''),
                'channels': {
                    'boss_report': os.getenv('TELEGRAM_BOSS_CHANNEL', '-1001234567890'),
                    'data_team': os.getenv('TELEGRAM_DATA_TEAM', '-1003337225655')
                }
            },
            'ai': {
                'model': os.getenv('AI_MODEL', 'claude-3-opus-20240229'),
                'api_key': os.getenv('AI_API_KEY', '')
            }
        }
        
        # 嘗試加載 YAML 配置
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    yaml_config = yaml.safe_load(f)
                    # 深度合併配置
                    self._deep_merge(self.config, yaml_config)
            except Exception as e:
                self.log(f"⚠️ 加載 YAML 配置失敗: {e}", level="WARNING")
        
        self.log(f"✅ 配置加載完成")
        
    def _deep_merge(self, base, update):
        """深度合併字典"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
    
    def setup_logging(self):
        """設置日誌"""
        log_dir = os.path.join(os.path.dirname(__file__), "logs")
        os.makedirs(log_dir, exist_ok=True)
        
        today = datetime.now().strftime("%Y%m%d")
        self.log_file = os.path.join(log_dir, f"boss_eye_{today}.log")
        
    def log(self, message, level="INFO"):
        """記錄日誌"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] {message}"
        
        # 輸出到控制台
        print(log_entry)
        
        # 寫入日誌文件
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry + "\n")
    
    def get_bg666_connection(self):
        """獲取 BG666 數據庫連接"""
        try:
            conn = pymysql.connect(
                host=self.config['bg666']['host'],
                user=self.config['bg666']['user'],
                password=self.config['bg666']['password'],
                database=self.config['bg666']['database'],
                port=self.config['bg666']['port'],
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            self.log("✅ BG666 數據庫連接成功")
            return conn
        except Exception as e:
            self.log(f"❌ BG666 數據庫連接失敗: {e}", level="ERROR")
            return None
    
    def get_risk_data(self):
        """核心風控偵測 SQL：專抓打水、腳本、通道漏水"""
        conn = self.get_bg666_connection()
        if not conn:
            return {"error": "數據庫連接失敗"}
        
        try:
            with conn.cursor() as cursor:
                # 1. 偵測「極速重複注單」：同一秒內下注多筆，極大概率是腳本
                sql_speed = """
                SELECT 
                    user_id, 
                    COUNT(*) as flash_bets,
                    GROUP_CONCAT(amount) as amounts,
                    MAX(bet_time) as last_bet_time
                FROM bet_logs 
                WHERE bet_time > NOW() - INTERVAL 10 MINUTE
                GROUP BY user_id, UNIX_TIMESTAMP(bet_time)
                HAVING flash_bets > 2
                ORDER BY flash_bets DESC
                LIMIT 10;
                """
                cursor.execute(sql_speed)
                flash_bets = cursor.fetchall()
                
                # 2. 偵測「整數大額下注」：打水團隊為了算水方便，常下注 5000, 10000 等整數
                sql_pattern = """
                SELECT 
                    user_id, 
                    COUNT(*) as pattern_count,
                    SUM(amount) as total_vol,
                    GROUP_CONCAT(DISTINCT amount ORDER BY amount) as amount_patterns
                FROM bet_logs 
                WHERE amount IN (1000, 2000, 5000, 10000, 20000, 50000)
                    AND bet_time > NOW() - INTERVAL 1 HOUR
                GROUP BY user_id 
                HAVING COUNT(*) > 5
                ORDER BY pattern_count DESC
                LIMIT 10;
                """
                cursor.execute(sql_pattern)
                patterns = cursor.fetchall()
                
                # 3. 今日充值總額
                sql_income = """
                SELECT 
                    SUM(amount) as today_income,
                    COUNT(DISTINCT user_id) as user_count,
                    COUNT(*) as order_count
                FROM player_recharge_order 
                WHERE status = 'success' 
                    AND DATE(create_time) = CURDATE();
                """
                cursor.execute(sql_income)
                real_income = cursor.fetchone()
                
                # 4. 今日注單統計
                sql_bets = """
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(amount) as total_bet_amount,
                    COUNT(DISTINCT user_id) as active_users
                FROM bet_logs 
                WHERE DATE(bet_time) = CURDATE();
                """
                cursor.execute(sql_bets)
                bet_stats = cursor.fetchone()
                
                return {
                    "flash_bets": flash_bets,
                    "patterns": patterns,
                    "real_income": real_income,
                    "bet_stats": bet_stats,
                    "timestamp": datetime.now().isoformat()
                }
                
        except Exception as e:
            self.log(f"❌ SQL 查詢失敗: {e}", level="ERROR")
            return {"error": str(e)}
        finally:
            conn.close()
    
    def get_matomo_conversion(self):
        """抓取 Matomo 的漏斗流失數據"""
        try:
            params = {
                'module': 'API',
                'method': 'Goals.get',
                'idSite': self.config['matomo']['site_id'],
                'period': 'day',
                'date': 'today',
                'format': 'JSON',
                'token_auth': self.config['matomo']['token']
            }
            
            response = requests.get(
                self.config['matomo']['url'], 
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Matomo 數據獲取成功")
                return data
            else:
                self.log(f"❌ Matomo API 請求失敗: {response.status_code}", level="ERROR")
                return {"error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            self.log(f"❌ Matomo 連接失敗: {e}", level="ERROR")
            return {"error": str(e)}
    
    def ask_boss_veteran(self, risk_data, matomo_data):
        """老領班開口點評 - 模擬版本（實際需連接 AI API）"""
        
        # 準備數據摘要
        flash_summary = []
        if 'flash_bets' in risk_data and risk_data['flash_bets']:
            for bet in risk_data['flash_bets'][:3]:  # 只取前3個
                flash_summary.append(f"ID {bet['user_id']} ({bet['flash_bets']}筆/秒)")
        
        pattern_summary = []
        if 'patterns' in risk_data and risk_data['patterns']:
            for pattern in risk_data['patterns'][:3]:  # 只取前3個
                pattern_summary.append(f"ID {pattern['user_id']} ({pattern['pattern_count']}筆)")
        
        income_info = "無數據"
        if 'real_income' in risk_data and risk_data['real_income']:
            income = risk_data['real_income']
            if income.get('today_income'):
                income_info = f"¥{income['today_income']:,.0f} ({income['user_count']}人)"
        
        bet_info = "無數據"
        if 'bet_stats' in risk_data and risk_data['bet_stats']:
            stats = risk_data['bet_stats']
            bet_info = f"{stats['total_bets']}注/¥{stats['total_bet_amount']:,.0f} ({stats['active_users']}人)"
        
        # 構建老領班點評
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        report = f"""🕵️ 老領班風控報告 - {timestamp}

【今日盤口掃描】
1. 疑似腳本特徵：{len(flash_summary)} 個用戶在同一秒內下注 3+ 筆
   {', '.join(flash_summary) if flash_summary else '   暫無發現'}

2. 疑似打水特徵：{len(pattern_summary)} 個用戶規律整數下注
   {', '.join(pattern_summary) if pattern_summary else '   暫無發現'}

3. 今日戰績：
   - 充值總額：{income_info}
   - 注單統計：{bet_info}

4. Matomo 轉化：{'數據獲取成功' if 'error' not in matomo_data else '連接失敗'}

【老領班點評】
今天的盤，{'有崽種在偷雞' if flash_summary or pattern_summary else '看起來還算乾淨'}：
{f'1. {len(flash_summary)}個腳本崽種在同一秒連發，不是手點。' if flash_summary else ''}
{f'2. {len(pattern_summary)}個打水崽在下注金額太漂亮，散戶不會這樣玩。' if pattern_summary else ''}

門口的『路』{'要查查' if income_info != '無數據' and '¥' in income_info else '數據不足'}。

{'誰在搞鬼？上面 ID 先鎖了，今晚請他們喝茶。' if flash_summary or pattern_summary else '今天沒抓到現行，保持監控。'}

【技術備註】
• 此為模擬版本，實際需連接 AI API 進行深度分析
• 數據源：BG666 RDS + Matomo
• 偵測規則：極速注單(>2筆/秒) + 整數下注模式
"""
        
        return report
    
    def send_to_telegram(self, message, channel_key='boss_report'):
        """發送到 Telegram（模擬版本）"""
        channel_id = self.config['telegram']['channels'].get(channel_key)
        bot_token = self.config['telegram']['bot_token']
        
        if not bot_token or not channel_id:
            self.log("⚠️ Telegram 配置不完整，跳過發送", level="WARNING")
            return False
        
        self.log(f"📨 準備發送到 Telegram 頻道: {channel_key}")
        
        # 實際發送需要實現 Telegram Bot API 調用
        # 這裡只記錄日誌
        self.log(f"[Telegram 消息] {message[:100]}...")
        
        return True
    
    def save_report(self, report, data):
        """保存報告到文件"""
        report_dir = os.path.join(os.path.dirname(__file__), "reports")
        os.makedirs(report_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存文本報告
        report_file = os.path.join(report_dir, f"boss_report_{timestamp}.txt")
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        # 保存 JSON 數據
        data_file = os.path.join(report_dir, f"boss_data_{timestamp}.json")
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self.log(f"✅ 報告已保存: {report_file}, {data_file}")
        return report_file, data_file
    
    def run(self):
        """執行完整流程"""
        self.log("=" * 60)
        self.log("🚀 啟動老領班風控偵測系統")
        self.log("=" * 60)
        
        start_time = time.time()
        
        # 1. 抓取風險數據
        self.log("📊 抓取 BG666 風險數據...")
        risk_data = self.get_risk_data()
        
        if 'error' in risk_data:
            self.log(f"❌ 風險數據獲取失敗: {risk_data['error']}", level="ERROR")
            return False
        
        # 2. 抓取 Matomo 數據
        self.log("📈 抓取 Matomo 轉化數據...")
        matomo_data = self.get_matomo_conversion()
        
        # 3. 生成老領班點評
        self.log("🤖 生成老領班點評...")
        report = self.ask_boss_veteran(risk_data, matomo_data)
        
        # 4. 輸出報告
        print("\n" + "=" * 60)
        print(report)
        print("=" * 60 + "\n")
        
        # 5. 保存報告
        self.log("💾 保存報告到文件...")
        report_files = self.save_report(report, {
            "risk_data": risk_data,
            "matomo_data": matomo_data,
            "generated_at": datetime.now().isoformat()
        })
        
        # 6. 發送到 Telegram（模擬）
        self.log("📤 準備發送到 Telegram...")
        self.send_to_telegram(report)
        
        # 7. 統計信息
        elapsed = time.time() - start_time
        self.log(f"✅ 任務完成！耗時: {elapsed:.2f}秒")
        self.log(f"📁 報告文件: {report_files[0]}")
        
        return True


def run_test_mode():
    """測試模式 - 使用模擬數據"""
    agent = BettingEmpireAgent()
    agent.log("🧪 進入測試模式")
    
    # 使用模擬數據
    mock_risk_data = {
        "flash_bets": [
            {"user_id": 8848, "flash_bets": 5, "amounts": "1000,1000,1000,1000,1000", "last_bet_time": "2026-01-31 17:25:00"},
            {"user_id": 6666, "flash_bets": 4, "amounts": "5000,5000,5000,5000", "last_bet_time": "2026-01-31 17:24:30"}
        ],
        "patterns": [
            {"user_id": 7777, "pattern_count": 10, "total_vol": 50000, "amount_patterns": "5000"},
            {"user_id": 8888, "pattern_count": 8, "total_vol": 80000, "amount_patterns": "10000"}
        ],
        "real_income": {
            "today_income": 150000,
            "user_count": 25,
            "order_count": 30
        },
        "bet_stats": {
            "total_bets": 1250,
            "total_bet_amount": 1250000,
            "active_users": 150
        },
        "timestamp": datetime.now().isoformat()
    }
    
    mock_matomo_data = {
        "nb_visits": 500,
        "nb_actions": 1200,
        "nb_conversions": 20,
        "conversion_rate": 4.0
    }
    
    # 生成報告
    report = agent.ask_boss_veteran(mock_risk_data, mock_matomo_data)
    
    # 輸出報告
    print("\n" + "=" * 60)
    print(report)
    print("=" * 60 + "\n")
    
    # 保存測試報告
    report_dir = os.path.join(os.path.dirname(__file__), "reports")
    os.makedirs(report_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_report_file = os.path.join(report_dir, f"test_report_{timestamp}.txt")
    
    with open(test_report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    agent.log(f"✅ 測試報告已保存: {test_report_file}")
    agent.log("🎉 測試模式完成！")
    
    return True


def main():
    """主函數"""
    import argparse
    
    parser = argparse.ArgumentParser(description='老領班風控偵測系統')
    parser.add_argument('--test', action='store_true', help='運行測試模式（使用模擬數據）')
    parser.add_argument('--config', type=str, help='指定配置文件路徑')
    parser.add_argument('--verbose', '-v', action='store_true', help='詳細輸出模式')
    
    args = parser.parse_args()
    
    # 檢查是否在技能目錄中運行
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    if args.test:
        # 測試模式
        try:
            success = run_test_mode()
            sys.exit(0 if success else 1)
        except Exception as e:
            print(f"💥 測試模式錯誤: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    else:
        # 正常模式
        agent = BettingEmpireAgent(config_path=args.config)
        
        try:
            success = agent.run()
            sys.exit(0 if success else 1)
        except KeyboardInterrupt:
            agent.log("⏹️ 用戶中斷執行", level="WARNING")
            sys.exit(130)
        except Exception as e:
            agent.log(f"💥 未預期錯誤: {e}", level="ERROR")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    main()