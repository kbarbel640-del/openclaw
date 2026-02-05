#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
紫微斗數命盤計算 Skill
萃取自 mingli-backend，獨立運行版本

用法：
    python calculate.py --birthday 1990-01-15 --hour 13 --gender male
    python calculate.py --birthday 1976-06-20 --hour 5 --gender female --lunar
"""

import json
import argparse
from datetime import date, timedelta

# ========== 基礎數據 ==========

# 天干地支
STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
BRANCHES_FROM_YIN = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']

# 十二宮位
PALACES = [
    '命宮', '父母宮', '福德宮', '田宅宮', '官祿宮', '朋友宮',
    '遷移宮', '疾厄宮', '財帛宮', '子女宮', '夫妻宮', '兄弟宮'
]

# 陽干陰干
YANG_STEMS = ['甲', '丙', '戊', '庚', '壬']
YIN_STEMS = ['乙', '丁', '己', '辛', '癸']

# 時辰對應
HOUR_TO_BRANCH = {
    23: '子', 0: '子', 1: '丑', 2: '丑', 3: '寅', 4: '寅',
    5: '卯', 6: '卯', 7: '辰', 8: '辰', 9: '巳', 10: '巳',
    11: '午', 12: '午', 13: '未', 14: '未', 15: '申', 16: '申',
    17: '酉', 18: '酉', 19: '戌', 20: '戌', 21: '亥', 22: '亥'
}

# ========== 農曆轉換 ==========

LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63
]
BASE_DATE = date(1900, 1, 31)

def _leap_month(year):
    return LUNAR_INFO[year - 1900] & 0xF

def _leap_days(year):
    if _leap_month(year):
        return 30 if LUNAR_INFO[year - 1900] & 0x10000 else 29
    return 0

def _month_days(year, month):
    return 30 if LUNAR_INFO[year - 1900] & (0x10000 >> month) else 29

def _lunar_year_days(year):
    days = 348
    info = LUNAR_INFO[year - 1900]
    for i in range(12):
        if info & (0x8000 >> i):
            days += 1
    return days + _leap_days(year)

def solar_to_lunar(year, month, day):
    """陽曆轉農曆"""
    offset = (date(year, month, day) - BASE_DATE).days
    lunar_year = 1900
    while offset >= _lunar_year_days(lunar_year):
        offset -= _lunar_year_days(lunar_year)
        lunar_year += 1

    leap = _leap_month(lunar_year)
    lunar_month = 1
    is_leap = False
    while True:
        mdays = _leap_days(lunar_year) if is_leap else _month_days(lunar_year, lunar_month)
        if offset < mdays:
            break
        offset -= mdays
        if leap and lunar_month == leap:
            if not is_leap:
                is_leap = True
                continue
            else:
                is_leap = False
        lunar_month += 1
    lunar_day = offset + 1
    return lunar_year, lunar_month, lunar_day

# ========== 天干地支 ==========

def get_stem_branch(year):
    """根據西元年取得天干地支"""
    stem_index = (year - 4) % 10
    branch_index = (year - 4) % 12
    return STEMS[stem_index], BRANCHES[branch_index]

# ========== 命宮計算 ==========

def determine_life_palace(lunar_month, birth_hour):
    """計算命宮位置和十二宮排列"""
    # 生月地支：正月從寅開始
    syin_index = BRANCHES.index('寅')
    month_branch_index = (syin_index + lunar_month - 1) % 12
    month_branch = BRANCHES[month_branch_index]
    
    # 生時地支
    hour_branch = HOUR_TO_BRANCH[birth_hour]
    hour_index = BRANCHES.index(hour_branch)
    month_index = BRANCHES.index(month_branch)
    
    # 命宮地支：生月宮逆數到生時
    life_palace_index = (month_index - hour_index) % 12
    life_branch = BRANCHES[life_palace_index]
    
    # 排列十二宮
    life_index = BRANCHES.index(life_branch)
    palace_branches = {}
    for i, palace_name in enumerate(PALACES):
        branch_index = (life_index + i) % 12
        palace_branches[palace_name] = BRANCHES[branch_index]
    
    return palace_branches, life_branch

# ========== 身宮與來因宮 ==========

BODY_PALACE_MAPPING = {
    '子': '命宮', '午': '命宮',
    '丑': '福德宮', '未': '福德宮',
    '寅': '官祿宮', '申': '官祿宮',
    '卯': '遷移宮', '酉': '遷移宮',
    '辰': '財帛宮', '戌': '財帛宮',
    '巳': '夫妻宮', '亥': '夫妻宮'
}

CAUSE_BRANCH_MAPPING = {
    '甲': '戌', '乙': '酉', '丙': '申', '丁': '未', '戊': '午',
    '己': '巳', '庚': '辰', '辛': '卯', '壬': '寅', '癸': '亥'
}

def determine_body_palace(hour_branch):
    return BODY_PALACE_MAPPING.get(hour_branch)

def determine_cause_palace(birth_stem):
    return CAUSE_BRANCH_MAPPING.get(birth_stem)

# ========== 宮位天干 ==========

STEM_TO_TIGER_PALACE = {
    '甲': '丙', '己': '丙', '乙': '戊', '庚': '戊',
    '丙': '庚', '辛': '庚', '丁': '壬', '壬': '壬',
    '戊': '甲', '癸': '甲'
}

def assign_palace_stems(birth_stem):
    """安置十二宮天干"""
    tiger_palace_stem = STEM_TO_TIGER_PALACE.get(birth_stem)
    start_index = STEMS.index(tiger_palace_stem)
    palace_stems = {}
    for i, branch in enumerate(BRANCHES_FROM_YIN):
        stem_index = (start_index + i) % len(STEMS)
        palace_stems[branch] = STEMS[stem_index]
    return palace_stems

# ========== 五行局 ==========

FIVE_ELEMENT_TABLE = {
    ('甲', '子'): ('水二局', 2), ('甲', '丑'): ('水二局', 2),
    ('甲', '寅'): ('火六局', 6), ('甲', '卯'): ('火六局', 6),
    ('甲', '辰'): ('木三局', 3), ('甲', '巳'): ('木三局', 3),
    ('甲', '午'): ('土五局', 5), ('甲', '未'): ('土五局', 5),
    ('甲', '申'): ('金四局', 4), ('甲', '酉'): ('金四局', 4),
    ('甲', '戌'): ('火六局', 6), ('甲', '亥'): ('火六局', 6),
    ('己', '子'): ('水二局', 2), ('己', '丑'): ('水二局', 2),
    ('己', '寅'): ('火六局', 6), ('己', '卯'): ('火六局', 6),
    ('己', '辰'): ('木三局', 3), ('己', '巳'): ('木三局', 3),
    ('己', '午'): ('土五局', 5), ('己', '未'): ('土五局', 5),
    ('己', '申'): ('金四局', 4), ('己', '酉'): ('金四局', 4),
    ('己', '戌'): ('火六局', 6), ('己', '亥'): ('火六局', 6),
    ('乙', '子'): ('火六局', 6), ('乙', '丑'): ('火六局', 6),
    ('乙', '寅'): ('土五局', 5), ('乙', '卯'): ('土五局', 5),
    ('乙', '辰'): ('金四局', 4), ('乙', '巳'): ('金四局', 4),
    ('乙', '午'): ('木三局', 3), ('乙', '未'): ('木三局', 3),
    ('乙', '申'): ('水二局', 2), ('乙', '酉'): ('水二局', 2),
    ('乙', '戌'): ('土五局', 5), ('乙', '亥'): ('土五局', 5),
    ('庚', '子'): ('火六局', 6), ('庚', '丑'): ('火六局', 6),
    ('庚', '寅'): ('土五局', 5), ('庚', '卯'): ('土五局', 5),
    ('庚', '辰'): ('金四局', 4), ('庚', '巳'): ('金四局', 4),
    ('庚', '午'): ('木三局', 3), ('庚', '未'): ('木三局', 3),
    ('庚', '申'): ('水二局', 2), ('庚', '酉'): ('水二局', 2),
    ('庚', '戌'): ('土五局', 5), ('庚', '亥'): ('土五局', 5),
    ('丙', '子'): ('土五局', 5), ('丙', '丑'): ('土五局', 5),
    ('丙', '寅'): ('木三局', 3), ('丙', '卯'): ('木三局', 3),
    ('丙', '辰'): ('水二局', 2), ('丙', '巳'): ('水二局', 2),
    ('丙', '午'): ('金四局', 4), ('丙', '未'): ('金四局', 4),
    ('丙', '申'): ('火六局', 6), ('丙', '酉'): ('火六局', 6),
    ('丙', '戌'): ('木三局', 3), ('丙', '亥'): ('木三局', 3),
    ('辛', '子'): ('土五局', 5), ('辛', '丑'): ('土五局', 5),
    ('辛', '寅'): ('木三局', 3), ('辛', '卯'): ('木三局', 3),
    ('辛', '辰'): ('水二局', 2), ('辛', '巳'): ('水二局', 2),
    ('辛', '午'): ('金四局', 4), ('辛', '未'): ('金四局', 4),
    ('辛', '申'): ('火六局', 6), ('辛', '酉'): ('火六局', 6),
    ('辛', '戌'): ('木三局', 3), ('辛', '亥'): ('木三局', 3),
    ('丁', '子'): ('木三局', 3), ('丁', '丑'): ('木三局', 3),
    ('丁', '寅'): ('金四局', 4), ('丁', '卯'): ('金四局', 4),
    ('丁', '辰'): ('火六局', 6), ('丁', '巳'): ('火六局', 6),
    ('丁', '午'): ('水二局', 2), ('丁', '未'): ('水二局', 2),
    ('丁', '申'): ('土五局', 5), ('丁', '酉'): ('土五局', 5),
    ('丁', '戌'): ('金四局', 4), ('丁', '亥'): ('金四局', 4),
    ('壬', '子'): ('木三局', 3), ('壬', '丑'): ('木三局', 3),
    ('壬', '寅'): ('金四局', 4), ('壬', '卯'): ('金四局', 4),
    ('壬', '辰'): ('火六局', 6), ('壬', '巳'): ('火六局', 6),
    ('壬', '午'): ('水二局', 2), ('壬', '未'): ('水二局', 2),
    ('壬', '申'): ('土五局', 5), ('壬', '酉'): ('土五局', 5),
    ('壬', '戌'): ('金四局', 4), ('壬', '亥'): ('金四局', 4),
    ('戊', '子'): ('金四局', 4), ('戊', '丑'): ('金四局', 4),
    ('戊', '寅'): ('水二局', 2), ('戊', '卯'): ('水二局', 2),
    ('戊', '辰'): ('土五局', 5), ('戊', '巳'): ('土五局', 5),
    ('戊', '午'): ('火六局', 6), ('戊', '未'): ('火六局', 6),
    ('戊', '申'): ('木三局', 3), ('戊', '酉'): ('木三局', 3),
    ('戊', '戌'): ('水二局', 2), ('戊', '亥'): ('水二局', 2),
    ('癸', '子'): ('金四局', 4), ('癸', '丑'): ('金四局', 4),
    ('癸', '寅'): ('水二局', 2), ('癸', '卯'): ('水二局', 2),
    ('癸', '辰'): ('土五局', 5), ('癸', '巳'): ('土五局', 5),
    ('癸', '午'): ('火六局', 6), ('癸', '未'): ('火六局', 6),
    ('癸', '申'): ('木三局', 3), ('癸', '酉'): ('木三局', 3),
    ('癸', '戌'): ('水二局', 2), ('癸', '亥'): ('水二局', 2),
}

def determine_five_element_chart(birth_stem, life_branch):
    """查表取得五行局"""
    return FIVE_ELEMENT_TABLE.get((birth_stem, life_branch), ('水二局', 2))

# ========== 主星安置 ==========

ZIWEI_POSITION_TABLE = {
    2: {i: BRANCHES_FROM_YIN.index(['丑', '寅', '寅', '卯', '卯', '辰', '辰', '巳', '巳', '午',
         '午', '未', '未', '申', '申', '酉', '酉', '戌', '戌', '亥',
         '亥', '子', '子', '丑', '丑', '寅', '寅', '卯', '卯', '辰'][i-1]) for i in range(1, 31)},
    3: {
        1: 2, 2: 11, 3: 0, 4: 3, 5: 0, 6: 1, 7: 4, 8: 1, 9: 2, 10: 5,
        11: 2, 12: 3, 13: 6, 14: 3, 15: 4, 16: 7, 17: 4, 18: 5, 19: 8, 20: 5,
        21: 6, 22: 9, 23: 6, 24: 7, 25: 10, 26: 7, 27: 8, 28: 11, 29: 8, 30: 9
    },
    4: {
        1: 9, 2: 2, 3: 11, 4: 0, 5: 10, 6: 3, 7: 0, 8: 1, 9: 11, 10: 4,
        11: 1, 12: 2, 13: 0, 14: 5, 15: 2, 16: 3, 17: 1, 18: 6, 19: 3, 20: 4,
        21: 2, 22: 7, 23: 4, 24: 5, 25: 3, 26: 8, 27: 5, 28: 6, 29: 4, 30: 9
    },
    5: {
        1: 4, 2: 9, 3: 2, 4: 11, 5: 0, 6: 5, 7: 10, 8: 3, 9: 0, 10: 1,
        11: 6, 12: 11, 13: 4, 14: 1, 15: 2, 16: 7, 17: 0, 18: 5, 19: 2, 20: 3,
        21: 8, 22: 1, 23: 6, 24: 3, 25: 4, 26: 9, 27: 2, 28: 7, 29: 4, 30: 5
    },
    6: {
        1: 7, 2: 4, 3: 9, 4: 2, 5: 11, 6: 0, 7: 8, 8: 5, 9: 10, 10: 3,
        11: 0, 12: 1, 13: 9, 14: 6, 15: 11, 16: 4, 17: 1, 18: 2, 19: 10, 20: 7,
        21: 0, 22: 5, 23: 2, 24: 3, 25: 11, 26: 8, 27: 1, 28: 6, 29: 3, 30: 4
    }
}

ZIWEI_SYSTEM_OFFSETS = {'紫微': 0, '天機': -1, '太陽': -3, '武曲': -4, '天同': -5, '廉貞': -8}
TIANFU_SYSTEM_OFFSETS = {'天府': 0, '太陰': 1, '貪狼': 2, '巨門': 3, '天相': 4, '天梁': 5, '七殺': 6, '破軍': 10}

ZIWEI_TO_TIANFU = {
    '寅': '寅', '申': '申', '丑': '卯', '卯': '丑', '子': '辰', '辰': '子',
    '巳': '亥', '亥': '巳', '午': '戌', '戌': '午', '未': '酉', '酉': '未'
}

def assign_main_stars(lunar_month, lunar_day, chart_number):
    """安置十四主星"""
    if chart_number not in ZIWEI_POSITION_TABLE:
        raise ValueError(f"無效的五行局數: {chart_number}")
    
    ziwei_idx = ZIWEI_POSITION_TABLE[chart_number][lunar_day]
    ziwei_branch = BRANCHES_FROM_YIN[ziwei_idx]
    
    star_positions = {}
    for star, offset in ZIWEI_SYSTEM_OFFSETS.items():
        idx = (ziwei_idx + offset) % 12
        star_positions[f"{star}星"] = BRANCHES_FROM_YIN[idx]
    
    tianfu_branch = ZIWEI_TO_TIANFU[ziwei_branch]
    tianfu_idx = BRANCHES_FROM_YIN.index(tianfu_branch)
    
    for star, offset in TIANFU_SYSTEM_OFFSETS.items():
        idx = (tianfu_idx + offset) % 12
        star_positions[f"{star}星"] = BRANCHES_FROM_YIN[idx]
    
    return star_positions

# ========== 年系星 ==========

LU_CUN = {'甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子'}
QI_YANG = {'甲': '卯', '乙': '辰', '丙': '午', '丁': '未', '戊': '午', '己': '未', '庚': '酉', '辛': '戌', '壬': '子', '癸': '丑'}
TUO_LUO = {'甲': '丑', '乙': '寅', '丙': '辰', '丁': '巳', '戊': '辰', '己': '巳', '庚': '未', '辛': '申', '壬': '戌', '癸': '亥'}
TIAN_KUI = {'甲': '丑', '乙': '子', '丙': '亥', '丁': '亥', '戊': '丑', '己': '子', '庚': '丑', '辛': '午', '壬': '卯', '癸': '卯'}
TIAN_YUE = {'甲': '未', '乙': '申', '丙': '酉', '丁': '酉', '戊': '未', '己': '申', '庚': '未', '辛': '寅', '壬': '巳', '癸': '巳'}

def assign_year_stars(birth_stem):
    return {
        "祿存": LU_CUN[birth_stem],
        "擎羊": QI_YANG[birth_stem],
        "陀羅": TUO_LUO[birth_stem],
        "天魁": TIAN_KUI[birth_stem],
        "天鉞": TIAN_YUE[birth_stem]
    }

# ========== 月系星 ==========

LEFT_POS = {1: '辰', 2: '巳', 3: '午', 4: '未', 5: '申', 6: '酉', 7: '戌', 8: '亥', 9: '子', 10: '丑', 11: '寅', 12: '卯'}
RIGHT_POS = {1: '戌', 2: '酉', 3: '申', 4: '未', 5: '午', 6: '巳', 7: '辰', 8: '卯', 9: '寅', 10: '丑', 11: '子', 12: '亥'}
HORSE_POS = {1: '申', 2: '巳', 3: '寅', 4: '亥', 5: '申', 6: '巳', 7: '寅', 8: '亥', 9: '申', 10: '巳', 11: '寅', 12: '亥'}

def assign_month_stars(lunar_month):
    return {'左輔': LEFT_POS[lunar_month], '右弼': RIGHT_POS[lunar_month], '天馬': HORSE_POS[lunar_month]}

# ========== 時系星 ==========

STAR_TABLES = {
    '文曲': {'子': '辰', '丑': '巳', '寅': '午', '卯': '未', '辰': '申', '巳': '酉', '午': '戌', '未': '亥', '申': '子', '酉': '丑', '戌': '寅', '亥': '卯'},
    '文昌': {'子': '戌', '丑': '酉', '寅': '申', '卯': '未', '辰': '午', '巳': '巳', '午': '辰', '未': '卯', '申': '寅', '酉': '丑', '戌': '子', '亥': '亥'},
    '天空': {'子': '亥', '丑': '戌', '寅': '酉', '卯': '申', '辰': '未', '巳': '午', '午': '巳', '未': '辰', '申': '卯', '酉': '寅', '戌': '丑', '亥': '子'},
    '地劫': {'子': '亥', '丑': '子', '寅': '丑', '卯': '寅', '辰': '卯', '巳': '辰', '午': '巳', '未': '午', '申': '未', '酉': '申', '戌': '酉', '亥': '戌'}
}

FIRE_BELL_TABLE = {
    "寅午戌年": {
        "group": ["寅", "午", "戌"],
        "positions": {
            "子": {"火星": "丑", "鈴星": "卯"}, "丑": {"火星": "寅", "鈴星": "辰"},
            "寅": {"火星": "卯", "鈴星": "巳"}, "卯": {"火星": "辰", "鈴星": "午"},
            "辰": {"火星": "巳", "鈴星": "未"}, "巳": {"火星": "午", "鈴星": "申"},
            "午": {"火星": "未", "鈴星": "酉"}, "未": {"火星": "申", "鈴星": "戌"},
            "申": {"火星": "酉", "鈴星": "亥"}, "酉": {"火星": "戌", "鈴星": "子"},
            "戌": {"火星": "亥", "鈴星": "丑"}, "亥": {"火星": "子", "鈴星": "寅"}
        }
    },
    "申子辰年": {
        "group": ["申", "子", "辰"],
        "positions": {
            "子": {"火星": "寅", "鈴星": "戌"}, "丑": {"火星": "卯", "鈴星": "亥"},
            "寅": {"火星": "辰", "鈴星": "子"}, "卯": {"火星": "巳", "鈴星": "丑"},
            "辰": {"火星": "午", "鈴星": "寅"}, "巳": {"火星": "未", "鈴星": "卯"},
            "午": {"火星": "申", "鈴星": "辰"}, "未": {"火星": "酉", "鈴星": "巳"},
            "申": {"火星": "戌", "鈴星": "午"}, "酉": {"火星": "亥", "鈴星": "未"},
            "戌": {"火星": "子", "鈴星": "申"}, "亥": {"火星": "丑", "鈴星": "酉"}
        }
    },
    "巳酉丑年": {
        "group": ["巳", "酉", "丑"],
        "positions": {
            "子": {"火星": "卯", "鈴星": "戌"}, "丑": {"火星": "辰", "鈴星": "亥"},
            "寅": {"火星": "巳", "鈴星": "子"}, "卯": {"火星": "午", "鈴星": "丑"},
            "辰": {"火星": "未", "鈴星": "寅"}, "巳": {"火星": "申", "鈴星": "卯"},
            "午": {"火星": "酉", "鈴星": "辰"}, "未": {"火星": "戌", "鈴星": "巳"},
            "申": {"火星": "亥", "鈴星": "午"}, "酉": {"火星": "子", "鈴星": "未"},
            "戌": {"火星": "丑", "鈴星": "申"}, "亥": {"火星": "寅", "鈴星": "酉"}
        }
    },
    "亥卯未年": {
        "group": ["亥", "卯", "未"],
        "positions": {
            "子": {"火星": "酉", "鈴星": "戌"}, "丑": {"火星": "戌", "鈴星": "亥"},
            "寅": {"火星": "亥", "鈴星": "子"}, "卯": {"火星": "子", "鈴星": "丑"},
            "辰": {"火星": "丑", "鈴星": "寅"}, "巳": {"火星": "寅", "鈴星": "卯"},
            "午": {"火星": "卯", "鈴星": "辰"}, "未": {"火星": "辰", "鈴星": "巳"},
            "申": {"火星": "巳", "鈴星": "午"}, "酉": {"火星": "午", "鈴星": "未"},
            "戌": {"火星": "未", "鈴星": "申"}, "亥": {"火星": "申", "鈴星": "酉"}
        }
    }
}

def assign_hour_stars(hour_branch, birth_year_branch):
    stars = {}
    for star_name, table in STAR_TABLES.items():
        stars[star_name] = table[hour_branch]
    
    # 火星鈴星
    for group_name, data in FIRE_BELL_TABLE.items():
        if birth_year_branch in data["group"]:
            fb = data["positions"][hour_branch]
            stars.update(fb)
            break
    
    return stars

# ========== 四化星 ==========

TRANSFORMATION_TABLE = {
    '甲': {'化祿': '廉貞', '化權': '破軍', '化科': '武曲', '化忌': '太陽'},
    '乙': {'化祿': '天機', '化權': '天梁', '化科': '紫微', '化忌': '太陰'},
    '丙': {'化祿': '天同', '化權': '天機', '化科': '文昌', '化忌': '廉貞'},
    '丁': {'化祿': '太陰', '化權': '天同', '化科': '天機', '化忌': '巨門'},
    '戊': {'化祿': '貪狼', '化權': '太陰', '化科': '右弼', '化忌': '天機'},
    '己': {'化祿': '武曲', '化權': '貪狼', '化科': '天梁', '化忌': '文曲'},
    '庚': {'化祿': '太陽', '化權': '武曲', '化科': '天同', '化忌': '天相'},
    '辛': {'化祿': '巨門', '化權': '太陽', '化科': '文曲', '化忌': '文昌'},
    '壬': {'化祿': '天梁', '化權': '紫微', '化科': '左輔', '化忌': '武曲'},
    '癸': {'化祿': '破軍', '化權': '巨門', '化科': '太陰', '化忌': '貪狼'}
}

def assign_transformation_stars(birth_stem):
    return TRANSFORMATION_TABLE.get(birth_stem, {})

# ========== 大限小限 ==========

OPPOSITE_BRANCH = {
    '子': '午', '丑': '未', '寅': '申', '卯': '酉',
    '辰': '戌', '巳': '亥', '午': '子', '未': '丑',
    '申': '寅', '酉': '卯', '戌': '辰', '亥': '巳'
}

def major_fortune_direction(gender, birth_stem):
    if (gender == '男' and birth_stem in YANG_STEMS) or (gender == '女' and birth_stem in YIN_STEMS):
        return '順行'
    return '逆行'

def minor_fortune_start(birth_branch):
    return OPPOSITE_BRANCH.get(birth_branch, '子')

# ========== 主計算函數 ==========

def calculate_chart(gender, year, month, day, hour, is_lunar=False):
    """
    計算紫微命盤
    
    Args:
        gender: 性別 ('男'/'女' 或 'male'/'female')
        year: 年份
        month: 月份
        day: 日
        hour: 時（0-23）
        is_lunar: 是否為農曆輸入
    
    Returns:
        dict: 完整命盤資料
    """
    # 性別標準化
    if gender.lower() in ['male', 'm']:
        gender = '男'
    elif gender.lower() in ['female', 'f']:
        gender = '女'
    
    # 陽曆轉農曆
    solar_year, solar_month, solar_day = year, month, day
    if not is_lunar:
        year, month, day = solar_to_lunar(year, month, day)
    
    # 生年天干地支
    birth_stem, birth_branch = get_stem_branch(year)
    
    # 命宮
    palace_branches, life_branch = determine_life_palace(month, hour)
    palace_sequence = [palace_branches[p] for p in PALACES]
    
    # 身宮、來因宮
    hour_branch = HOUR_TO_BRANCH[hour]
    body_palace = determine_body_palace(hour_branch)
    cause_palace_branch = determine_cause_palace(birth_stem)
    cause_palace = None
    for name, branch in palace_branches.items():
        if branch == cause_palace_branch:
            cause_palace = name
            break
    
    # 宮位天干
    palace_stems = assign_palace_stems(birth_stem)
    palace_stems_formatted = {f'{b}宮': s for b, s in palace_stems.items()}
    
    # 五行局
    chart_name, chart_number = determine_five_element_chart(birth_stem, life_branch)
    
    # 主星
    main_star_positions = assign_main_stars(month, day, chart_number)
    
    # 年系星
    year_star_positions = assign_year_stars(birth_stem)
    
    # 月系星
    month_star_positions = assign_month_stars(month)
    
    # 時系星
    hour_star_positions = assign_hour_stars(hour_branch, birth_branch)
    
    # 四化星
    transformation_positions = assign_transformation_stars(birth_stem)
    
    # 大限小限
    fortune_info = {
        'major_fortune_direction': major_fortune_direction(gender, birth_stem),
        'major_fortune_start_age': chart_number,
        'minor_fortune_start_position': minor_fortune_start(birth_branch)
    }
    
    # 彙整宮位星曜
    palace_stars = {b: [] for b in BRANCHES_FROM_YIN}
    for star_dict in [main_star_positions, year_star_positions, month_star_positions, hour_star_positions]:
        for star, br in star_dict.items():
            palace_stars.setdefault(br, []).append(star)
    
    result = {
        'birth_data': {
            'gender': gender,
            'solar_date': f"{solar_year}-{solar_month:02d}-{solar_day:02d}",
            'lunar_date': f"{year}-{month:02d}-{day:02d}",
            'birth_hour': hour,
            'hour_branch': hour_branch
        },
        'basic_info': {
            'birth_stem': birth_stem,
            'birth_branch': birth_branch,
            'stem_branch': f'{birth_stem}{birth_branch}',
            'five_element_chart': chart_name,
            'five_element_chart_number': chart_number,
            'start_age': chart_number
        },
        'palaces': {
            'life_palace': {'branch': life_branch},
            'body_palace': {'palace': body_palace},
            'cause_palace': {'palace': cause_palace, 'branch': cause_palace_branch},
            'palace_branches': palace_branches,
            'palace_sequence': palace_sequence,
            'palace_stems': palace_stems_formatted
        },
        'stars': {
            'main_stars': main_star_positions,
            'year_based_stars': year_star_positions,
            'month_based_stars': month_star_positions,
            'hour_based_stars': hour_star_positions,
            'transformation_stars': transformation_positions,
            'palace_stars': palace_stars
        },
        'fortune_periods': fortune_info,
        'summary': {
            'life_palace_info': f"命宮在{life_branch}",
            'body_palace_info': f"身宮在{body_palace}",
            'cause_palace_info': f"來因宮在{cause_palace}({cause_palace_branch})" if cause_palace else f"來因宮在{cause_palace_branch}",
            'five_element_info': f"五行局：{chart_name}"
        }
    }
    
    return result


def print_chart_summary(result):
    """印出命盤摘要"""
    print("=" * 50)
    print("紫微斗數命盤")
    print("=" * 50)
    
    bd = result['birth_data']
    print(f"\n【基本資料】")
    print(f"性別：{bd['gender']}")
    print(f"陽曆：{bd['solar_date']}")
    print(f"農曆：{bd['lunar_date']}")
    print(f"時辰：{bd['hour_branch']}時 ({bd['birth_hour']}:00)")
    
    bi = result['basic_info']
    print(f"\n【命理資訊】")
    print(f"生年：{bi['stem_branch']}年")
    print(f"五行局：{bi['five_element_chart']}")
    print(f"起運歲數：{bi['start_age']}歲")
    
    p = result['palaces']
    print(f"\n【宮位資訊】")
    print(f"命宮：{p['life_palace']['branch']}")
    print(f"身宮：{p['body_palace']['palace']}")
    print(f"來因宮：{p['cause_palace']['palace']} ({p['cause_palace']['branch']})")
    
    print(f"\n【十二宮排列】")
    for palace, branch in p['palace_branches'].items():
        print(f"  {palace}：{branch}")
    
    s = result['stars']
    print(f"\n【主星分布】")
    for star, branch in s['main_stars'].items():
        print(f"  {star}：{branch}")
    
    print(f"\n【四化星】")
    for trans, star in s['transformation_stars'].items():
        print(f"  {trans}：{star}")
    
    fp = result['fortune_periods']
    print(f"\n【運程資訊】")
    print(f"大限方向：{fp['major_fortune_direction']}")
    print(f"起運歲數：{fp['major_fortune_start_age']}歲")
    print(f"小限起始：{fp['minor_fortune_start_position']}")
    
    print("\n" + "=" * 50)


def main():
    parser = argparse.ArgumentParser(description='紫微斗數命盤計算')
    parser.add_argument('--birthday', '-b', required=True, help='生日 (YYYY-MM-DD)')
    parser.add_argument('--hour', '-H', type=int, required=True, help='出生時辰 (0-23)')
    parser.add_argument('--gender', '-g', required=True, choices=['male', 'female', '男', '女'], help='性別')
    parser.add_argument('--lunar', '-l', action='store_true', help='輸入為農曆')
    parser.add_argument('--json', '-j', action='store_true', help='輸出 JSON 格式')
    
    args = parser.parse_args()
    
    year, month, day = map(int, args.birthday.split('-'))
    
    result = calculate_chart(
        gender=args.gender,
        year=year,
        month=month,
        day=day,
        hour=args.hour,
        is_lunar=args.lunar
    )
    
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_chart_summary(result)


if __name__ == '__main__':
    main()
