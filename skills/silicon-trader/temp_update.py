from scan_memory import ScanMemory, ScanRecord
from datetime import datetime

memory = ScanMemory()
record = ScanRecord(
    timestamp="2026-02-06 16:15:00",
    symbol="XAUUSD",
    h1_trend="BEARISH",
    h1_bias="看空(短多)",
    h1_key_levels={"resistance_major": 4900, "support_minor": 4852, "sweep_low": 4802},
    m15_zone="DISCOUNT",
    m15_has_entry=False,
    expectation="London Low被扫，H1 Bull FVG生效，预期反弹修正",
    expected_price_action="M15在4852企稳，反弹测试4887-4900阻力区",
    invalidation_price=4802.0,
    m15_entry_type="long_counter_trend",
    is_chart_verified=True
)
memory.add_record(record)
