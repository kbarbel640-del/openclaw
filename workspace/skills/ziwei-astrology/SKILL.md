# 紫微斗數 Skill

紫微斗數命盤計算工具，萃取自 mingli-backend，可獨立運行。

## 功能

計算完整紫微斗數命盤，包含：

- **十二宮排列**：命宮、父母宮、福德宮、田宅宮、官祿宮、朋友宮、遷移宮、疾厄宮、財帛宮、子女宮、夫妻宮、兄弟宮
- **主星分布**：紫微星系（紫微、天機、太陽、武曲、天同、廉貞）+ 天府星系（天府、太陰、貪狼、巨門、天相、天梁、七殺、破軍）
- **輔星分布**：年系星（祿存、擎羊、陀羅、天魁、天鉞）、月系星（左輔、右弼、天馬）、時系星（文曲、文昌、天空、地劫、火星、鈴星）
- **四化星**：化祿、化權、化科、化忌
- **五行局**：水二局、木三局、金四局、土五局、火六局
- **運程資訊**：大限方向、起運歲數、小限起始

## 使用方式

### 命令行

```bash
# 陽曆輸入（自動轉農曆）
python calculate.py --birthday 1990-01-15 --hour 13 --gender male

# 農曆輸入
python calculate.py --birthday 1976-06-20 --hour 5 --gender female --lunar

# 輸出 JSON 格式
python calculate.py --birthday 1990-01-15 --hour 13 --gender male --json
```

### 參數說明

| 參數 | 簡寫 | 必填 | 說明 |
|------|------|------|------|
| --birthday | -b | ✓ | 生日 YYYY-MM-DD |
| --hour | -H | ✓ | 出生時辰 0-23 |
| --gender | -g | ✓ | 性別 male/female/男/女 |
| --lunar | -l | | 輸入為農曆（預設陽曆） |
| --json | -j | | 輸出 JSON 格式 |

### Python 調用

```python
from calculate import calculate_chart, print_chart_summary

result = calculate_chart(
    gender='male',      # 或 '男'
    year=1990,
    month=1,
    day=15,
    hour=13,
    is_lunar=False      # 陽曆輸入
)

# 印出摘要
print_chart_summary(result)

# 或取得 JSON
import json
print(json.dumps(result, ensure_ascii=False, indent=2))
```

## 輸出格式

```json
{
  "birth_data": {
    "gender": "男",
    "solar_date": "1990-01-15",
    "lunar_date": "1989-12-19",
    "birth_hour": 13,
    "hour_branch": "未"
  },
  "basic_info": {
    "birth_stem": "己",
    "birth_branch": "巳",
    "stem_branch": "己巳",
    "five_element_chart": "火六局",
    "five_element_chart_number": 6,
    "start_age": 6
  },
  "palaces": {
    "life_palace": {"branch": "卯"},
    "body_palace": {"palace": "福德宮"},
    "cause_palace": {"palace": "遷移宮", "branch": "巳"},
    "palace_branches": {...},
    "palace_sequence": [...],
    "palace_stems": {...}
  },
  "stars": {
    "main_stars": {...},
    "year_based_stars": {...},
    "month_based_stars": {...},
    "hour_based_stars": {...},
    "transformation_stars": {...},
    "palace_stars": {...}
  },
  "fortune_periods": {
    "major_fortune_direction": "逆行",
    "major_fortune_start_age": 6,
    "minor_fortune_start_position": "亥"
  },
  "summary": {
    "life_palace_info": "命宮在卯",
    "body_palace_info": "身宮在福德宮",
    "cause_palace_info": "來因宮在遷移宮(巳)",
    "five_element_info": "五行局：火六局"
  }
}
```

## 時辰對照表

| 時辰 | 地支 | 時間範圍 |
|------|------|----------|
| 子時 | 子 | 23:00-01:00 |
| 丑時 | 丑 | 01:00-03:00 |
| 寅時 | 寅 | 03:00-05:00 |
| 卯時 | 卯 | 05:00-07:00 |
| 辰時 | 辰 | 07:00-09:00 |
| 巳時 | 巳 | 09:00-11:00 |
| 午時 | 午 | 11:00-13:00 |
| 未時 | 未 | 13:00-15:00 |
| 申時 | 申 | 15:00-17:00 |
| 酉時 | 酉 | 17:00-19:00 |
| 戌時 | 戌 | 19:00-21:00 |
| 亥時 | 亥 | 21:00-23:00 |

## 依賴

無外部依賴，純 Python 標準庫。

## 來源

萃取自 `~/Documents/mingli-backend/`，保留核心計算邏輯，移除 Flask/API 層。

## 測試案例

```bash
# 1976年6月20日（陽曆）卯時 女性
python calculate.py -b 1976-06-20 -H 5 -g female

# 預期結果：
# 命宮在午，身宮在遷移宮，木三局
```
