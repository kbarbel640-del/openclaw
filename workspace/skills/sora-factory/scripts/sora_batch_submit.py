#!/usr/bin/env python3
"""
Sora Batch Submit
批次提交 Sora 生成任務，每次最多 3 並行
透過 Moltbot browser 工具操作

使用方式（由 agent 呼叫）：
可使用手動流程或啟用 --auto（CDP）模式
"""

import yaml
import json
import time
import asyncio
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class SoraTask:
    shot_id: int
    prompt_file: str
    prompt_text: str
    status: TaskStatus = TaskStatus.PENDING
    sora_id: Optional[str] = None
    output_url: Optional[str] = None
    output_path: Optional[str] = None
    retry_count: int = 0

class SoraBatchManager:
    """
    Sora 批次管理器
    
    工作流程：
    1. 載入所有 prompt 檔案
    2. 每次提交 3 個到 Sora
    3. 輪詢檢查狀態
    4. 完成的下載，失敗的重試
    5. 繼續提交下一批
    """
    
    MAX_CONCURRENT = 3
    POLL_INTERVAL = 60  # 秒
    MAX_RETRIES = 2
    
    def __init__(self, shots_dir: str, output_dir: str = "output/raw"):
        self.shots_dir = Path(shots_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.tasks: List[SoraTask] = []
        self.state_file = self.output_dir / "batch_state.json"
    
    def load_prompts(self):
        """載入所有 prompt 檔案"""
        manifest_path = self.shots_dir / "manifest.yaml"
        
        if manifest_path.exists():
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = yaml.safe_load(f)
            
            for shot in manifest.get('shots', []):
                prompt_file = self.shots_dir / shot['file']
                if prompt_file.exists():
                    with open(prompt_file, 'r', encoding='utf-8') as f:
                        prompt_text = f.read()
                    
                    self.tasks.append(SoraTask(
                        shot_id=shot['id'],
                        prompt_file=str(prompt_file),
                        prompt_text=prompt_text
                    ))
        else:
            # 沒有 manifest，直接掃描 txt 檔案
            for txt_file in sorted(self.shots_dir.glob("shot_*.txt")):
                shot_id = int(txt_file.stem.split('_')[1])
                with open(txt_file, 'r', encoding='utf-8') as f:
                    prompt_text = f.read()
                
                self.tasks.append(SoraTask(
                    shot_id=shot_id,
                    prompt_file=str(txt_file),
                    prompt_text=prompt_text
                ))
        
        print(f"📋 載入 {len(self.tasks)} 個生成任務")
    
    def save_state(self):
        """保存當前狀態（斷點續傳用）"""
        state = {
            'tasks': [
                {
                    'shot_id': t.shot_id,
                    'prompt_file': t.prompt_file,
                    'status': t.status.value,
                    'sora_id': t.sora_id,
                    'output_url': t.output_url,
                    'output_path': t.output_path,
                    'retry_count': t.retry_count
                }
                for t in self.tasks
            ],
            'updated_at': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
    
    def _load_prompt_text(self, prompt_file: str) -> str:
        path = Path(prompt_file)
        if not path.exists():
            path = self.shots_dir / Path(prompt_file).name
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        return ""

    def load_state(self) -> bool:
        """載入保存的狀態（斷點續傳）"""
        if not self.state_file.exists():
            return False
        
        with open(self.state_file, 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        # 重建任務列表
        self.tasks = []
        for t in state.get('tasks', []):
            task = SoraTask(
                shot_id=t['shot_id'],
                prompt_file=t['prompt_file'],
                prompt_text=self._load_prompt_text(t['prompt_file']),
                status=TaskStatus(t['status']),
                sora_id=t.get('sora_id'),
                output_url=t.get('output_url'),
                output_path=t.get('output_path'),
                retry_count=t.get('retry_count', 0)
            )
            self.tasks.append(task)
        
        print(f"🔄 從斷點恢復 {len(self.tasks)} 個任務")
        return True
    
    def get_pending_tasks(self, limit: int = 3) -> List[SoraTask]:
        """取得待處理的任務"""
        pending = [t for t in self.tasks if t.status == TaskStatus.PENDING]
        return pending[:limit]
    
    def get_active_tasks(self) -> List[SoraTask]:
        """取得正在生成的任務"""
        return [t for t in self.tasks if t.status in [TaskStatus.QUEUED, TaskStatus.GENERATING]]
    
    def get_completed_count(self) -> int:
        """取得已完成數量"""
        return len([t for t in self.tasks if t.status == TaskStatus.COMPLETED])
    
    def get_failed_tasks(self) -> List[SoraTask]:
        """取得失敗的任務"""
        return [t for t in self.tasks if t.status == TaskStatus.FAILED]
    
    def print_status(self):
        """印出當前狀態"""
        status_counts = {}
        for t in self.tasks:
            status_counts[t.status.value] = status_counts.get(t.status.value, 0) + 1
        
        print("\n📊 批次狀態:")
        print(f"  ⏳ 待處理: {status_counts.get('pending', 0)}")
        print(f"  🔄 排隊中: {status_counts.get('queued', 0)}")
        print(f"  ⚡ 生成中: {status_counts.get('generating', 0)}")
        print(f"  ✅ 已完成: {status_counts.get('completed', 0)}")
        print(f"  ❌ 失敗: {status_counts.get('failed', 0)}")


def _status_matches_task(status: Dict[str, Any], task: SoraTask) -> bool:
    if status.get("shot_id") is not None:
        try:
            return int(status["shot_id"]) == task.shot_id
        except Exception:
            pass
    if status.get("id") and task.sora_id and status.get("id") == task.sora_id:
        return True
    title = status.get("title") or status.get("prompt") or ""
    if title and task.prompt_text:
        return task.prompt_text[:20] in title
    return False


def _normalize_status(value: str) -> TaskStatus:
    v = (value or "").lower()
    if "complete" in v or "done" in v:
        return TaskStatus.COMPLETED
    if "fail" in v or "error" in v:
        return TaskStatus.FAILED
    if "queue" in v:
        return TaskStatus.QUEUED
    return TaskStatus.GENERATING


async def _auto_run(manager: SoraBatchManager, config_path: str, auto_download: bool, capture_seconds: int, max_rounds: int):
    from sora_browser_driver import SoraBrowserDriver
    from download_manager import download_urls

    driver = SoraBrowserDriver.from_config_file(config_path)
    rounds = 0
    captured_path = manager.output_dir / "captured_urls.json"

    while rounds < max_rounds:
        rounds += 1
        pending = manager.get_pending_tasks(limit=manager.MAX_CONCURRENT)
        if not pending and not manager.get_active_tasks():
            break

        # Submit pending tasks
        for task in pending:
            ok = await driver.submit_prompt(task.prompt_text)
            task.status = TaskStatus.QUEUED if ok else TaskStatus.FAILED
            manager.save_state()

        # Poll status from library
        statuses = await driver.poll_status()
        if statuses:
            for status in statuses:
                for task in manager.tasks:
                    if _status_matches_task(status, task):
                        task.status = _normalize_status(status.get("status", "generating"))
                        task.sora_id = status.get("id") or task.sora_id
            manager.save_state()

        # Capture URLs while downloads happen (best effort)
        urls = await driver.capture_urls(seconds=capture_seconds)
        if urls:
            existing = []
            if captured_path.exists():
                with open(captured_path, "r", encoding="utf-8") as f:
                    existing = json.load(f).get("urls", [])
            merged = list(dict.fromkeys(existing + urls))
            # keep only recent URLs to avoid downloading huge history
            if len(merged) > 5:
                merged = merged[-5:]
            with open(captured_path, "w", encoding="utf-8") as f:
                json.dump({"urls": merged}, f, ensure_ascii=False, indent=2)

            if auto_download:
                await driver.download_urls(merged, str(manager.output_dir))

        manager.print_status()
        time.sleep(driver.config.poll_interval_sec)

# =============================================================================
# Agent 操作指南（這部分是給 agent 看的，不是程式碼）
# =============================================================================

AGENT_INSTRUCTIONS = """
## 🤖 Agent 執行流程

### 1. 初始化
```python
manager = SoraBatchManager("shots/")
manager.load_prompts()  # 或 manager.load_state() 恢復
```

### 2. 提交任務（使用 browser 工具）

對於每個 pending 任務：
```
1. browser navigate to https://sora.com
2. browser snapshot 找到輸入框
3. browser act type prompt_text
4. browser act click "Generate"
5. 記錄任務 ID（從 URL 或頁面提取）
6. task.status = QUEUED
7. task.sora_id = extracted_id
```

### 3. 輪詢狀態

```
每 60 秒：
1. browser navigate to https://sora.com/library
2. browser snapshot 讀取所有任務狀態
3. 對於每個 active task：
   - 找到對應的生成任務
   - 更新狀態 (generating/completed/failed)
   - 如果 completed，提取下載 URL
```

### 4. 下載完成的影片

```
對於每個 completed 且沒下載的任務：
1. browser act click download button
2. 等待下載完成
3. 移動到 output/raw/shot_XXX.mp4
4. task.output_path = path
```

### 5. 處理失敗

```
對於每個 failed 任務：
if task.retry_count < MAX_RETRIES:
    task.status = PENDING
    task.retry_count += 1
else:
    保持 FAILED 狀態
```

### 6. 循環直到完成

```
while pending or active:
    submit_batch(3)
    wait(60)
    poll_status()
    download_completed()
    handle_failures()
    save_state()
```
"""

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python sora_batch_submit.py <shots_dir> [--output <dir>] [--resume] [--auto] [--api]")
        print("       --config <path> --capture-seconds <n> --auto-download --max-rounds <n>")
        print("\n這個腳本提供批次管理邏輯，實際操作需要 agent 使用 browser 工具執行")
        print("\n" + AGENT_INSTRUCTIONS)
        sys.exit(1)
    
    shots_dir = sys.argv[1]
    output_dir = "output/raw"
    resume = "--resume" in sys.argv
    auto = "--auto" in sys.argv
    use_api = "--api" in sys.argv
    auto_download = "--auto-download" in sys.argv
    capture_seconds = 120
    max_rounds = 999
    config_path = str(Path(__file__).parent.parent / "assets" / "sora_browser_config.yaml")
    
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]
    if "--config" in sys.argv:
        idx = sys.argv.index("--config")
        if idx + 1 < len(sys.argv):
            config_path = sys.argv[idx + 1]
    if "--capture-seconds" in sys.argv:
        idx = sys.argv.index("--capture-seconds")
        if idx + 1 < len(sys.argv):
            capture_seconds = int(sys.argv[idx + 1])
    if "--max-rounds" in sys.argv:
        idx = sys.argv.index("--max-rounds")
        if idx + 1 < len(sys.argv):
            max_rounds = int(sys.argv[idx + 1])
    
    manager = SoraBatchManager(shots_dir, output_dir)
    
    if resume and manager.load_state():
        print("從斷點恢復")
    else:
        manager.load_prompts()
    
    manager.print_status()

    if use_api:
        print("🧪 API 模式啟動（OpenAI Sora API）")
        from sora_api_batch import run as api_run
        api_run(shots_dir, output_dir, model="sora-2", seconds="4", size="1280x720", poll_sec=10)
        return

    if auto:
        print("🤖 自動模式啟動（CDP + Moltbot browser）")
        asyncio.run(_auto_run(manager, config_path, auto_download, capture_seconds, max_rounds))
        return
    
    # 輸出待執行的任務
    pending = manager.get_pending_tasks()
    if pending:
        print(f"\n📝 下一批待提交 ({len(pending)} 個):")
        for task in pending:
            print(f"  - Shot {task.shot_id}: {task.prompt_file}")
            print(f"    Prompt 前 100 字: {task.prompt_text[:100]}...")
    
    print("\n⚠️ 請使用 browser 工具手動執行 Sora 提交流程")
    print("   參考上方 AGENT_INSTRUCTIONS")

if __name__ == "__main__":
    main()
