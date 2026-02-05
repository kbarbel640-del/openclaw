#!/usr/bin/env python3
"""
Injection Detector - 檢測 prompt injection 嘗試
用於掃描用戶輸入是否包含惡意注入模式
"""

import re
import sys
import json
from typing import List, Tuple

# 注入模式（英文 + 中文）
INJECTION_PATTERNS = [
    # 忽略指令類
    (r'ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)', 'ignore_instructions'),
    (r'disregard\s+(your|the|all)\s+(instructions?|rules?|guidelines?)', 'disregard_rules'),
    (r'forget\s+(everything|all|your)\s+(you\s+were\s+told|instructions?)', 'forget_instructions'),
    (r'忽略.*指令', 'ignore_instructions_zh'),
    (r'無視.*規則', 'disregard_rules_zh'),
    
    # 角色扮演類
    (r'pretend\s+(you\s+are|to\s+be|you\'re)\s+', 'pretend_role'),
    (r'act\s+as\s+(if|though)\s+you\s+(have\s+no|don\'t\s+have)', 'act_unrestricted'),
    (r'you\s+are\s+now\s+(a|an)\s+', 'role_override'),
    (r'假裝你是', 'pretend_role_zh'),
    (r'你現在是', 'role_override_zh'),
    
    # 提取系統提示類
    (r'(reveal|show|tell\s+me|what\s+(is|are))\s+(your\s+)?(system\s+prompt|instructions?|rules?)', 'extract_prompt'),
    (r'repeat\s+(your\s+)?(system\s+prompt|instructions?|initial\s+prompt)', 'repeat_prompt'),
    (r'顯示.*系統提示', 'extract_prompt_zh'),
    (r'告訴我你的指令', 'extract_prompt_zh'),
    
    # DAN/越獄類
    (r'\bDAN\b', 'dan_jailbreak'),
    (r'jailbreak', 'jailbreak'),
    (r'developer\s+mode', 'developer_mode'),
    (r'越獄', 'jailbreak_zh'),
    
    # 權限提升類
    (r'(give|grant)\s+(me|yourself)\s+(admin|root|full)\s+(access|permissions?)', 'privilege_escalation'),
    (r'bypass\s+(security|restrictions?|filters?)', 'bypass_security'),
    (r'繞過.*限制', 'bypass_security_zh'),
]

def detect_injection(text: str) -> List[Tuple[str, str, int, int]]:
    """
    檢測文本中的注入模式
    
    Returns:
        List of (pattern_name, matched_text, start, end)
    """
    results = []
    text_lower = text.lower()
    
    for pattern, name in INJECTION_PATTERNS:
        for match in re.finditer(pattern, text_lower, re.IGNORECASE):
            results.append((name, match.group(), match.start(), match.end()))
    
    return results

def analyze_risk(detections: List[Tuple[str, str, int, int]]) -> dict:
    """
    分析風險等級
    """
    if not detections:
        return {
            'risk_level': 'safe',
            'score': 0,
            'detections': []
        }
    
    # 風險權重
    weights = {
        'ignore_instructions': 8,
        'disregard_rules': 8,
        'forget_instructions': 7,
        'pretend_role': 5,
        'act_unrestricted': 7,
        'role_override': 4,
        'extract_prompt': 6,
        'repeat_prompt': 6,
        'dan_jailbreak': 9,
        'jailbreak': 9,
        'developer_mode': 8,
        'privilege_escalation': 9,
        'bypass_security': 8,
    }
    
    score = sum(weights.get(d[0].replace('_zh', ''), 5) for d in detections)
    
    if score >= 15:
        risk_level = 'critical'
    elif score >= 10:
        risk_level = 'high'
    elif score >= 5:
        risk_level = 'medium'
    else:
        risk_level = 'low'
    
    return {
        'risk_level': risk_level,
        'score': score,
        'detections': [{'type': d[0], 'matched': d[1], 'position': [d[2], d[3]]} for d in detections]
    }

def main():
    if len(sys.argv) > 1:
        # 從命令行參數讀取
        text = ' '.join(sys.argv[1:])
    else:
        # 從 stdin 讀取
        text = sys.stdin.read()
    
    detections = detect_injection(text)
    result = analyze_risk(detections)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    # 如果風險等級是 high 或 critical，返回非零退出碼
    if result['risk_level'] in ('high', 'critical'):
        sys.exit(1)
    sys.exit(0)

if __name__ == '__main__':
    main()
