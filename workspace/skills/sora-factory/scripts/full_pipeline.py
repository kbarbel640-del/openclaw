#!/usr/bin/env python3
"""
Sora 影片工廠 - 完整流程
從 project.yaml 到最終影片的一鍵執行

注意：這個腳本需要 agent 配合 browser 工具執行 Sora 相關操作
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime

# 添加當前目錄到 path
sys.path.insert(0, str(Path(__file__).parent))

from story_to_prompts import load_project, generate_sora_prompt
from sora_batch_submit import SoraBatchManager, TaskStatus
from qc_check import QualityChecker
from assemble import VideoAssembler
from download_watcher import scan_mode as _dl_scan_mode, watch_mode as _dl_watch_mode

# Provider abstraction (ai-video-factory direction)
from providers_kling_stub import KlingProvider

class SoraFactory:
    """
    Sora 影片工廠
    
    完整流程：
    1. 解析劇本 → prompts
    2. 批次提交 Sora（需 agent + browser）
    3. 品控檢查（需 agent + vision）
    4. 拼接輸出
    """
    
    def __init__(self, project_yaml: str, workspace: str = None):
        self.project_path = Path(project_yaml)
        self.project = load_project(project_yaml)
        
        # 建立工作目錄
        if workspace:
            self.workspace = Path(workspace)
        else:
            project_name = self.project.get('project', {}).get('name', 'untitled')
            project_name = project_name.replace(' ', '_').lower()
            self.workspace = Path(f"projects/{project_name}_{datetime.now().strftime('%Y%m%d_%H%M')}")
        
        self.workspace.mkdir(parents=True, exist_ok=True)
        
        # 子目錄
        self.shots_dir = self.workspace / "shots"
        self.raw_dir = self.workspace / "output" / "raw"
        self.keyframes_dir = self.workspace / "output" / "keyframes"
        self.approved_dir = self.workspace / "output" / "approved"
        self.logs_dir = self.workspace / "logs"
        
        for d in [self.shots_dir, self.raw_dir, self.keyframes_dir, 
                  self.approved_dir, self.logs_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        # 狀態追蹤
        self.state_file = self.workspace / "pipeline_state.json"
        self.state = self.load_state()
    
    def load_state(self) -> dict:
        """載入流程狀態"""
        if self.state_file.exists():
            with open(self.state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "stage": "init",
            "prompts_generated": False,
            "sora_submitted": False,
            "sora_completed": False,
            "qc_passed": False,
            "assembled": False,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    
    def save_state(self):
        """保存流程狀態"""
        self.state["updated_at"] = datetime.now().isoformat()
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, indent=2, ensure_ascii=False)
    
    def step1_generate_prompts(self):
        """Step 1: 劇本 → Prompts"""
        print("\n" + "="*50)
        print("📝 Step 1: 生成 Sora Prompts")
        print("="*50)
        
        shots = self.project.get('shots', [])
        
        if not shots:
            raise ValueError("專案沒有定義 shots")
        
        print(f"📋 處理 {len(shots)} 個鏡頭...")
        
        import yaml
        manifest = []
        
        for shot in shots:
            shot_id = shot.get('id', len(manifest) + 1)
            filename = f"shot_{shot_id:03d}.txt"
            filepath = self.shots_dir / filename
            
            prompt = generate_sora_prompt(shot, self.project)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(prompt)
            
            manifest.append({
                'id': shot_id,
                'file': filename,
                'duration': shot.get('duration', 5),
                'scene': shot.get('scene', 'unknown')
            })
            
            print(f"  ✅ {filename}")
        
        # 寫入 manifest
        manifest_data = {
            'shots': manifest, 
            'total_duration': sum(s['duration'] for s in manifest),
            'project_name': self.project.get('project', {}).get('name', 'untitled')
        }
        
        with open(self.shots_dir / "manifest.yaml", 'w', encoding='utf-8') as f:
            yaml.dump(manifest_data, f, allow_unicode=True)
        
        self.state["prompts_generated"] = True
        self.state["stage"] = "prompts_ready"
        self.save_state()
        
        print(f"\n✅ 完成！共 {len(shots)} 個 prompts")
        print(f"📁 輸出: {self.shots_dir}/")
        
        return manifest
    
    def step2_submit_sora(self, download_dir: str = None, watch_downloads: bool = False, download_count: int = None, since_minutes: int = 90, interactive_map_downloads: bool = False):
        # Provider switching (ai-video-factory direction)
        provider = getattr(self, "provider", "sora_ui")
        if provider and provider != "sora_ui":
            if provider == "kling":
                # Stub for now: we need official API docs + API key wiring.
                raise SystemExit("Provider=kling not implemented yet. Next step: integrate Kling official API (create/get/download).")
            raise SystemExit(f"Unknown provider: {provider}")
        """
        Step 2: 提交 Sora 生成

        預設：仍需要你在 Sora UI 完成「貼 prompt → Create video → Download」。
        但本函數可選擇在你下載後，自動把下載檔案搬運/改名到 workspace/output/raw。

        Args:
            download_dir: 你的瀏覽器下載目錄（例如 ~/Downloads 或 config 內指定的 download_dir）
            watch_downloads: True 時進入 watch 模式，會等待檔案陸續下載完成。
            download_count: 預期下載數（預設=shots 數量）
            since_minutes: scan 模式下只考慮最近 N 分鐘內的下載檔
        """
        print("\n" + "="*50)
        print("🎬 Step 2: 批次提交 Sora")
        print("="*50)
        
        manager = SoraBatchManager(str(self.shots_dir), str(self.raw_dir))
        manager.load_prompts()
        manager.print_status()
        
        print("\n" + "-"*50)
        print("⚠️ 需要 Agent 執行以下操作：")
        print("-"*50)
        print("""
