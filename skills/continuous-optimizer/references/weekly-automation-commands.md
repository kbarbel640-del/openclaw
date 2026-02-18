# Weekly Automation Command Set

Use this command set to run `continuous-optimizer` weekly without manual steps.

## 1) One-time setup of the OpenClaw cron job

```bash
skills/continuous-optimizer/scripts/install_openclaw_weekly_cron.sh \
  --name continuous-optimizer-weekly \
  --cron "0 9 * * 1" \
  --tz "America/New_York" \
  --agent main \
  --kpi "/Users/zacharywright/Documents/GitHub/openclaw/reports/kpi-weekly.csv" \
  --reports-root "/Users/zacharywright/Documents/GitHub/openclaw/reports/continuous-optimizer" \
  --skills-dir "/Users/zacharywright/Documents/GitHub/openclaw/skills" \
  --min-severity MEDIUM
```

## 2) Dry run preview

```bash
skills/continuous-optimizer/scripts/install_openclaw_weekly_cron.sh --dry-run
```

## 3) Manual run for debugging

```bash
skills/continuous-optimizer/scripts/run_weekly_cycle.sh \
  --kpi "/Users/zacharywright/Documents/GitHub/openclaw/reports/kpi-weekly.csv" \
  --reports-root "/Users/zacharywright/Documents/GitHub/openclaw/reports/continuous-optimizer" \
  --skills-dir "/Users/zacharywright/Documents/GitHub/openclaw/skills" \
  --min-severity MEDIUM
```

## 4) Verify scheduler

```bash
openclaw cron status
openclaw cron list
```
