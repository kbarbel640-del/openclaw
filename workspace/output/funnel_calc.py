#!/usr/bin/env python3
"""計算轉化漏斗"""

# 全量數據
total_registered = 949211
first_deposit = 332535  # 有成功存款的玩家

# 從充值次數分佈計算（只充 N 次的玩家數）
only_1 = 153956
only_2 = 52054
only_3 = 26972

# 漏斗計算
second_deposit = first_deposit - only_1  # 充 ≥2 次
third_deposit = second_deposit - only_2   # 充 ≥3 次
fourth_deposit = third_deposit - only_3   # 充 ≥4 次

print("=" * 50)
print("BG666 轉化漏斗（全量歷史數據）")
print("=" * 50)
print()
print(f"註冊用戶:    {total_registered:>10,}")
print(f"首充用戶:    {first_deposit:>10,}  ({first_deposit/total_registered*100:>5.1f}%)")
print(f"二充用戶:    {second_deposit:>10,}  ({second_deposit/first_deposit*100:>5.1f}%)")
print(f"三充用戶:    {third_deposit:>10,}  ({third_deposit/second_deposit*100:>5.1f}%)")
print(f"四充用戶:    {fourth_deposit:>10,}  ({fourth_deposit/third_deposit*100:>5.1f}%)")
print()
print("=" * 50)
print("漏斗轉化率")
print("=" * 50)
print(f"註冊 → 首充:  {first_deposit/total_registered*100:.1f}%")
print(f"首充 → 二充:  {second_deposit/first_deposit*100:.1f}%")
print(f"二充 → 三充:  {third_deposit/second_deposit*100:.1f}%")
print(f"三充 → 四充:  {fourth_deposit/third_deposit*100:.1f}%")
print()
print("=" * 50)
print("流失分析")
print("=" * 50)
print(f"註冊未首充:  {total_registered - first_deposit:,} ({(total_registered-first_deposit)/total_registered*100:.1f}%)")
print(f"首充流失:    {only_1:,} ({only_1/first_deposit*100:.1f}%)")
print(f"二充流失:    {only_2:,} ({only_2/second_deposit*100:.1f}%)")
