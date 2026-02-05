#!/usr/bin/env python3
"""
Threads 平台探索器
學習 Threads 平台特性，分析成功貼文模式
"""

import json
import time
from datetime import datetime
from pathlib import Path

class ThreadsExplorer:
    def __init__(self, data_dir="data/threads"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 學習資料庫
        self.learning_db = self.data_dir / "learning.json"
        self.post_patterns_db = self.data_dir / "patterns.json"
        
        # 初始化資料庫
        self.init_databases()
    
    def init_databases(self):
        """初始化學習資料庫"""
        if not self.learning_db.exists():
            base_learning = {
                "platform_characteristics": {
                    "emoji_usage": "精簡、有節奏、視覺引導",
                    "paragraph_structure": "短段落、空行分隔",
                    "content_preferences": ["工具推薦", "趨勢分析", "經驗分享"],
                    "interaction_patterns": ["提問結尾", "邀請討論", "價值分享"],
                    "no_multi_tags": True
                },
                "successful_patterns": [],
                "failed_patterns": [],
                "engagement_metrics": {},
                "last_updated": datetime.now().isoformat()
            }
            self.save_json(self.learning_db, base_learning)
        
        if not self.post_patterns_db.exists():
            base_patterns = {
                "tool_recommendation": {
                    "structure": ["問題引入", "工具列表", "行動建議"],
                    "emoji_pattern": "🛠️📋🚀",
                    "example": "想學 AI 開發？這 5 個工具讓你少走半年彎路...",
                    "success_rate": 0,
                    "avg_engagement": 0
                },
                "trend_analysis": {
                    "structure": ["現象描述", "深度分析", "機會點"],
                    "emoji_pattern": "📈🔍💡", 
                    "example": "Google/微軟同時出手，AI 基礎設施大升級意味著什麼？",
                    "success_rate": 0,
                    "avg_engagement": 0
                },
                "story_sharing": {
                    "structure": ["故事背景", "關鍵做法", "心得啟發"],
                    "emoji_pattern": "📖🎯🤝",
                    "example": "我的 AI 自動化系統滿月報告：每週省下 20 小時...",
                    "success_rate": 0,
                    "avg_engagement": 0
                }
            }
            self.save_json(self.post_patterns_db, base_patterns)
    
    def save_json(self, path, data):
        """儲存 JSON 資料"""
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def load_json(self, path):
        """載入 JSON 資料"""
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def analyze_post(self, post_data):
        """分析貼文特徵"""
        analysis = {
            "length": len(post_data.get("content", "")),
            "paragraph_count": post_data.get("content", "").count('\n\n') + 1,
            "emoji_count": self.count_emojis(post_data.get("content", "")),
            "has_question": "?" in post_data.get("content", ""),
            "has_call_to_action": any(word in post_data.get("content", "").lower() 
                                    for word in ["你覺得", "你的看法", "分享你的", "留言告訴"]),
            "engagement_ratio": self.calculate_engagement_ratio(post_data),
            "pattern_match": self.match_pattern(post_data.get("content", ""))
        }
        return analysis
    
    def count_emojis(self, text):
        """計算 emoji 數量（簡化版）"""
        # 簡單的 emoji 檢測
        emoji_ranges = [
            (0x1F600, 0x1F64F),  # 表情符號
            (0x1F300, 0x1F5FF),  # 其他符號
            (0x1F680, 0x1F6FF),  # 交通和地圖符號
            (0x2600, 0x26FF),    # 雜項符號
            (0x2700, 0x27BF),    # 裝飾符號
            (0xFE00, 0xFE0F),    # 變體選擇器
            (0x1F900, 0x1F9FF),  # 補充符號
        ]
        
        count = 0
        for char in text:
            code = ord(char)
            for start, end in emoji_ranges:
                if start <= code <= end:
                    count += 1
                    break
        return count
    
    def calculate_engagement_ratio(self, post_data):
        """計算互動率（簡化版）"""
        likes = post_data.get("likes", 0)
        replies = post_data.get("replies", 0)
        reposts = post_data.get("reposts", 0)
        shares = post_data.get("shares", 0)
        
        total_engagement = likes + replies * 3 + reposts * 5 + shares * 10
        return total_engagement
    
    def match_pattern(self, content):
        """匹配貼文模式"""
        content_lower = content.lower()
        patterns = self.load_json(self.post_patterns_db)
        
        matched = []
        for pattern_name, pattern_info in patterns.items():
            # 簡單的關鍵字匹配
            keywords = {
                "tool_recommendation": ["工具", "推薦", "清單", "top", "最好用"],
                "trend_analysis": ["趨勢", "分析", "市場", "未來", "機會"],
                "story_sharing": ["經驗", "故事", "分享", "心得", "教訓"]
            }
            
            if pattern_name in keywords:
                for keyword in keywords[pattern_name]:
                    if keyword in content_lower:
                        matched.append(pattern_name)
                        break
        
        return matched if matched else ["unknown"]
    
    def update_learning(self, post_data, analysis):
        """更新學習資料庫"""
        learning = self.load_json(self.learning_db)
        patterns = self.load_json(self.post_patterns_db)
        
        # 記錄成功模式
        if analysis["engagement_ratio"] > 100:  # 假設門檻
            learning["successful_patterns"].append({
                "timestamp": datetime.now().isoformat(),
                "content_preview": post_data.get("content", "")[:100],
                "analysis": analysis,
                "engagement": analysis["engagement_ratio"]
            })
            
            # 更新模式成功率
            for pattern in analysis["pattern_match"]:
                if pattern in patterns and pattern != "unknown":
                    patterns[pattern]["success_rate"] += 1
                    patterns[pattern]["avg_engagement"] = (
                        (patterns[pattern]["avg_engagement"] * (patterns[pattern]["success_rate"] - 1) +
                         analysis["engagement_ratio"]) / patterns[pattern]["success_rate"]
                    )
        
        # 保持資料庫大小
        if len(learning["successful_patterns"]) > 100:
            learning["successful_patterns"] = learning["successful_patterns"][-100:]
        
        learning["last_updated"] = datetime.now().isoformat()
        
        self.save_json(self.learning_db, learning)
        self.save_json(self.post_patterns_db, patterns)
    
    def generate_insights_report(self):
        """生成學習洞察報告"""
        learning = self.load_json(self.learning_db)
        patterns = self.load_json(self.post_patterns_db)
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_posts_analyzed": len(learning.get("successful_patterns", [])) + 
                                   len(learning.get("failed_patterns", [])),
            "platform_characteristics": learning.get("platform_characteristics", {}),
            "pattern_performance": {},
            "recommendations": []
        }
        
        # 分析模式表現
        for pattern_name, pattern_info in patterns.items():
            if pattern_info["success_rate"] > 0:
                report["pattern_performance"][pattern_name] = {
                    "success_rate": pattern_info["success_rate"],
                    "avg_engagement": pattern_info["avg_engagement"],
                    "recommended_emoji": pattern_info["emoji_pattern"]
                }
        
        # 生成建議
        if report["pattern_performance"]:
            best_pattern = max(report["pattern_performance"].items(), 
                             key=lambda x: x[1]["avg_engagement"])
            report["recommendations"].append(
                f"最有效的模式：{best_pattern[0]} (平均互動：{best_pattern[1]['avg_engagement']:.1f})"
            )
            report["recommendations"].append(
                f"建議 emoji 模式：{best_pattern[1]['recommended_emoji']}"
            )
        
        # 平台特性建議
        if learning.get("platform_characteristics", {}).get("no_multi_tags"):
            report["recommendations"].append(
                "Threads 沒有 multi tags 功能，使用單一精準標籤即可"
            )
        
        return report
    
    def explore_from_snapshot(self, snapshot_data):
        """從瀏覽器 snapshot 探索貼文"""
        # 這裡可以整合 browser 工具的 snapshot 數據
        # 暫時使用模擬數據
        mock_posts = [
            {
                "content": "🛠️ 想開始 AI 開發但不知道從哪入手？\n\n這 5 個工具讓我少走半年彎路...",
                "likes": 28000,
                "replies": 54,
                "reposts": 4125,
                "shares": 10000
            },
            {
                "content": "📈 Google 和微軟同時出手了！\n\n這週兩件大事：\n1. Google LiteRT - 跨平台 AI 加速架構\n2. 微軟 Copilot - Windows 11 系統級整合",
                "likes": 9275,
                "replies": 85,
                "reposts": 1055,
                "shares": 9575
            }
        ]
        
        insights = []
        for post in mock_posts:
            analysis = self.analyze_post(post)
            self.update_learning(post, analysis)
            insights.append({
                "content_preview": post["content"][:50] + "...",
                "analysis": analysis
            })
        
        return insights

