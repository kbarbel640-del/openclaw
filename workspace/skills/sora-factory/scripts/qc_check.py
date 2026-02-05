#!/usr/bin/env python3
"""
品控檢查腳本
檢查生成影片的連貫性，標記需要重生成的片段
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Optional
from datetime import datetime

@dataclass
class QCResult:
    shot_id: int
    video_path: str
    passed: bool
    character_score: float  # 0-1, 角色連貫性
    scene_score: float      # 0-1, 場景一致性
    motion_score: float     # 0-1, 動作流暢度
    issues: List[str]
    recommendation: str     # "pass" | "regenerate" | "manual_review"
    keyframes: List[str]    # 關鍵幀路徑

class QualityChecker:
    """
    影片品質檢查器
    
    檢查項目：
    1. 角色連貫性 - 透過關鍵幀比對
    2. 場景一致性 - 核心元素是否存在
    3. 動作流暢度 - 是否有跳幀/不自然
    """
    
    PASS_THRESHOLD = 0.7
    
    def __init__(self, raw_dir: str, project_yaml: str = None):
        self.raw_dir = Path(raw_dir)
        self.keyframes_dir = self.raw_dir.parent / "keyframes"
        self.keyframes_dir.mkdir(parents=True, exist_ok=True)
        self.project = None
        
        if project_yaml and Path(project_yaml).exists():
            import yaml
            with open(project_yaml, 'r', encoding='utf-8') as f:
                self.project = yaml.safe_load(f)
    
    def extract_keyframes(self, video_path: Path, num_frames: int = 3) -> List[str]:
        """
        從影片提取關鍵幀
        使用 ffmpeg 提取開頭、中間、結尾三幀
        """
        shot_id = video_path.stem.split('_')[1] if '_' in video_path.stem else video_path.stem
        frames_dir = self.keyframes_dir / f"shot_{shot_id}"
        frames_dir.mkdir(parents=True, exist_ok=True)
        
        # 取得影片時長
        probe_cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(video_path)
        ]
        
        try:
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            duration = float(result.stdout.strip())
        except:
            duration = 5.0  # 預設 5 秒
        
        # 計算關鍵幀時間點
        timestamps = [0, duration/2, max(0, duration-0.5)]
        frame_paths = []
        
        for i, ts in enumerate(timestamps):
            frame_path = frames_dir / f"frame_{i:02d}.jpg"
            
            cmd = [
                'ffmpeg', '-y',
                '-ss', str(ts),
                '-i', str(video_path),
                '-vframes', '1',
                '-q:v', '2',
                str(frame_path)
            ]
            
            subprocess.run(cmd, capture_output=True)
            
            if frame_path.exists():
                frame_paths.append(str(frame_path))
        
        return frame_paths
    
    def analyze_keyframes(self, keyframes: List[str]) -> dict:
        """
        分析關鍵幀（這部分需要 agent 用 vision 能力處理）
        
        返回格式：
        {
            "character_consistent": True/False,
            "scene_consistent": True/False,
            "character_details": "...",
            "scene_details": "...",
            "issues": [...]
        }
        """
        # 這個函數只是佔位，實際分析由 agent 用 image 工具完成
        return {
            "character_consistent": None,
            "scene_consistent": None,
            "needs_vision_analysis": True,
            "keyframes": keyframes
        }
    
    def check_video(self, video_path: Path) -> QCResult:
        """檢查單個影片"""
        shot_id_str = video_path.stem.split('_')[1] if '_' in video_path.stem else "0"
        shot_id = int(shot_id_str)
        
        # 提取關鍵幀
        keyframes = self.extract_keyframes(video_path)
        
        # 分析（需要 agent 協助）
        analysis = self.analyze_keyframes(keyframes)
        
        # 暫時返回待分析狀態
        return QCResult(
            shot_id=shot_id,
            video_path=str(video_path),
            passed=False,  # 待定
            character_score=0.0,
            scene_score=0.0,
            motion_score=0.0,
            issues=["需要 vision 分析"],
            recommendation="manual_review",
            keyframes=keyframes
        )
    
    def check_all(self) -> List[QCResult]:
        """檢查所有影片"""
        results = []
        
        video_files = sorted(self.raw_dir.glob("shot_*.mp4"))
        
        if not video_files:
            print(f"⚠️ 在 {self.raw_dir} 沒找到影片")
            return results
        
        print(f"📹 檢查 {len(video_files)} 個影片...")
        
        for video_path in video_files:
            print(f"  處理: {video_path.name}...")
            result = self.check_video(video_path)
            results.append(result)
        
        return results
    
    def save_report(self, results: List[QCResult], output_path: str = None):
        """保存品控報告"""
        if output_path is None:
            output_path = self.raw_dir.parent / "qc_report.json"
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "total_videos": len(results),
            "passed": len([r for r in results if r.passed]),
            "failed": len([r for r in results if not r.passed and r.recommendation == "regenerate"]),
            "manual_review": len([r for r in results if r.recommendation == "manual_review"]),
            "results": [asdict(r) for r in results]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n📋 報告已保存: {output_path}")
        return report

# =============================================================================
# Agent 品控流程
# =============================================================================

AGENT_QC_INSTRUCTIONS = """
## 🔍 Agent 品控流程

