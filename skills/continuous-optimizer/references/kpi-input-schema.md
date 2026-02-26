# KPI Input Schema

Use a CSV with one row per KPI measurement.

## Required Columns

- `skill_name`: Skill folder name, for example `executive-strategy-map`.
- `kpi_name`: KPI label, for example `weekly_action_closure_rate`.
- `target_value`: Numeric target threshold.
- `current_value`: Numeric observed value.

## Optional Columns

- `direction`: `higher_is_better` (default) or `lower_is_better`.
- `owner`: Role or person accountable for the KPI.
- `domain`: Domain label or slug.

## Example CSV

```csv
skill_name,kpi_name,target_value,current_value,direction,owner,domain
executive-strategy-map,strategic_initiative_on_time_rate,0.90,0.84,higher_is_better,chief_of_staff,executive
engineering-quality-gates,defects_escaped_per_release,2,5,lower_is_better,eng_manager,engineering
sales-forecast-engine,forecast_accuracy,0.85,0.79,higher_is_better,sales_ops,sales
```

## Weekly Commands

```bash
python3 skills/continuous-optimizer/scripts/audit_kpi_drift.py \
  --input reports/kpi-weekly.csv \
  --output-dir reports/continuous-optimizer
```

```bash
python3 skills/continuous-optimizer/scripts/propose_skill_upgrades.py \
  --audit reports/continuous-optimizer/kpi-audit.json \
  --skills-dir skills \
  --output reports/continuous-optimizer/skill-upgrades.md \
  --json-output reports/continuous-optimizer/skill-upgrades.json
```
