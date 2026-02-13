"""
Scan Memory - 扫描记忆系统
记录每次扫描的判断，用于下次核实

Author: Eden for Alpha Quant Pro
Version: 1.0.0
"""

import json
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List


@dataclass
class ScanRecord:
    """单次扫描记录"""
    timestamp: str
    symbol: str
    
    # H1 判断
    h1_trend: str  # BULLISH / BEARISH / RANGING
    h1_bias: str   # "看多" / "看空" / "观望"
    h1_key_levels: Dict[str, float]  # {"resistance": 5000, "support": 4700}
    
    # M15 判断
    m15_zone: str  # PREMIUM / DISCOUNT
    m15_has_entry: bool
    
    # 预期
    expectation: str  # 对下次的预期描述
    expected_price_action: str  # "等待回抽到4900-5000" 等
    invalidation_price: Optional[float] = None  # 失效价位 (结构破坏点)
    expiry_hours: int = 4  # 逻辑有效期 (默认4小时)
    
    # 可选字段
    m15_entry_type: Optional[str] = None  # "long" / "short" / None
    is_chart_verified: bool = False  # 必须为True才能保存
    was_verified: bool = False
    verification_result: Optional[str] = None  # "符合预期" / "不符合预期"
    verification_notes: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def to_message(self) -> str:
        lines = [
            f"📝 **扫描记录** | {self.timestamp}",
            f"品种: {self.symbol}",
            "",
            "**H1 判断:**",
            f"• 趋势: {self.h1_trend}",
            f"• 偏向: {self.h1_bias}",
        ]
        
        if self.h1_key_levels:
            for level_name, price in self.h1_key_levels.items():
                lines.append(f"• {level_name}: {price:.2f}")
        
        lines.extend([
            "",
            "**M15 判断:**",
            f"• 区域: {self.m15_zone}",
            f"• 有入场: {'是' if self.m15_has_entry else '否'}",
        ])
        
        if self.m15_entry_type:
            lines.append(f"• 入场类型: {self.m15_entry_type}")
        
        lines.extend([
            "",
            "**预期:**",
            f"{self.expectation}",
            f"预期走势: {self.expected_price_action}",
        ])
        
        if self.was_verified:
            lines.extend([
                "",
                "**核实结果:**",
                f"结果: {self.verification_result}",
                f"备注: {self.verification_notes}",
            ])
        
        return "\n".join(lines)


class ScanMemory:
    """扫描记忆管理器"""
    
    def __init__(self, memory_dir: str = None):
        if memory_dir:
            self.memory_dir = Path(memory_dir)
        else:
            self.memory_dir = Path.home() / ".openclaw" / "workspace" / "smc" / "scan_memory"
        
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.records_file = self.memory_dir / "scan_records.json"
        self.records: List[ScanRecord] = []
        self._load()
    
    def _load(self):
        """加载记录"""
        if self.records_file.exists():
            with open(self.records_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.records = [ScanRecord(**r) for r in data]
    
    def _save(self):
        """保存记录"""
        with open(self.records_file, 'w', encoding='utf-8') as f:
            json.dump([r.to_dict() for r in self.records], f, ensure_ascii=False, indent=2)
    
    def add_record(self, record: ScanRecord):
        """添加新记录"""
        self.records.append(record)
        self._save()
        print(f"✅ 记录已保存: {record.timestamp}")
    
    def get_last_record(self, symbol: str = None) -> Optional[ScanRecord]:
        """获取上次记录"""
        if symbol:
            filtered = [r for r in self.records if r.symbol == symbol]
            return filtered[-1] if filtered else None
        return self.records[-1] if self.records else None
    
    def get_unverified_records(self, symbol: str = None) -> List[ScanRecord]:
        """获取未核实的记录"""
        records = self.records
        if symbol:
            records = [r for r in records if r.symbol == symbol]
        return [r for r in records if not r.was_verified]
    
    def verify_record(self, record_timestamp: str, result: str, notes: str = ""):
        """核实记录"""
        for record in self.records:
            if record.timestamp == record_timestamp:
                record.was_verified = True
                record.verification_result = result
                record.verification_notes = notes
                self._save()
                print(f"✅ 记录已核实: {result}")
                return True
        return False
    
    def compare_with_last(self, current_price: float, symbol: str = "XAUUSD") -> Dict:
        """与上次记录对比"""
        last = self.get_last_record(symbol)
        if not last:
            return {"status": "no_previous", "message": "没有上次记录"}
        
        result = {
            "status": "compared",
            "last_record": last,
            "last_expectation": last.expectation,
            "last_expected_action": last.expected_price_action,
            "current_price": current_price,
        }
        
        # 简单判断是否符合预期（后续可以更复杂）
        # 这里只是示例逻辑
        if "回抽" in last.expected_price_action or "反弹" in last.expected_price_action:
            # 预期是反弹
            if last.h1_key_levels:
                resistance = last.h1_key_levels.get("resistance", 0)
                if current_price > resistance * 0.98:  # 接近阻力位
                    result["matches_expectation"] = True
                    result["message"] = "价格如预期反弹接近阻力位"
                else:
                    result["matches_expectation"] = False
                    result["message"] = "价格未如预期反弹"
        else:
            result["matches_expectation"] = None
            result["message"] = "需要人工判断"
        
        return result
    
    def get_recent_records(self, count: int = 5, symbol: str = None) -> List[ScanRecord]:
        """获取最近N条记录"""
        records = self.records
        if symbol:
            records = [r for r in records if r.symbol == symbol]
        return records[-count:]


# 测试
if __name__ == "__main__":
    memory = ScanMemory()
    
    # 创建测试记录
    record = ScanRecord(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        symbol="XAUUSD",
        h1_trend="BEARISH",
        h1_bias="看空",
        h1_key_levels={"resistance": 5000, "support": 4700},
        m15_zone="DISCOUNT",
        m15_has_entry=False,
        expectation="等待价格反弹到4900-5000区域的Bear OB再找空头入场",
        expected_price_action="价格回抽到4900-5000",
    )
    
    memory.add_record(record)
    print(record.to_message())
