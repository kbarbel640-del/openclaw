#!/usr/bin/env bash
set -euo pipefail

# Run continuous optimizer weekly cycle:
# 1) KPI drift audit
# 2) Skill upgrade recommendations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SKILL_DIR}/../.." && pwd)"

KPI_INPUT=""
REPORTS_ROOT="${REPO_ROOT}/reports/continuous-optimizer"
SKILLS_DIR="${REPO_ROOT}/skills"
MIN_SEVERITY="MEDIUM"
STAMP="$(date -u +"%Y-%m-%dT%H%M%SZ")"
REPORTS_DIR=""

usage() {
  cat <<'USAGE'
Usage:
  run_weekly_cycle.sh --kpi <kpi.csv> [--reports-root <dir>] [--skills-dir <dir>] [--min-severity <LOW|MEDIUM|HIGH|CRITICAL>]

Example:
  run_weekly_cycle.sh \
    --kpi /Users/me/reports/kpi-weekly.csv \
    --reports-root /Users/me/reports/continuous-optimizer \
    --skills-dir /Users/me/openclaw/skills \
    --min-severity MEDIUM
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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

if [[ -z "${KPI_INPUT}" ]]; then
  echo "--kpi is required" >&2
  usage
  exit 1
fi

if [[ ! -f "${KPI_INPUT}" ]]; then
  echo "KPI CSV not found: ${KPI_INPUT}" >&2
  exit 1
fi

REPORTS_DIR="${REPORTS_ROOT}/${STAMP}"
mkdir -p "${REPORTS_DIR}"

python3 "${SCRIPT_DIR}/audit_kpi_drift.py" \
  --input "${KPI_INPUT}" \
  --output-dir "${REPORTS_DIR}"

python3 "${SCRIPT_DIR}/propose_skill_upgrades.py" \
  --audit "${REPORTS_DIR}/kpi-audit.json" \
  --skills-dir "${SKILLS_DIR}" \
  --output "${REPORTS_DIR}/skill-upgrades.md" \
  --json-output "${REPORTS_DIR}/skill-upgrades.json" \
  --min-severity "${MIN_SEVERITY}"

LATEST_LINK="${REPORTS_ROOT}/latest"
rm -f "${LATEST_LINK}"
ln -s "${REPORTS_DIR}" "${LATEST_LINK}"

echo "Continuous optimizer weekly cycle complete."
echo "Reports: ${REPORTS_DIR}"
echo "Latest: ${LATEST_LINK}"