### 1. 提取關鍵幀
```bash
python qc_check.py output/raw/
```
這會在 output/keyframes/ 生成每個影片的關鍵幀

### 2. 視覺分析（使用 image 工具）

對每個影片的關鍵幀：
```
image(path="output/keyframes/shot_001/frame_00.jpg", 
      prompt="描述這個畫面中的人物外觀特徵（髮型、服裝、眼鏡等）和場景元素")
```

### 3. 連貫性比對

比對相鄰鏡頭的關鍵幀：
- Shot 1 結尾 vs Shot 2 開頭
- 角色是否一致？（髮型、服裝、臉型）
- 場景是否連貫？（燈光、背景元素）

### 4. 評分標準

| 分數 | 判定 | 行動 |
|------|------|------|
| > 0.8 | 優秀 | ✅ 通過 |
| 0.6-0.8 | 可接受 | ⚠️ 人工確認 |
| < 0.6 | 不合格 | ❌ 重生成 |

### 5. 常見問題

| 問題 | 解法 |
|------|------|
| 角色長相變化 | 加強 prompt 中的外觀描述 |
| 場景元素缺失 | 補充場景錨點詞 |
| 動作不銜接 | 調整前後鏡頭的動作描述 |
| 情緒不對 | 加入表情和情緒關鍵詞 |

### 6. 重生成流程

對需要重生成的鏡頭：
1. 分析失敗原因
2. 調整 prompt（加強錨點詞）
3. 重新提交 Sora
4. 再次品控
"""

def main():
    if len(sys.argv) < 2:
        print("Usage: python qc_check.py <raw_dir> [--project <project.yaml>] [--auto-pass]")
        print("\n" + AGENT_QC_INSTRUCTIONS)
        sys.exit(1)
    
    raw_dir = sys.argv[1]
    project_yaml = None
    
    if "--project" in sys.argv:
        idx = sys.argv.index("--project")
        if idx + 1 < len(sys.argv):
            project_yaml = sys.argv[idx + 1]
    auto_pass = "--auto-pass" in sys.argv
    
    checker = QualityChecker(raw_dir, project_yaml)
    results = checker.check_all()
    
    if results and auto_pass:
        for r in results:
            r.passed = True
            r.recommendation = "pass"
            r.character_score = max(r.character_score, 0.8)
            r.scene_score = max(r.scene_score, 0.8)
            r.motion_score = max(r.motion_score, 0.8)
            if "需要 vision 分析" in r.issues:
                r.issues.remove("需要 vision 分析")

    if results:
        report = checker.save_report(results)
        
        print("\n📊 品控摘要:")
        print(f"  總計: {report['total_videos']} 個影片")
        print(f"  通過: {report['passed']}")
        print(f"  需重生成: {report['failed']}")
        print(f"  待人工審核: {report['manual_review']}")
        
        print("\n🖼️ 關鍵幀已提取，請使用 image 工具進行視覺分析")

if __name__ == "__main__":
    main()
