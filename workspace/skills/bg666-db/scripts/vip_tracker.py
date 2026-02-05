#!/usr/bin/env python3
"""
VIP 等級追蹤工具
根據活動日期，追溯玩家 VIP 等級變化
"""

import os
import sys
import json
import pymysql
from datetime import datetime
from decimal import Decimal

# VIP 經驗值門檻
VIP_THRESHOLDS = [
    (0, 0),           # VIP0
    (3000, 1),        # VIP1
    (30000, 2),       # VIP2
    (400000, 3),      # VIP3
    (4000000, 4),     # VIP4
    (20000000, 5),    # VIP5
    (80000000, 6),    # VIP6
    (300000000, 7),   # VIP7
    (1000000000, 8),  # VIP8
    (5000000000, 9),  # VIP9
    (9999999999, 10), # VIP10
]

def exp_to_vip(experience):
    """經驗值轉 VIP 等級"""
    exp = float(experience) if isinstance(experience, Decimal) else experience
    for threshold, level in reversed(VIP_THRESHOLDS):
        if exp >= threshold:
            return level
    return 0

def get_connection():
    """取得資料庫連線"""
    return pymysql.connect(
        host='bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com',
        port=3306,
        user='market',
        password=os.environ.get('BG666_DB_PASSWORD', ''),
        database='ry-cloud',
        charset='utf8mb4'
    )

def get_vip_at_time(player_id, target_time):
    """取得玩家在特定時間點的 VIP 等級"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 找到該時間點之前的最後一筆記錄
            sql = """
                SELECT after_experience, create_time 
                FROM vip_oper_log 
                WHERE player_id = %s AND create_time <= %s
                ORDER BY create_time DESC 
                LIMIT 1
            """
            cursor.execute(sql, (player_id, target_time))
            row = cursor.fetchone()
            if row:
                return exp_to_vip(row[0]), float(row[0])
            
            # 沒有記錄，查當前經驗值
            sql = "SELECT experience FROM sys_player_experience WHERE player_id = %s"
            cursor.execute(sql, (player_id,))
            row = cursor.fetchone()
            if row:
                return exp_to_vip(row[0]), float(row[0])
            return 0, 0
    finally:
        conn.close()

def get_vip_change(player_id, start_time, end_time):
    """取得玩家在活動期間的 VIP 等級變化"""
    start_vip, start_exp = get_vip_at_time(player_id, start_time)
    end_vip, end_exp = get_vip_at_time(player_id, end_time)
    
    return {
        'player_id': player_id,
        'start_time': start_time,
        'end_time': end_time,
        'start_vip': start_vip,
        'start_exp': start_exp,
        'end_vip': end_vip,
        'end_exp': end_exp,
        'vip_change': end_vip - start_vip,
        'exp_change': end_exp - start_exp
    }

def batch_vip_change(player_ids, start_time, end_time):
    """批量查詢玩家 VIP 變化"""
    results = []
    for pid in player_ids:
        try:
            result = get_vip_change(pid, start_time, end_time)
            results.append(result)
        except Exception as e:
            results.append({'player_id': pid, 'error': str(e)})
    return results

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='VIP 等級追蹤工具')
    parser.add_argument('--player', type=int, help='玩家 ID')
    parser.add_argument('--start', help='活動開始時間 (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--end', help='活動結束時間 (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--test', action='store_true', help='測試模式')
    
    args = parser.parse_args()
    
    if args.test:
        # 測試經驗值轉等級
        test_cases = [0, 2999, 3000, 29999, 30000, 399999, 400000, 4000000]
        print("經驗值 → VIP 等級測試：")
        for exp in test_cases:
            print(f"  {exp:>10,} → VIP{exp_to_vip(exp)}")
    elif args.player and args.start and args.end:
        result = get_vip_change(args.player, args.start, args.end)
        print(json.dumps(result, indent=2, default=str))
    else:
        parser.print_help()