def main():
    """主測試函數"""
    print("🧪 Threads 平台探索器啟動...")
    
    explorer = ThreadsExplorer()
    
    # 模擬探索
    print("\n🔍 模擬探索 Threads 貼文...")
    insights = explorer.explore_from_snapshot({})
    
    for i, insight in enumerate(insights, 1):
        print(f"\n貼文 {i}: {insight['content_preview']}")
        print(f"  長度: {insight['analysis']['length']} 字元")
        print(f"  emoji 數量: {insight['analysis']['emoji_count']}")
        print(f"  段落數: {insight['analysis']['paragraph_count']}")
        print(f"  匹配模式: {', '.join(insight['analysis']['pattern_match'])}")
        print(f"  互動分數: {insight['analysis']['engagement_ratio']:.1f}")
    
    # 生成報告
    print("\n📊 學習洞察報告:")
    report = explorer.generate_insights_report()
    print(f"分析貼文數: {report['total_posts_analyzed']}")
    
    if report['pattern_performance']:
        print("\n模式表現:")
        for pattern, perf in report['pattern_performance'].items():
            print(f"  {pattern}: 成功率 {perf['success_rate']}, 平均互動 {perf['avg_engagement']:.1f}")
    
    if report['recommendations']:
        print("\n建議:")
        for rec in report['recommendations']:
            print(f"  • {rec}")
    
    # 儲存報告
    report_path = explorer.data_dir / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    explorer.save_json(report_path, report)
    print(f"\n✅ 報告已儲存至: {report_path}")

if __name__ == "__main__":
    main()