"""
Trading Memory - 交易记忆管理器
管理交易日志、复盘记录和经验教训

Author: Eden for Alpha Quant Pro
Version: 1.0.0
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class TradeDirection(Enum):
    LONG = "Long"
    SHORT = "Short"


class TradeStatus(Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


@dataclass
class Trade:
    """单笔交易记录"""
    id: str
    symbol: str
    direction: str  # Long/Short
    entry_time: str
    entry_price: float
    exit_time: Optional[str] = None
    exit_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    size: float = 0.01
    pnl_pct: Optional[float] = None
    pnl_usd: Optional[float] = None
    status: str = "open"
    
    # 分析信息
    chart_path: Optional[str] = None
    timeframe: str = "M15"
    strategy: str = "SMC"
    signal_reason: str = ""
    
    # 复盘
    review: str = ""
    lessons: List[str] = None
    rating: int = 0  # 1-5 自我评分
    
    # 进化数据 (New)
    confidence_score: int = 0  # 1-10 信心分
    failure_tags: List[str] = None  # e.g., ["news_spike", "asian_reversal"]
    
    def __post_init__(self):
        if self.lessons is None:
            self.lessons = []
        if self.failure_tags is None:
            self.failure_tags = []
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def to_markdown(self) -> str:
        """生成Markdown格式记录"""
        status_emoji = "🟢" if self.pnl_pct and self.pnl_pct > 0 else "🔴" if self.pnl_pct and self.pnl_pct < 0 else "⚪"
        
        lines = [
            f"## {status_emoji} {self.symbol} {self.direction}",
            f"- **ID**: {self.id}",
            f"- **时间周期**: {self.timeframe}",
            f"- **策略**: {self.strategy}",
            f"- **入场时间**: {self.entry_time}",
            f"- **入场价格**: {self.entry_price}",
        ]
        
        if self.exit_time:
            lines.append(f"- **出场时间**: {self.exit_time}")
        if self.exit_price:
            lines.append(f"- **出场价格**: {self.exit_price}")
        if self.stop_loss:
            lines.append(f"- **止损**: {self.stop_loss}")
        if self.take_profit:
            lines.append(f"- **止盈**: {self.take_profit}")
        if self.pnl_pct is not None:
            pnl_str = f"+{self.pnl_pct:.2f}%" if self.pnl_pct > 0 else f"{self.pnl_pct:.2f}%"
            lines.append(f"- **盈亏**: {pnl_str}")
        if self.chart_path:
            lines.append(f"- **图表**: ![chart]({self.chart_path})")
        if self.signal_reason:
            lines.append(f"- **信号依据**: {self.signal_reason}")
        if self.review:
            lines.append(f"\n### 复盘\n{self.review}")
        if self.lessons:
            lines.append("\n### 教训")
            for lesson in self.lessons:
                lines.append(f"- {lesson}")
        if self.rating:
            lines.append(f"\n**自评**: {'⭐' * self.rating}")
        
        lines.append("")
        return "\n".join(lines)


@dataclass
class DailyStats:
    """每日统计"""
    date: str
    total_trades: int = 0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    total_pnl_pct: float = 0.0
    total_pnl_usd: float = 0.0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    best_trade: Optional[str] = None
    worst_trade: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)


class TradingMemory:
    """交易记忆管理器"""
    
    def __init__(self, memory_dir: str = None):
        if memory_dir:
            self.memory_dir = Path(memory_dir)
        else:
            self.memory_dir = Path.home() / ".openclaw" / "workspace" / "memory" / "trading"
        
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        (self.memory_dir / "weekly").mkdir(exist_ok=True)
        
        self.trades_file = self.memory_dir / "trades.json"
        self.stats_file = self.memory_dir / "strategy-stats.json"
        
        self.trades: List[Trade] = []
        self._load_trades()
    
    def _load_trades(self):
        """加载交易记录"""
        if self.trades_file.exists():
            with open(self.trades_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.trades = [Trade(**t) for t in data]
    
    def _save_trades(self):
        """保存交易记录"""
        with open(self.trades_file, 'w', encoding='utf-8') as f:
            json.dump([t.to_dict() for t in self.trades], f, ensure_ascii=False, indent=2)
    
    def generate_trade_id(self) -> str:
        """生成交易ID"""
        now = datetime.now()
        count = len([t for t in self.trades if t.entry_time.startswith(now.strftime("%Y-%m-%d"))]) + 1
        return f"{now.strftime('%Y%m%d')}_{count:03d}"
    
    def add_trade(self, trade: Trade) -> str:
        """添加交易记录"""
        if not trade.id:
            trade.id = self.generate_trade_id()
        
        self.trades.append(trade)
        self._save_trades()
        self._update_daily_log(trade)
        
        return trade.id
    
    def update_trade(self, trade_id: str, **kwargs) -> bool:
        """更新交易记录"""
        for trade in self.trades:
            if trade.id == trade_id:
                for key, value in kwargs.items():
                    if hasattr(trade, key):
                        setattr(trade, key, value)
                
                # 计算盈亏
                if trade.exit_price and trade.entry_price:
                    if trade.direction == "Long":
                        trade.pnl_pct = ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100
                    else:
                        trade.pnl_pct = ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100
                    trade.status = "closed"
                
                self._save_trades()
                self._update_daily_log(trade)
                return True
        
        return False
    
    def close_trade(self, trade_id: str, exit_price: float, exit_time: str = None, review: str = "") -> bool:
        """平仓交易"""
        return self.update_trade(
            trade_id,
            exit_price=exit_price,
            exit_time=exit_time or datetime.now().isoformat(),
            review=review,
            status="closed"
        )
    
    def get_trade(self, trade_id: str) -> Optional[Trade]:
        """获取单笔交易"""
        for trade in self.trades:
            if trade.id == trade_id:
                return trade
        return None
    
    def get_open_trades(self) -> List[Trade]:
        """获取所有未平仓交易"""
        return [t for t in self.trades if t.status == "open"]
    
    def get_trades_by_date(self, date: str) -> List[Trade]:
        """获取指定日期的交易"""
        return [t for t in self.trades if t.entry_time.startswith(date)]
    
    def get_trades_by_symbol(self, symbol: str) -> List[Trade]:
        """获取指定品种的交易"""
        return [t for t in self.trades if t.symbol == symbol]
    
    def _update_daily_log(self, trade: Trade):
        """更新每日日志文件"""
        date = trade.entry_time[:10]
        log_file = self.memory_dir / f"{date}.md"
        
        # 获取当日所有交易
        daily_trades = self.get_trades_by_date(date)
        
        # 计算统计
        stats = self.calculate_daily_stats(date)
        
        # 生成Markdown
        lines = [
            f"# 交易日志 - {date}",
            "",
            "## 📊 当日统计",
            f"- 总交易: {stats.total_trades}",
            f"- 胜/负/平: {stats.wins}/{stats.losses}/{stats.breakeven}",
            f"- 胜率: {stats.win_rate:.1f}%",
            f"- 总盈亏: {'+' if stats.total_pnl_pct > 0 else ''}{stats.total_pnl_pct:.2f}%",
            "",
            "---",
            "",
            "## 📝 交易记录",
            "",
        ]
        
        for t in daily_trades:
            lines.append(t.to_markdown())
        
        lines.append("---")
        lines.append(f"_Last updated: {datetime.now().strftime('%H:%M:%S')}_")
        
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
    
    def calculate_daily_stats(self, date: str) -> DailyStats:
        """计算每日统计"""
        trades = self.get_trades_by_date(date)
        closed_trades = [t for t in trades if t.status == "closed"]
        
        stats = DailyStats(date=date)
        stats.total_trades = len(trades)
        
        if not closed_trades:
            return stats
        
        wins = [t for t in closed_trades if t.pnl_pct and t.pnl_pct > 0]
        losses = [t for t in closed_trades if t.pnl_pct and t.pnl_pct < 0]
        breakeven = [t for t in closed_trades if t.pnl_pct == 0]
        
        stats.wins = len(wins)
        stats.losses = len(losses)
        stats.breakeven = len(breakeven)
        stats.total_pnl_pct = sum(t.pnl_pct for t in closed_trades if t.pnl_pct)
        
        if stats.wins + stats.losses > 0:
            stats.win_rate = (stats.wins / (stats.wins + stats.losses)) * 100
        
        if wins:
            stats.avg_win = sum(t.pnl_pct for t in wins) / len(wins)
            stats.best_trade = max(wins, key=lambda t: t.pnl_pct).id
        
        if losses:
            stats.avg_loss = sum(t.pnl_pct for t in losses) / len(losses)
            stats.worst_trade = min(losses, key=lambda t: t.pnl_pct).id
        
        return stats
    
    def generate_weekly_review(self, week_start: str = None) -> str:
        """生成周度复盘"""
        if week_start:
            start_date = datetime.strptime(week_start, "%Y-%m-%d")
        else:
            today = datetime.now()
            start_date = today - timedelta(days=today.weekday())
        
        end_date = start_date + timedelta(days=6)
        
        # 获取本周交易
        week_trades = []
        for t in self.trades:
            trade_date = datetime.fromisoformat(t.entry_time[:10])
            if start_date <= trade_date <= end_date:
                week_trades.append(t)
        
        closed_trades = [t for t in week_trades if t.status == "closed"]
        
        # 统计
        total = len(week_trades)
        wins = len([t for t in closed_trades if t.pnl_pct and t.pnl_pct > 0])
        losses = len([t for t in closed_trades if t.pnl_pct and t.pnl_pct < 0])
        total_pnl = sum(t.pnl_pct for t in closed_trades if t.pnl_pct)
        win_rate = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0
        
        # 按品种统计
        symbol_stats = {}
        for t in closed_trades:
            if t.symbol not in symbol_stats:
                symbol_stats[t.symbol] = {"trades": 0, "pnl": 0}
            symbol_stats[t.symbol]["trades"] += 1
            symbol_stats[t.symbol]["pnl"] += t.pnl_pct or 0
        
        # 生成报告
        week_num = start_date.isocalendar()[1]
        year = start_date.year
        
        lines = [
            f"# 周度复盘 - {year}年第{week_num}周",
            f"**周期**: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}",
            "",
            "## 📊 周度统计",
            f"- 总交易: {total}",
            f"- 胜/负: {wins}/{losses}",
            f"- 胜率: {win_rate:.1f}%",
            f"- 总盈亏: {'+' if total_pnl > 0 else ''}{total_pnl:.2f}%",
            "",
            "## 📈 品种表现",
        ]
        
        for symbol, data in symbol_stats.items():
            pnl = data['pnl']
            lines.append(f"- **{symbol}**: {data['trades']}笔, {'+' if pnl > 0 else ''}{pnl:.2f}%")
        
        lines.extend([
            "",
            "## 🔍 本周反思",
            "",
            "### 做得好的",
            "<!-- AI分析或手动填写 -->",
            "",
            "### 需要改进的",
            "<!-- AI分析或手动填写 -->",
            "",
            "### 下周计划",
            "<!-- AI建议或手动填写 -->",
            "",
            "---",
            f"_Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_"
        ])
        
        # 保存
        review_file = self.memory_dir / "weekly" / f"{year}-W{week_num:02d}.md"
        with open(review_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
        
        return "\n".join(lines)
    
    def detect_strategy_decay(self) -> Dict:
        """检测策略表现衰退"""
        if len(self.trades) < 20:
            return {"status": "insufficient_data", "message": "交易数据不足20笔，无法分析"}
        
        closed_trades = [t for t in self.trades if t.status == "closed" and t.pnl_pct is not None]
        if len(closed_trades) < 20:
            return {"status": "insufficient_data", "message": "已平仓交易不足20笔"}
        
        # 分成两半比较
        mid = len(closed_trades) // 2
        first_half = closed_trades[:mid]
        second_half = closed_trades[mid:]
        
        # 计算各半部分的表现
        def calc_metrics(trades):
            wins = len([t for t in trades if t.pnl_pct > 0])
            total = len(trades)
            win_rate = wins / total * 100 if total > 0 else 0
            avg_pnl = sum(t.pnl_pct for t in trades) / total if total > 0 else 0
            return {"win_rate": win_rate, "avg_pnl": avg_pnl, "count": total}
        
        first_metrics = calc_metrics(first_half)
        second_metrics = calc_metrics(second_half)
        
        # 衰退检测
        win_rate_change = second_metrics["win_rate"] - first_metrics["win_rate"]
        pnl_change = second_metrics["avg_pnl"] - first_metrics["avg_pnl"]
        
        is_decaying = win_rate_change < -10 or pnl_change < -0.5
        
        return {
            "status": "decay_detected" if is_decaying else "healthy",
            "first_half": first_metrics,
            "second_half": second_metrics,
            "win_rate_change": win_rate_change,
            "pnl_change": pnl_change,
            "recommendation": "考虑暂停交易并复盘策略" if is_decaying else "策略表现稳定，继续执行"
        }
    
    def add_lesson(self, lesson: str, source_trade: str = None):
        """添加经验教训"""
        lessons_file = self.memory_dir / "lessons-learned.md"
        
        with open(lessons_file, 'a', encoding='utf-8') as f:
            f.write(f"\n### {datetime.now().strftime('%Y-%m-%d')}: {lesson[:50]}...\n")
            if source_trade:
                f.write(f"- **来源交易**: {source_trade}\n")
            f.write(f"- **教训**: {lesson}\n")
            f.write("\n")


# 测试
if __name__ == "__main__":
    memory = TradingMemory()
    
    # 添加测试交易
    trade = Trade(
        id="",
        symbol="XAUUSD",
        direction="Long",
        entry_time=datetime.now().isoformat(),
        entry_price=2650.50,
        stop_loss=2645.00,
        take_profit=2665.00,
        size=0.1,
        timeframe="M15",
        strategy="SMC",
        signal_reason="M15 Bullish OB in Discount zone + H1 trend alignment"
    )
    
    trade_id = memory.add_trade(trade)
    print(f"添加交易: {trade_id}")
    
    # 模拟平仓
    memory.close_trade(
        trade_id,
        exit_price=2658.30,
        review="入场点位精准，但出场过早，错过了后续行情。下次可以用分批止盈。"
    )
    
    # 生成周度复盘
    review = memory.generate_weekly_review()
    print("\n周度复盘:")
    print(review)
    
    # 检测衰退
    decay = memory.detect_strategy_decay()
    print(f"\n策略状态: {decay['status']}")
