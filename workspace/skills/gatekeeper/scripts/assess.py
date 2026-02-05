#!/usr/bin/env python3
"""
Gatekeeper Assessment Script
ThinkerCafe 性格測評系統

Usage:
  python assess.py                    # 隨機抽 3 組題目（9 題）
  python assess.py --full             # 完整測試（24 題）
  python assess.py --set 1,3,5        # 指定題組
  python assess.py --answers AABCDDAB # 直接計算結果
"""

import json
import random
import argparse
from pathlib import Path
from typing import List, Dict, Tuple

# 載入題庫
QUESTIONS_PATH = Path(__file__).parent.parent / "questions.json"

def load_questions() -> Dict:
    """載入題庫"""
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_question_sets(data: Dict, set_ids: List[int] = None, full: bool = False) -> List[Dict]:
    """取得題組
    
    Args:
        data: 完整題庫
        set_ids: 指定題組 ID（1-8）
        full: 是否全部題目
    
    Returns:
        選中的題組列表
    """
    all_sets = data["question_sets"]
    
    if full:
        return all_sets
    elif set_ids:
        return [s for s in all_sets if s["id"] in set_ids]
    else:
        # 隨機抽 3 組
        return random.sample(all_sets, 3)

def calculate_scores(answers: str) -> Dict[str, int]:
    """計算各類型分數
    
    Args:
        answers: 答案字串（如 "AABCDDAB"）
    
    Returns:
        各類型分數字典
    """
    scores = {"A": 0, "B": 0, "C": 0, "D": 0}
    for a in answers.upper():
        if a in scores:
            scores[a] += 1
    return scores

def get_personality_type(scores: Dict[str, int]) -> Tuple[str, str, str]:
    """根據分數判斷性格類型
    
    Returns:
        (主類型代號, 主類型名稱, 描述)
    """
    type_info = {
        "A": ("行動者", "你是一個行動導向的人。面對挑戰時，你傾向於先做再說，相信實踐出真知。你的優勢在於執行力強、不怕失敗、能在混亂中找到方向。"),
        "B": ("連結者", "你是一個關係導向的人。你重視人與人之間的連結，相信溝通與理解的力量。你的優勢在於同理心強、善於建立信任、能在團隊中創造和諧。"),
        "C": ("創意者", "你是一個內在導向的人。你重視內心的聲音與靈感，相信真實的自我表達。你的優勢在於創造力豐富、直覺敏銳、能看見他人看不見的可能性。"),
        "D": ("分析者", "你是一個邏輯導向的人。你重視理性思考與系統分析，相信結構與方法。你的優勢在於思維縝密、善於規劃、能在複雜中找到清晰的路徑。")
    }
    
    # 找出最高分的類型
    max_score = max(scores.values())
    top_types = [k for k, v in scores.items() if v == max_score]
    
    # 如果有同分，按 A > B > C > D 優先
    primary = top_types[0]
    
    return (primary, type_info[primary][0], type_info[primary][1])

def format_result(scores: Dict[str, int], primary: str, type_name: str, description: str) -> str:
    """格式化輸出結果"""
    total = sum(scores.values())
    
    result = f"""
╔══════════════════════════════════════════════════╗
║           🎭 ThinkerCafe 性格測評報告            ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║   你的主要類型：{type_name}（{primary}型）
║                                                  ║
╠══════════════════════════════════════════════════╣
║   📊 分數分布                                    ║
║                                                  ║
║   🏃 行動者（A）：{scores['A']:2d} 題 ({scores['A']/total*100:5.1f}%)
║   🤝 連結者（B）：{scores['B']:2d} 題 ({scores['B']/total*100:5.1f}%)
║   🎨 創意者（C）：{scores['C']:2d} 題 ({scores['C']/total*100:5.1f}%)
║   🔍 分析者（D）：{scores['D']:2d} 題 ({scores['D']/total*100:5.1f}%)
║                                                  ║
╠══════════════════════════════════════════════════╣
║   📝 類型描述                                    ║
║                                                  ║
"""
    # 分行顯示描述
    words = description.split("。")
    for w in words:
        if w.strip():
            result += f"║   {w.strip()}。\n"
    
    result += """║                                                  ║
╚══════════════════════════════════════════════════╝
"""
    return result