1. 開啟 Sora (browser navigate to https://sora.com)
2. 對每個 prompt：
   - 貼上 prompt 內容
   - 點擊 Generate
   - 記錄任務 ID
3. 等待生成完成（每個約 3-5 分鐘）
4. 下載完成的影片到 {raw_dir}
5. 命名為 shot_001.mp4, shot_002.mp4, ...
        """.format(raw_dir=self.raw_dir))
        print("\n🤖 或使用自動模式：")
        print(f"python3 scripts/sora_batch_submit.py {self.shots_dir} --auto --auto-download --config assets/sora_browser_config.yaml")
        print("🧪 或使用 API 模式：")
        print(f"python3 scripts/sora_batch_submit.py {self.shots_dir} --api")
        
        # 輸出所有 prompts 供 agent 使用
        print("\n📝 Prompts 列表：")
        for task in manager.tasks:
            print(f"\n--- Shot {task.shot_id} ---")
            print(task.prompt_text[:500] + "..." if len(task.prompt_text) > 500 else task.prompt_text)
        
        self.state["stage"] = "sora_pending"
        self.state["sora_submitted"] = True
        # baseline for download capture (used by download_watcher scan mode)
        self.state["download_start_ts"] = time.time()
        self.save_state()

        # Optional: after you click Download in Sora UI, auto-move the downloaded files into raw_dir.
        if download_dir:
            try:
                count = download_count or len(manager.tasks)
                dl_dir = Path(os.path.expanduser(download_dir)).resolve()
                out_dir = self.raw_dir
                print("\n" + "="*50)
                print("⬇️ 下載落地：搬運/改名到 raw_dir")
                print("="*50)
                print(f"download_dir: {dl_dir}")
                print(f"raw_dir:      {out_dir}")
                print(f"count:        {count}")
                # Record a baseline timestamp so we only pick downloads from *this* run.
                if not self.state.get("download_start_ts"):
                    self.state["download_start_ts"] = time.time()
                    self.save_state()

                print("\n請先在 Sora UI 依序點 Download（照 shot 順序），然後我會接手搬運。")

                if watch_downloads:
                    _dl_watch_mode(
                        dl_dir,
                        out_dir,
                        count=count,
                        start_index=1,
                        overwrite=True,
                        since_ts=float(self.state.get("download_start_ts") or 0) or None,
                        manifest_path=(self.logs_dir / "downloads_manifest.json"),
                    )
                else:
                    _dl_scan_mode(
                        dl_dir,
                        out_dir,
                        count=count,
                        start_index=1,
                        since_minutes=since_minutes,
                        overwrite=True,
                        since_ts=float(self.state.get("download_start_ts") or 0) or None,
                        interactive_map=interactive_map_downloads,
                        manifest_path=(self.logs_dir / "downloads_manifest.json"),
                    )

                self.state["sora_completed"] = True
                self.state["stage"] = "sora_completed"
                self.save_state()
                print("✅ 下載檔案已落地到 raw_dir，可進入 Step 3 (QC)")
            except Exception as e:
                print(f"⚠️ 下載搬運失敗：{e}")
                print("你仍可手動把影片放到 raw_dir，或調整 --download-dir/--since-minutes 後重試。")
    
    def step3_qc_check(self, auto_pass: bool = False):
        """Step 3: 品控檢查"""
        print("\n" + "="*50)
        print("🔍 Step 3: 品控檢查")
        print("="*50)
        
        checker = QualityChecker(str(self.raw_dir))
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
            report = checker.save_report(results, str(self.logs_dir / "qc_report.json"))
            
            print("\n📊 品控摘要:")
            print(f"  總計: {report['total_videos']} 個影片")
            
            print("\n" + "-"*50)
            print("⚠️ 需要 Agent 執行視覺分析：")
            print("-"*50)
            print("""
對每個影片的關鍵幀使用 image 工具：
1. 分析角色外觀是否一致
2. 檢查場景元素是否連貫
3. 評估動作是否流暢
4. 標記需要重生成的片段
            """)
            
            print(f"\n🖼️ 關鍵幀位置: {self.keyframes_dir}/")
        
        if results and all(r.passed for r in results):
            self.state["qc_passed"] = True
            self.state["stage"] = "qc_passed"
        else:
            self.state["qc_passed"] = False
            self.state["stage"] = "qc_pending"
        self.save_state()
        
        return results
    
    def step4_assemble(self, transition: str = None, force: bool = False):
        """Step 4: 拼接輸出"""
        print("\n" + "="*50)
        print("🎞️ Step 4: 拼接最終影片")
        print("="*50)
        
        if not force and not self.state.get("qc_passed", False):
            print("⚠️ 尚未通過品控，請先完成品控或使用 --force-assemble")
            return False

        input_dir = self.approved_dir if list(self.approved_dir.glob("shot_*.mp4")) else self.raw_dir
        output_path = self.workspace / "final.mp4"
        assembler = VideoAssembler(str(input_dir), str(output_path))
        
        success = assembler.assemble(transition=transition)
        
        if success:
            self.state["assembled"] = True
            self.state["stage"] = "completed"
            self.state["output_path"] = str(output_path)
            self.save_state()
            
            print(f"\n🎉 影片製作完成！")
            print(f"📁 最終輸出: {output_path}")
        
        return success
    
    def print_status(self):
        """顯示當前狀態"""
        print("\n" + "="*50)
        print(f"📊 專案狀態: {self.workspace}")
        print("="*50)
        
        stages = [
            ("prompts_generated", "📝 Prompts 生成"),
            ("sora_submitted", "🎬 Sora 提交"),
            ("sora_completed", "✅ Sora 完成"),
            ("qc_passed", "🔍 品控通過"),
            ("assembled", "🎞️ 拼接完成")
        ]
        
        for key, label in stages:
            status = "✅" if self.state.get(key, False) else "⏳"
            print(f"  {status} {label}")
        
        print(f"\n  當前階段: {self.state.get('stage', 'unknown')}")
        print(f"  更新時間: {self.state.get('updated_at', 'N/A')}")
    
    def run_interactive(self, download_dir: str = None, watch_downloads: bool = False, since_minutes: int = 90, interactive_map_downloads: bool = False):
        """互動式執行（讓 agent 逐步操作）"""
        self.print_status()
        
        stage = self.state.get("stage", "init")
        
        # If we already have videos (e.g., resumed from downloads_manifest), skip Step 1/2.
        if self.state.get("sora_completed"):
            self.state["stage"] = "sora_completed"
            self.save_state()
            self.step3_qc_check()
            return "qc_pending"

        if stage == "init" or not self.state.get("prompts_generated"):
            self.step1_generate_prompts()
            self.step2_submit_sora(download_dir=download_dir, watch_downloads=watch_downloads, since_minutes=since_minutes, interactive_map_downloads=interactive_map_downloads)
            return "prompts_ready"
        
        elif stage in ["prompts_ready", "sora_pending"]:
            # 檢查是否有影片了
            videos = list(self.raw_dir.glob("shot_*.mp4"))
            if videos:
                self.state["sora_completed"] = True
                self.state["stage"] = "sora_completed"
                self.save_state()
                self.step3_qc_check()
                return "qc_pending"

            # 若提供 download_dir，嘗試自動接住下載
            if download_dir:
                try:
                    count = len(self.project.get("shots", [])) or 3
                    dl_dir = Path(os.path.expanduser(download_dir)).resolve()
                    if watch_downloads:
                        _dl_watch_mode(
                            dl_dir,
                            self.raw_dir,
                            count=count,
                            start_index=1,
                            overwrite=True,
                            since_ts=float(self.state.get("download_start_ts") or 0) or None,
                            manifest_path=(self.logs_dir / "downloads_manifest.json"),
                        )
                    else:
                        base_ts = float(self.state.get("download_start_ts") or 0) or None
                        _dl_scan_mode(dl_dir, self.raw_dir, count=count, start_index=1, since_minutes=since_minutes, overwrite=True, since_ts=base_ts, interactive_map=interactive_map_downloads, manifest_path=(self.logs_dir / "downloads_manifest.json"))

                    videos2 = list(self.raw_dir.glob("shot_*.mp4"))
                    if videos2:
                        self.state["sora_completed"] = True
                        self.state["stage"] = "sora_completed"
                        self.save_state()
                        self.step3_qc_check()
                        return "qc_pending"
                except Exception as e:
                    print(f"⚠️ download_dir 自動接住失敗：{e}")

            print("\n⏳ 等待 Sora 生成完成...")
            print(f"   下載後請將影片放入: {self.raw_dir}/")
            if download_dir:
                print(f"   或我會從 download_dir 接住：{download_dir}")
            return "sora_pending"
        
        elif stage in ["sora_completed", "qc_pending"]:
            print("\n⏳ 品控尚未完成，請完成品控後再拼接。")
            return "qc_pending"
        
        elif stage == "completed":
            print("\n✅ 專案已完成！")
            print(f"📁 最終輸出: {self.state.get('output_path', 'N/A')}")
            return "completed"
        
        return stage

def main():
    if len(sys.argv) < 2:
        print("Usage: python full_pipeline.py <project.yaml> [--workspace <dir>] [--step <N>] [--auto-pass] [--force-assemble] ")
        print("                                 [--download-dir <dir>] [--watch-downloads] [--since-minutes N] [--interactive-map-downloads]")
        print("                                 [--resume-from-downloads-manifest [path]]")
        print("\nSteps:")
        print("  1: Generate prompts")
        print("  2: Submit to Sora (manual UI; optional download watcher)")
        print("  3: QC check (needs agent + vision)")
        print("  4: Assemble final video")
        print("\nExamples:")
        print("  python full_pipeline.py project.yaml")
        print("  python full_pipeline.py project.yaml --download-dir ~/Downloads --since-minutes 180")
        print("  python full_pipeline.py project.yaml --step 2 --download-dir ~/Downloads --watch-downloads")
        print("  python full_pipeline.py project.yaml --step 3 --auto-pass")
        print("  python full_pipeline.py project.yaml --step 4 --force-assemble")
        sys.exit(1)

    project_yaml = sys.argv[1]
    workspace = None
    step = None
    auto_pass = "--auto-pass" in sys.argv
    force_assemble = "--force-assemble" in sys.argv

    download_dir = None
    watch_downloads = "--watch-downloads" in sys.argv
    interactive_map_downloads = "--interactive-map-downloads" in sys.argv
    since_minutes = 90

    provider = "sora_ui"
    if "--provider" in sys.argv:
        idx = sys.argv.index("--provider")
        if idx + 1 < len(sys.argv):
            provider = sys.argv[idx + 1]

    resume_manifest = None
    if "--resume-from-downloads-manifest" in sys.argv:
        idx = sys.argv.index("--resume-from-downloads-manifest")
        # optional path argument
        if idx + 1 < len(sys.argv) and not sys.argv[idx + 1].startswith("--"):
            resume_manifest = sys.argv[idx + 1]
        else:
            resume_manifest = "__DEFAULT__"

    if "--workspace" in sys.argv:
        idx = sys.argv.index("--workspace")
        if idx + 1 < len(sys.argv):
            workspace = sys.argv[idx + 1]

    if "--step" in sys.argv:
        idx = sys.argv.index("--step")
        if idx + 1 < len(sys.argv):
            step = int(sys.argv[idx + 1])

    if "--download-dir" in sys.argv:
        idx = sys.argv.index("--download-dir")
        if idx + 1 < len(sys.argv):
            download_dir = sys.argv[idx + 1]

    if "--since-minutes" in sys.argv:
        idx = sys.argv.index("--since-minutes")
        if idx + 1 < len(sys.argv):
            since_minutes = int(sys.argv[idx + 1])

    factory = SoraFactory(project_yaml, workspace)
    factory.provider = provider

    # Optional: resume from downloads manifest to avoid relying on Downloads directory.
    if resume_manifest is not None:
        import json as _json
        if resume_manifest == "__DEFAULT__":
            manifest_path = factory.logs_dir / "downloads_manifest.json"
        else:
            manifest_path = Path(os.path.expanduser(resume_manifest)).resolve()

        if not manifest_path.exists():
            raise SystemExit(f"downloads manifest not found: {manifest_path}")

        data = _json.loads(manifest_path.read_text(encoding="utf-8"))
        moved = data.get("moved") if isinstance(data, dict) else None
        if not isinstance(moved, list) or not moved:
            raise SystemExit(f"invalid manifest (no moved entries): {manifest_path}")

        missing = []
        for entry in moved:
            dest = entry.get("dest_path")
            if dest and not Path(dest).exists():
                missing.append(dest)

        if missing:
            raise SystemExit("missing dest files from manifest:\n- " + "\n- ".join(missing))

        # Mark pipeline as completed up to Sora stage.
        factory.state["prompts_generated"] = True
        factory.state["sora_submitted"] = True
        factory.state["sora_completed"] = True
        factory.state["stage"] = "sora_completed"
        factory.state["download_start_ts"] = data.get("since_ts") or factory.state.get("download_start_ts")
        factory.save_state()
        print(f"✅ resumed from downloads manifest: {manifest_path}")

    if step:
        if step == 1:
            factory.step1_generate_prompts()
        elif step == 2:
            factory.step2_submit_sora(download_dir=download_dir, watch_downloads=watch_downloads, since_minutes=since_minutes, interactive_map_downloads=interactive_map_downloads)
        elif step == 3:
            factory.step3_qc_check(auto_pass=auto_pass)
        elif step == 4:
            factory.step4_assemble(force=force_assemble)
    else:
        factory.run_interactive(download_dir=download_dir, watch_downloads=watch_downloads, since_minutes=since_minutes, interactive_map_downloads=interactive_map_downloads)

if __name__ == "__main__":
    main()
