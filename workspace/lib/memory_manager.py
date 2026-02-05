"""
Memory Manager - 記憶管理模組
萃取自 thinker-monorepo/thinker-cli/core/memory.py

負責載入、解析、更新、封存 markdown 格式的記憶檔案
適用於 AI Agent 的記憶持久化
"""

import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional


class MemoryManager:
    """記憶管理器 - 處理 markdown 格式的記憶檔案"""
    
    def __init__(self, memory_file: str):
        """
        初始化記憶管理器
        
        Args:
            memory_file: 記憶檔案路徑 (markdown格式)
        """
        self.memory_file = memory_file
        self.user_id = self._extract_user_id()
        self.short_term_memory: List[str] = []
        self.long_term_memory: List[str] = []
        self._load_and_parse_memory()
    
    def _extract_user_id(self) -> str:
        """從檔案路徑中提取使用者ID"""
        file_stem = Path(self.memory_file).stem
        if '_' in file_stem:
            return file_stem.split('_')[-1]
        return file_stem
    
    def _load_and_parse_memory(self):
        """載入並解析記憶檔案"""
        if not os.path.exists(self.memory_file):
            self._create_empty_memory_file()
            return
            
        content = self.load_memory()
        self._parse_memory_sections(content)
    
    def _create_empty_memory_file(self):
        """建立空白記憶檔案"""
        template = f"""# {self.user_id.title()} Memory Log

## 短期記憶 (Short-term Memory)

### {datetime.now().strftime('%Y-%m-%d')}
- 記憶檔案已建立

## 長期記憶 (Long-term Memory)

### 基本資訊
- 使用者ID: {self.user_id}
"""
        os.makedirs(os.path.dirname(self.memory_file) or '.', exist_ok=True)
        with open(self.memory_file, 'w', encoding='utf-8') as f:
            f.write(template)
    
    def load_memory(self) -> str:
        """載入記憶檔案內容"""
        try:
            with open(self.memory_file, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return ""
        except Exception as e:
            print(f"載入記憶檔案失敗: {e}")
            return ""
    
    def _parse_memory_sections(self, content: str):
        """解析記憶內容為短期和長期記憶"""
        # 解析短期記憶
        short_term_pattern = r'## 短期記憶.*?(?=## 長期記憶|$)'
        short_term_match = re.search(short_term_pattern, content, re.DOTALL)
        if short_term_match:
            self.short_term_memory = self._extract_memory_items(short_term_match.group())
        
        # 解析長期記憶
        long_term_pattern = r'## 長期記憶.*?(?=\n## [^長]|$)'
        long_term_match = re.search(long_term_pattern, content, re.DOTALL)
        if long_term_match:
            self.long_term_memory = self._extract_memory_items(long_term_match.group())
    
    def _extract_memory_items(self, section_content: str) -> List[str]:
        """從記憶區段中提取條目"""
        lines = section_content.split('\n')
        items = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('- '):
                items.append(line)
            elif line.startswith('### '):
                items.append(line)
        
        return items
    
    def get_short_term_memory(self) -> List[str]:
        """取得短期記憶"""
        return self.short_term_memory
    
    def get_long_term_memory(self) -> List[str]:
        """取得長期記憶"""
        return self.long_term_memory
    
    def add_memory_entry(self, entry: str, memory_type: str = "short_term"):
        """
        新增記憶條目
        
        Args:
            entry: 記憶條目內容
            memory_type: 記憶類型 ("short_term" 或 "long_term")
        """
        if memory_type == "short_term":
            self.short_term_memory.append(entry)
        elif memory_type == "long_term":
            self.long_term_memory.append(entry)
        
        self.save_memory()
    
    def save_memory(self):
        """儲存記憶到檔案"""
        content = self._build_memory_content()
        
        try:
            with open(self.memory_file, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception as e:
            print(f"儲存記憶檔案失敗: {e}")
    
    def _build_memory_content(self) -> str:
        """建構記憶檔案內容"""
        short_term_content = "\n## 短期記憶 (Short-term Memory)\n" + "\n".join(self.short_term_memory)
        long_term_content = "\n## 長期記憶 (Long-term Memory)\n" + "\n".join(self.long_term_memory)
        
        return f"# {self.user_id.title()} Memory Log\n\n{short_term_content}\n\n{long_term_content}\n"
    
    def should_archive(self, memory_size: int = None, entry_count: int = None) -> bool:
        """
        判斷是否應該封存記憶
        
        Args:
            memory_size: 記憶檔案大小 (bytes)
            entry_count: 記憶條目數量
            
        Returns:
            是否應該封存
        """
        if memory_size is None:
            memory_size = len(self.load_memory().encode('utf-8'))
        
        if entry_count is None:
            entry_count = len(self.short_term_memory) + len(self.long_term_memory)
        
        # 封存條件
        size_threshold = 4000  # 4KB
        count_threshold = 100
        
        return memory_size > size_threshold or entry_count > count_threshold
    
    def archive_old_memories(self, days_threshold: int = 7, archive_dir: str = "archived"):
        """
        封存舊記憶
        
        Args:
            days_threshold: 天數閾值，超過此天數的記憶會被封存
            archive_dir: 封存目錄
        """
        archive_path = Path(archive_dir)
        archive_path.mkdir(exist_ok=True)
        
        current_date = datetime.now()
        
        archive_file = archive_path / f"{self.user_id}_archive_{current_date.strftime('%Y%m%d')}.md"
        
        with open(archive_file, 'w', encoding='utf-8') as f:
            f.write(f"# {self.user_id.title()} Archived Memory\n")
            f.write(f"Archived on: {current_date.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """取得記憶統計資訊"""
        content = self.load_memory()
        
        return {
            'total_size': len(content.encode('utf-8')),
            'short_term_count': len(self.short_term_memory),
            'long_term_count': len(self.long_term_memory),
            'last_updated': datetime.now().isoformat(),
            'user_id': self.user_id
        }


if __name__ == '__main__':
    # 使用範例
    manager = MemoryManager("test_memory.md")
    print(f"Stats: {manager.get_memory_stats()}")
    manager.add_memory_entry("- **14:30** - 測試記憶功能")
    print(f"Short-term: {manager.get_short_term_memory()}")