def run_interactive_test(question_sets: List[Dict]) -> str:
    """互動式測驗
    
    Returns:
        答案字串
    """
    answers = []
    question_num = 1
    
    for qset in question_sets:
        print(f"\n{'='*60}")
        print(f"📖 情境：{qset['theme']}")
        print(f"{'='*60}")
        print(f"\n{qset['context']}\n")
        
        for q in qset["questions"]:
            print(f"\n【第 {question_num} 題】")
            print(q["question"])
            print()
            for opt, text in q["options"].items():
                print(f"  {opt}. {text}")
            
            while True:
                answer = input("\n請輸入你的答案 (A/B/C/D): ").strip().upper()
                if answer in ["A", "B", "C", "D"]:
                    answers.append(answer)
                    break
                print("❌ 請輸入有效的選項 (A/B/C/D)")
            
            question_num += 1
    
    return "".join(answers)

def format_questions_for_bot(question_sets: List[Dict]) -> str:
    """格式化題目供 bot 發送
    
    Returns:
        Telegram/LINE 友好的題目格式
    """
    output = []
    question_num = 1
    
    for qset in question_sets:
        output.append(f"📖 **情境：{qset['theme']}**\n")
        output.append(qset['context'])
        output.append("")
        
        for q in qset["questions"]:
            output.append(f"**【第 {question_num} 題】**")
            output.append(q["question"])
            output.append("")
            for opt, text in q["options"].items():
                output.append(f"{opt}. {text}")
            output.append("")
            question_num += 1
        
        output.append("─" * 40)
    
    output.append("\n請依序回覆你的答案（例如：AABCDDABC）")
    
    return "\n".join(output)

def main():
    parser = argparse.ArgumentParser(description="ThinkerCafe 性格測評")
    parser.add_argument("--full", action="store_true", help="完整測試（24題）")
    parser.add_argument("--set", type=str, help="指定題組（如：1,3,5）")
    parser.add_argument("--answers", type=str, help="直接計算答案結果")
    parser.add_argument("--format-bot", action="store_true", help="輸出 bot 格式的題目")
    parser.add_argument("--json", action="store_true", help="JSON 格式輸出")
    
    args = parser.parse_args()
    
    data = load_questions()
    
    # 如果直接給答案，計算結果
    if args.answers:
        scores = calculate_scores(args.answers)
        primary, type_name, description = get_personality_type(scores)
        
        if args.json:
            print(json.dumps({
                "answers": args.answers.upper(),
                "scores": scores,
                "primary_type": primary,
                "type_name": type_name,
                "description": description
            }, ensure_ascii=False, indent=2))
        else:
            print(format_result(scores, primary, type_name, description))
        return
    
    # 取得題組
    set_ids = None
    if args.set:
        set_ids = [int(x) for x in args.set.split(",")]
    
    question_sets = get_question_sets(data, set_ids, args.full)
    
    # Bot 格式輸出
    if args.format_bot:
        print(format_questions_for_bot(question_sets))
        return
    
    # 互動式測驗
    print("\n🎭 ThinkerCafe 性格測評")
    print("=" * 60)
    
    total_questions = sum(len(qs["questions"]) for qs in question_sets)
    themes = [qs["theme"] for qs in question_sets]
    
    print(f"\n本次測驗包含 {len(question_sets)} 個情境，共 {total_questions} 題")
    print(f"情境主題：{', '.join(themes)}")
    print("\n請根據直覺選擇最符合你的答案，沒有對錯之分。")
    
    input("\n按 Enter 開始測驗...")
    
    answers = run_interactive_test(question_sets)
    
    # 計算結果
    scores = calculate_scores(answers)
    primary, type_name, description = get_personality_type(scores)
    
    print(format_result(scores, primary, type_name, description))

if __name__ == "__main__":
    main()
