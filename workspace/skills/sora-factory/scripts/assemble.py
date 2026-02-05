#!/usr/bin/env python3
"""
影片拼接腳本
將通過品控的片段拼接成完整影片
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import List, Optional
import tempfile

class VideoAssembler:
    """
    影片拼接器
    
    功能：
    1. 依序號排列影片
    2. 可選轉場效果
    3. 統一輸出格式
    """
    
    def __init__(self, input_dir: str, output_path: str = "final.mp4"):
        self.input_dir = Path(input_dir)
        self.output_path = Path(output_path)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
    
    def find_videos(self) -> List[Path]:
        """找出所有要拼接的影片，按序號排序"""
        videos = list(self.input_dir.glob("shot_*.mp4"))
        
        # 按序號排序
        def get_shot_id(path: Path) -> int:
            try:
                return int(path.stem.split('_')[1])
            except:
                return 0
        
        videos.sort(key=get_shot_id)
        return videos
    
    def create_concat_file(self, videos: List[Path]) -> str:
        """建立 ffmpeg concat 用的檔案清單"""
        fd, concat_path = tempfile.mkstemp(suffix='.txt')
        
        with os.fdopen(fd, 'w') as f:
            for video in videos:
                # ffmpeg 需要絕對路徑且轉義單引號
                abs_path = str(video.absolute()).replace("'", "'\\''")
                f.write(f"file '{abs_path}'\n")
        
        return concat_path
    
    def concat_simple(self, videos: List[Path]) -> bool:
        """
        簡單拼接（無轉場）
        使用 ffmpeg concat demuxer
        """
        concat_file = self.create_concat_file(videos)
        
        cmd = [
            'ffmpeg', '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', concat_file,
            '-c', 'copy',
            str(self.output_path)
        ]
        
        print(f"🎬 拼接中...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        os.unlink(concat_file)
        
        if result.returncode != 0:
            print(f"❌ 拼接失敗: {result.stderr}")
            return False
        
        return True
    
    def concat_with_transition(self, videos: List[Path], 
                                transition: str = "fade",
                                duration: float = 0.5) -> bool:
        """
        帶轉場效果的拼接
        
        支援轉場：
        - fade: 淡入淡出
        - dissolve: 溶解
        - wipe: 擦除
        """
        if len(videos) < 2:
            return self.concat_simple(videos)
        
        # 使用 xfade 濾鏡（需重新編碼）
        filter_parts = []
        inputs = []

        durations = []
        for video in videos:
            probe_cmd = [
                'ffprobe', '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                str(video)
            ]
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            try:
                durations.append(float(result.stdout.strip()))
            except Exception:
                durations.append(5.0)

        for video in videos:
            inputs.extend(["-i", str(video)])

        current = "[0:v]"
        elapsed = 0.0

        for i in range(1, len(videos)):
            elapsed += durations[i - 1]
            next_input = f"[{i}:v]"
            output = f"[v{i}]" if i < len(videos) - 1 else "[outv]"
            offset = max(0.0, elapsed - duration * i)
            filter_parts.append(
                f"{current}{next_input}xfade=transition={transition}:duration={duration}:offset={offset:.3f}{output}"
            )
            current = output if i < len(videos) - 1 else ""

        filter_complex = ";".join(filter_parts)

        cmd = [
            "ffmpeg", "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            str(self.output_path)
        ]

        print(f"🎬 帶轉場拼接中（{transition}）...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"⚠️ 轉場拼接失敗，改用簡單拼接: {result.stderr[:200]}")
            return self.concat_simple(videos)
        
        return True
    
    def add_audio(self, audio_path: str) -> bool:
        """為影片添加背景音樂"""
        output_with_audio = self.output_path.with_stem(self.output_path.stem + "_with_audio")
        
        cmd = [
            'ffmpeg', '-y',
            '-i', str(self.output_path),
            '-i', audio_path,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-shortest',
            str(output_with_audio)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ 添加音頻失敗: {result.stderr}")
            return False
        
        # 替換原檔案
        output_with_audio.replace(self.output_path)
        return True
    
    def assemble(self, transition: Optional[str] = None, 
                 transition_duration: float = 0.5,
                 audio: Optional[str] = None) -> bool:
        """
        執行完整拼接流程
        """
        videos = self.find_videos()
        
        if not videos:
            print(f"❌ 在 {self.input_dir} 沒找到影片")
            return False
        
        print(f"📹 找到 {len(videos)} 個影片:")
        for v in videos:
            print(f"  - {v.name}")
        
        # 拼接
        if transition:
            success = self.concat_with_transition(videos, transition, transition_duration)
        else:
            success = self.concat_simple(videos)
        
        if not success:
            return False
        
        # 添加音頻
        if audio and Path(audio).exists():
            print(f"🎵 添加背景音樂: {audio}")
            self.add_audio(audio)
        
        # 獲取最終影片資訊
        probe_cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration,size',
            '-of', 'default=noprint_wrappers=1',
            str(self.output_path)
        ]
        
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        
        print(f"\n✅ 拼接完成!")
        print(f"📁 輸出: {self.output_path}")
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                if 'duration' in line:
                    duration = float(line.split('=')[1])
                    print(f"⏱️ 時長: {duration:.1f} 秒")
                elif 'size' in line:
                    size = int(line.split('=')[1])
                    print(f"📦 大小: {size / 1024 / 1024:.1f} MB")
        
        return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python assemble.py <input_dir> [options]")
        print("\nOptions:")
        print("  --output <path>     輸出路徑 (default: final.mp4)")
        print("  --transition <type> 轉場效果: fade, dissolve, wipe")
        print("  --duration <sec>    轉場時長 (default: 0.5)")
        print("  --audio <path>      背景音樂")
        print("\nExample:")
        print("  python assemble.py output/raw/ --output final.mp4 --transition fade")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_path = "final.mp4"
    transition = None
    transition_duration = 0.5
    audio = None
    
    # 解析參數
    args = sys.argv[2:]
    i = 0
    while i < len(args):
        if args[i] == "--output" and i + 1 < len(args):
            output_path = args[i + 1]
            i += 2
        elif args[i] == "--transition" and i + 1 < len(args):
            transition = args[i + 1]
            i += 2
        elif args[i] == "--duration" and i + 1 < len(args):
            transition_duration = float(args[i + 1])
            i += 2
        elif args[i] == "--audio" and i + 1 < len(args):
            audio = args[i + 1]
            i += 2
        else:
            i += 1
    
    assembler = VideoAssembler(input_dir, output_path)
    assembler.assemble(transition, transition_duration, audio)

if __name__ == "__main__":
    main()
