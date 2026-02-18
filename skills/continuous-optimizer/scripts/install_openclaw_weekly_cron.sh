#!/usr/bin/env bash
set -euo pipefail

# Install or update a weekly OpenClaw cron job that runs continuous-optimizer.
# The cron job triggers an isolated agent turn that executes run_weekly_cycle.sh.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SKILL_DIR}/../.." && pwd)"

JOB_NAME="continuous-optimizer-weekly"
CRON_EXPR="0 9 * * 1"
TZ_NAME="America/New_York"
AGENT_ID="main"
KPI_INPUT="${REPO_ROOT}/reports/kpi-weekly.csv"
REPORTS_ROOT="${REPO_ROOT}/reports/continuous-optimizer"
SKILLS_DIR="${REPO_ROOT}/skills"
MIN_SEVERITY="MEDIUM"
MODEL=""
DRY_RUN="false"

usage() {
  cat <<'USAGE'
Usage:
  install_openclaw_weekly_cron.sh [options]

Options:
  --name <job-name>            Cron job name (default: continuous-optimizer-weekly)
  --cron <expr>                Cron expression (default: "0 9 * * 1")
  --tz <iana>                  IANA timezone (default: America/New_York)
  --agent <id>                 Agent id (default: main)
  --kpi <path>                 KPI CSV path (default: <repo>/reports/kpi-weekly.csv)
  --reports-root <path>        Reports root directory
  --skills-dir <path>          Skills directory
  --min-severity <level>       LOW|MEDIUM|HIGH|CRITICAL (default: MEDIUM)
  --model <provider/model>     Optional model override
  --dry-run                    Print commands only
  -h, --help                   Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      JOB_NAME="${2:-}"
      shift 2
      ;;
    --cron)
      CRON_EXPR="${2:-}"
      shift 2
      ;;
    --tz)
      TZ_NAME="${2:-}"
      shift 2
      ;;
    --agent)
      AGENT_ID="${2:-}"
      shift 2
      ;;
    --kpi)
      KPI_INPUT="${2:-}"
      shift 2
      ;;
    --reports-root)
      REPORTS_ROOT="${2:-}"
      shift 2
      ;;
    --skills-dir)
      SKILLS_DIR="${2:-}"
      shift 2
      ;;
    --min-severity)
      MIN_SEVERITY="${2:-}"
      shift 2
      ;;
    --model)
      MODEL="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

RUNNER="${SCRIPT_DIR}/run_weekly_cycle.sh"

if [[ ! -x "${RUNNER}" ]]; then
  echo "Runner script missing or not executable: ${RUNNER}" >&2
  exit 1
fi

if [[ ! -f "${KPI_INPUT}" ]]; then
  mkdir -p "$(dirname "${KPI_INPUT}")"
  cat > "${KPI_INPUT}" <<'CSV'
skill_name,kpi_name,target_value,current_value,direction,owner,domain
executive-strategy-map,strategic_initiative_on_time_rate,0.90,0.90,higher_is_better,exec_owner,executive
CSV
  echo "Created starter KPI file: ${KPI_INPUT}"
fi

MESSAGE=$(cat <<MSG
Run this command exactly, then summarize CRITICAL/HIGH drifts and top 10 upgrade actions:
${RUNNER} --kpi ${KPI_INPUT} --reports-root ${REPORTS_ROOT} --skills-dir ${SKILLS_DIR} --min-severity ${MIN_SEVERITY}
MSG
)

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "Dry run mode"
  echo "Job name: ${JOB_NAME}"
  echo "Schedule: ${CRON_EXPR} @ ${TZ_NAME}"
  echo "Agent: ${AGENT_ID}"
  echo "Message:"
  echo "${MESSAGE}"
  echo ""
  echo "Would run:"
  echo "openclaw cron list --json"
  echo "openclaw cron add/edit ..."
  exit 0
fi

LIST_JSON="$(openclaw cron list --json)"
JOB_ID="$(
python3 - "${JOB_NAME}" <<'PY'
import json
import sys
name = sys.argv[1]
data = json.loads(sys.stdin.read())
jobs = data.get("jobs", [])
for job in jobs:
    if job.get("name") == name:
        print(job.get("id", ""))
        break
PY
<<<"${LIST_JSON}"
)"

if [[ -n "${JOB_ID}" ]]; then
  CMD=(
    openclaw cron edit "${JOB_ID}"
    --cron "${CRON_EXPR}"
    --tz "${TZ_NAME}"
    --session isolated
    --agent "${AGENT_ID}"
    --message "${MESSAGE}"
    --no-deliver
  )
  if [[ -n "${MODEL}" ]]; then
    CMD+=(--model "${MODEL}")
  fi
  "${CMD[@]}"
  echo "Updated existing cron job: ${JOB_NAME} (${JOB_ID})"
else
  CMD=(
    openclaw cron add
    --name "${JOB_NAME}"
    --cron "${CRON_EXPR}"
    --tz "${TZ_NAME}"
    --session isolated
    --agent "${AGENT_ID}"
    --message "${MESSAGE}"
    --no-deliver
  )
  if [[ -n "${MODEL}" ]]; then
    CMD+=(--model "${MODEL}")
  fi
  "${CMD[@]}"
  echo "Created cron job: ${JOB_NAME}"
fi
