#!/usr/bin/env python3
"""
Generate a 1000-skill business capability catalog for OpenClaw Z.

Output:
- references/skill-catalog-1000.csv
- references/skill-catalog-1000.json
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

DOMAINS = [
    {
        "slug": "executive",
        "label": "Executive Leadership",
        "function": "executive leadership and company direction",
        "role": "chief executive operator",
    },
    {
        "slug": "strategy",
        "label": "Corporate Strategy",
        "function": "corporate strategy and market positioning",
        "role": "strategy leader",
    },
    {
        "slug": "product-management",
        "label": "Product Management",
        "function": "product planning and execution",
        "role": "product leader",
    },
    {
        "slug": "engineering",
        "label": "Engineering",
        "function": "software engineering delivery",
        "role": "engineering leader",
    },
    {
        "slug": "data-platform",
        "label": "Data Platform",
        "function": "data platform and analytics infrastructure",
        "role": "data platform lead",
    },
    {
        "slug": "ai-ml",
        "label": "AI and ML",
        "function": "applied AI and ML systems",
        "role": "AI lead",
    },
    {
        "slug": "design-ux",
        "label": "Design and UX",
        "function": "product design and user experience",
        "role": "design lead",
    },
    {
        "slug": "growth-marketing",
        "label": "Growth Marketing",
        "function": "growth loops and demand generation",
        "role": "growth marketer",
    },
    {
        "slug": "performance-marketing",
        "label": "Performance Marketing",
        "function": "paid acquisition and channel optimization",
        "role": "performance marketer",
    },
    {
        "slug": "content-brand",
        "label": "Content and Brand",
        "function": "brand storytelling and content operations",
        "role": "brand operator",
    },
    {
        "slug": "sales",
        "label": "Sales",
        "function": "pipeline creation and revenue closing",
        "role": "sales operator",
    },
    {
        "slug": "revenue-operations",
        "label": "Revenue Operations",
        "function": "revenue systems and process control",
        "role": "revops lead",
    },
    {
        "slug": "customer-success",
        "label": "Customer Success",
        "function": "customer value realization and expansion",
        "role": "customer success lead",
    },
    {
        "slug": "customer-support",
        "label": "Customer Support",
        "function": "customer support and service quality",
        "role": "support operations lead",
    },
    {
        "slug": "finance",
        "label": "Finance",
        "function": "financial planning and capital control",
        "role": "finance lead",
    },
    {
        "slug": "accounting",
        "label": "Accounting",
        "function": "accounting close and reporting",
        "role": "accounting lead",
    },
    {
        "slug": "legal",
        "label": "Legal",
        "function": "legal risk and contract management",
        "role": "legal counsel",
    },
    {
        "slug": "people-operations",
        "label": "People Operations",
        "function": "people systems and performance operations",
        "role": "people operations lead",
    },
    {
        "slug": "talent-acquisition",
        "label": "Talent Acquisition",
        "function": "talent sourcing and hiring pipeline",
        "role": "talent acquisition lead",
    },
    {
        "slug": "it-admin",
        "label": "IT Administration",
        "function": "internal systems and endpoint operations",
        "role": "IT administrator",
    },
    {
        "slug": "security",
        "label": "Security",
        "function": "security operations and trust controls",
        "role": "security lead",
    },
    {
        "slug": "procurement",
        "label": "Procurement",
        "function": "vendor procurement and spend governance",
        "role": "procurement manager",
    },
    {
        "slug": "operations",
        "label": "Business Operations",
        "function": "cross-functional business operations",
        "role": "operations lead",
    },
    {
        "slug": "partnerships",
        "label": "Partnerships",
        "function": "strategic partnerships and alliances",
        "role": "partnership manager",
    },
    {
        "slug": "communications-pr",
        "label": "Communications and PR",
        "function": "external communications and narrative control",
        "role": "communications lead",
    },
]

CAPABILITIES = [
    {
        "slug": "strategy-map",
        "name": "Strategy Map",
        "requirement": "Build and maintain a quarterly strategy map for {function}.",
        "trigger": "A new planning cycle starts in {domain}.",
        "output": "A ranked strategy map with owners, risks, and milestones.",
        "kpi": "Strategic initiative on-time completion rate.",
    },
    {
        "slug": "goal-tree",
        "name": "Goal Tree",
        "requirement": "Translate company goals into a measurable goal tree for {function}.",
        "trigger": "Leadership asks for clearer KPI alignment in {domain}.",
        "output": "A goal tree mapping company goals to team KPIs.",
        "kpi": "Percent of KPIs traceable to company goals.",
    },
    {
        "slug": "operating-plan",
        "name": "Operating Plan",
        "requirement": "Create a 90-day operating plan for {function}.",
        "trigger": "A team needs a quarter execution plan in {domain}.",
        "output": "A 90-day operating plan with dependencies and deadlines.",
        "kpi": "Plan execution completion rate by milestone.",
    },
    {
        "slug": "budget-allocator",
        "name": "Budget Allocator",
        "requirement": "Allocate budget across initiatives in {function} using expected impact.",
        "trigger": "Budget planning or reforecast is requested for {domain}.",
        "output": "Budget allocation table with expected ROI per initiative.",
        "kpi": "Variance between expected and realized ROI.",
    },
    {
        "slug": "hiring-plan",
        "name": "Hiring Plan",
        "requirement": "Define a hiring plan that supports priority outcomes in {function}.",
        "trigger": "Headcount planning is requested for {domain}.",
        "output": "Role plan with timing, scorecards, and hiring owner.",
        "kpi": "Time-to-fill and quality-of-hire against target.",
    },
    {
        "slug": "roadmap-prioritization",
        "name": "Roadmap Prioritization",
        "requirement": "Prioritize work in {function} with clear cost-impact tradeoffs.",
        "trigger": "Backlog grows beyond delivery capacity in {domain}.",
        "output": "Prioritized roadmap with rationale and cut lines.",
        "kpi": "High-priority delivery rate and cycle-time stability.",
    },
    {
        "slug": "workflow-design",
        "name": "Workflow Design",
        "requirement": "Design a standard workflow for repeatable work in {function}.",
        "trigger": "Manual handoffs cause delays in {domain}.",
        "output": "Workflow spec with states, owners, and SLAs.",
        "kpi": "Workflow cycle-time reduction after rollout.",
    },
    {
        "slug": "sop-library",
        "name": "SOP Library",
        "requirement": "Create and maintain SOPs for critical motions in {function}.",
        "trigger": "Execution quality varies across operators in {domain}.",
        "output": "Versioned SOP library with audit history.",
        "kpi": "SOP adoption rate and defect reduction.",
    },
    {
        "slug": "automation-backlog",
        "name": "Automation Backlog",
        "requirement": "Build an automation backlog ranked by impact in {function}.",
        "trigger": "The team asks what to automate next in {domain}.",
        "output": "Automation backlog with effort, risk, and impact score.",
        "kpi": "Manual hours removed per sprint.",
    },
    {
        "slug": "agent-orchestration",
        "name": "Agent Orchestration",
        "requirement": "Orchestrate AI agents for high-volume workflows in {function}.",
        "trigger": "Workload spikes require parallel automation in {domain}.",
        "output": "Agent workflow graph with fallback and retry policy.",
        "kpi": "Autonomous completion rate without human escalation.",
    },
    {
        "slug": "data-contracts",
        "name": "Data Contracts",
        "requirement": "Define enforceable data contracts used by {function}.",
        "trigger": "Upstream data changes repeatedly break workflows in {domain}.",
        "output": "Data contract registry with schema and ownership.",
        "kpi": "Data contract violation rate.",
    },
    {
        "slug": "kpi-dashboard",
        "name": "KPI Dashboard",
        "requirement": "Build a live KPI dashboard for {function}.",
        "trigger": "Leaders ask for real-time visibility in {domain}.",
        "output": "Automated KPI dashboard with drill-downs.",
        "kpi": "Dashboard freshness and decision adoption rate.",
    },
    {
        "slug": "anomaly-detection",
        "name": "Anomaly Detection",
        "requirement": "Monitor metrics and detect anomalies in {function}.",
        "trigger": "Unexpected swings are observed in {domain} KPIs.",
        "output": "Alert pipeline with anomaly diagnostics.",
        "kpi": "Mean time to detect KPI anomalies.",
    },
    {
        "slug": "forecast-engine",
        "name": "Forecast Engine",
        "requirement": "Forecast outcomes for {function} with confidence bands.",
        "trigger": "Planning requires forward-looking estimates in {domain}.",
        "output": "Rolling forecast with scenario assumptions.",
        "kpi": "Forecast accuracy against actual outcomes.",
    },
    {
        "slug": "scenario-planning",
        "name": "Scenario Planning",
        "requirement": "Model best/base/worst scenarios for {function}.",
        "trigger": "A major decision requires downside analysis in {domain}.",
        "output": "Scenario plan with trigger thresholds.",
        "kpi": "Decision lead time under uncertainty.",
    },
    {
        "slug": "experiment-design",
        "name": "Experiment Design",
        "requirement": "Design statistically sound experiments for {function}.",
        "trigger": "Competing hypotheses need validation in {domain}.",
        "output": "Experiment protocol with success criteria.",
        "kpi": "Experiment velocity and decision quality.",
    },
    {
        "slug": "experiment-analysis",
        "name": "Experiment Analysis",
        "requirement": "Analyze experiment results and recommend actions for {function}.",
        "trigger": "An experiment cycle closes in {domain}.",
        "output": "Experiment readout with confidence and next action.",
        "kpi": "Time from experiment end to decision.",
    },
    {
        "slug": "customer-insight-mining",
        "name": "Customer Insight Mining",
        "requirement": "Mine customer signals and extract priorities for {function}.",
        "trigger": "Signal volume from customers exceeds manual review in {domain}.",
        "output": "Insight brief with ranked customer themes.",
        "kpi": "Insight-to-action conversion rate.",
    },
    {
        "slug": "quality-gates",
        "name": "Quality Gates",
        "requirement": "Define and enforce quality gates for {function}.",
        "trigger": "Defect rates exceed tolerance in {domain}.",
        "output": "Quality gate policy with pass/fail thresholds.",
        "kpi": "Defects escaped beyond gate per period.",
    },
    {
        "slug": "incident-response",
        "name": "Incident Response",
        "requirement": "Run incident triage and response workflows for {function}.",
        "trigger": "A service or process incident hits {domain}.",
        "output": "Incident timeline, owner matrix, and resolution plan.",
        "kpi": "Mean time to resolve incidents.",
    },
    {
        "slug": "risk-register",
        "name": "Risk Register",
        "requirement": "Maintain a live risk register for {function}.",
        "trigger": "New dependencies or threats emerge in {domain}.",
        "output": "Risk register with severity, owner, and mitigation.",
        "kpi": "Open high-risk items older than SLA.",
    },
    {
        "slug": "compliance-controls",
        "name": "Compliance Controls",
        "requirement": "Automate evidence collection and controls for {function}.",
        "trigger": "Audit preparation starts in {domain}.",
        "output": "Control checklist with linked evidence.",
        "kpi": "Control pass rate and audit findings count.",
    },
    {
        "slug": "vendor-selection",
        "name": "Vendor Selection",
        "requirement": "Run a structured vendor selection process for {function}.",
        "trigger": "A new tool or service is needed in {domain}.",
        "output": "Vendor comparison with weighted scoring.",
        "kpi": "Post-selection satisfaction and time-to-value.",
    },
    {
        "slug": "vendor-scorecard",
        "name": "Vendor Scorecard",
        "requirement": "Monitor vendor performance supporting {function}.",
        "trigger": "Current vendors underperform against expectations in {domain}.",
        "output": "Vendor scorecard with SLA and risk trend.",
        "kpi": "Vendor SLA adherence rate.",
    },
    {
        "slug": "knowledge-management",
        "name": "Knowledge Management",
        "requirement": "Build a searchable knowledge layer for {function}.",
        "trigger": "Repeated questions create drag in {domain}.",
        "output": "Indexed knowledge base with freshness policy.",
        "kpi": "Knowledge reuse rate and answer latency.",
    },
    {
        "slug": "weekly-business-review",
        "name": "Weekly Business Review",
        "requirement": "Automate weekly business review preparation for {function}.",
        "trigger": "Weekly review cadence runs in {domain}.",
        "output": "WBR packet with KPI deltas and decisions needed.",
        "kpi": "Review prep time and action closure rate.",
    },
    {
        "slug": "executive-memo",
        "name": "Executive Memo",
        "requirement": "Generate concise executive memos for {function}.",
        "trigger": "Leadership asks for fast context on a topic in {domain}.",
        "output": "Decision memo with options and recommendation.",
        "kpi": "Decision turnaround time.",
    },
    {
        "slug": "stakeholder-update",
        "name": "Stakeholder Update",
        "requirement": "Produce stakeholder-specific updates for {function}.",
        "trigger": "Cross-functional stakeholders request status in {domain}.",
        "output": "Segmented status updates with owner actions.",
        "kpi": "Stakeholder satisfaction with reporting clarity.",
    },
    {
        "slug": "project-recovery",
        "name": "Project Recovery",
        "requirement": "Detect and recover at-risk projects in {function}.",
        "trigger": "A project misses milestone targets in {domain}.",
        "output": "Recovery plan with rescope and timing options.",
        "kpi": "Recovery success rate within target window.",
    },
    {
        "slug": "capacity-planning",
        "name": "Capacity Planning",
        "requirement": "Model workload and capacity for {function}.",
        "trigger": "Demand outpaces team bandwidth in {domain}.",
        "output": "Capacity model with bottleneck forecast.",
        "kpi": "Capacity utilization within target range.",
    },
    {
        "slug": "cost-optimization",
        "name": "Cost Optimization",
        "requirement": "Identify and execute cost reductions in {function}.",
        "trigger": "Margin pressure rises in {domain}.",
        "output": "Cost optimization plan with savings confidence.",
        "kpi": "Realized savings against target.",
    },
    {
        "slug": "revenue-optimization",
        "name": "Revenue Optimization",
        "requirement": "Identify and execute revenue uplifts in {function}.",
        "trigger": "Revenue targets are at risk in {domain}.",
        "output": "Revenue uplift plan with testable hypotheses.",
        "kpi": "Incremental revenue attributable to interventions.",
    },
    {
        "slug": "cycle-time-reduction",
        "name": "Cycle Time Reduction",
        "requirement": "Reduce end-to-end cycle time in {function}.",
        "trigger": "Lead time exceeds acceptable SLA in {domain}.",
        "output": "Bottleneck map with cycle-time interventions.",
        "kpi": "Median cycle-time reduction.",
    },
    {
        "slug": "churn-prevention",
        "name": "Churn Prevention",
        "requirement": "Predict and prevent churn drivers in {function}.",
        "trigger": "Retention metrics degrade in {domain}.",
        "output": "Churn risk model with save playbooks.",
        "kpi": "Gross and net churn improvement.",
    },
    {
        "slug": "enablement-program",
        "name": "Enablement Program",
        "requirement": "Create a repeatable enablement program for {function}.",
        "trigger": "New team members ramp slowly in {domain}.",
        "output": "Enablement curriculum with milestones.",
        "kpi": "Time-to-productivity for new operators.",
    },
    {
        "slug": "performance-management",
        "name": "Performance Management",
        "requirement": "Operationalize performance reviews for {function}.",
        "trigger": "Review cycles begin in {domain}.",
        "output": "Performance packet with evidence and growth actions.",
        "kpi": "Performance goal completion rate.",
    },
    {
        "slug": "root-cause-analysis",
        "name": "Root Cause Analysis",
        "requirement": "Run root-cause analysis for repeat failures in {function}.",
        "trigger": "The same issue repeats in {domain}.",
        "output": "RCA document with verified corrective actions.",
        "kpi": "Repeat incident rate after remediation.",
    },
    {
        "slug": "decision-log",
        "name": "Decision Log",
        "requirement": "Maintain a transparent decision log for {function}.",
        "trigger": "Decision context is repeatedly lost in {domain}.",
        "output": "Decision log with date, context, owner, and rationale.",
        "kpi": "Decision traceability coverage.",
    },
    {
        "slug": "ai-ops-monitoring",
        "name": "AI Ops Monitoring",
        "requirement": "Monitor AI workflow quality and drift in {function}.",
        "trigger": "Agent performance becomes unstable in {domain}.",
        "output": "AI operations dashboard with drift and failure alerts.",
        "kpi": "Automated workflow success rate with guardrails.",
    },
    {
        "slug": "continuous-improvement-loop",
        "name": "Continuous Improvement Loop",
        "requirement": "Run a continuous improvement loop for {function}.",
        "trigger": "The team wants systematic optimization in {domain}.",
        "output": "Improvement backlog with closed-loop learnings.",
        "kpi": "Quarter-over-quarter productivity uplift.",
    },
]

FIELDNAMES = [
    "skill_id",
    "domain_slug",
    "domain_label",
    "domain_function",
    "owner_role",
    "capability",
    "skill_name",
    "description",
    "business_requirement",
    "trigger_signal",
    "primary_output",
    "success_metric",
    "priority_tier",
    "automation_level",
    "prompt_seed",
]


def priority_tier(index: int) -> str:
    if index < 10:
        return "P1"
    if index < 25:
        return "P2"
    return "P3"


def automation_level(index: int) -> str:
    if index < 10:
        return "L3"
    if index < 25:
        return "L4"
    return "L5"


def build_catalog() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    counter = 1

    for domain in DOMAINS:
        for capability_index, capability in enumerate(CAPABILITIES):
            skill_name = f"{domain['slug']}-{capability['slug']}"
            rows.append(
                {
                    "skill_id": f"S{counter:04d}",
                    "domain_slug": domain["slug"],
                    "domain_label": domain["label"],
                    "domain_function": domain["function"],
                    "owner_role": domain["role"],
                    "capability": capability["name"],
                    "skill_name": skill_name,
                    "description": (
                        f"Automate {capability['name'].lower()} workflows for {domain['label']}."
                    ),
                    "business_requirement": capability["requirement"].format(
                        function=domain["function"], domain=domain["label"]
                    ),
                    "trigger_signal": capability["trigger"].format(
                        function=domain["function"], domain=domain["label"]
                    ),
                    "primary_output": capability["output"].format(
                        function=domain["function"], domain=domain["label"]
                    ),
                    "success_metric": capability["kpi"].format(
                        function=domain["function"], domain=domain["label"]
                    ),
                    "priority_tier": priority_tier(capability_index),
                    "automation_level": automation_level(capability_index),
                    "prompt_seed": (
                        f"Act as a top-tier {domain['role']} and execute "
                        f"{capability['name']} for {domain['label']}."
                    ),
                }
            )
            counter += 1

    return rows


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": {
            "total_domains": len(DOMAINS),
            "capabilities_per_domain": len(CAPABILITIES),
            "total_skills": len(rows),
        },
        "domains": DOMAINS,
        "capabilities": CAPABILITIES,
        "skills": rows,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    base_dir = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Generate OpenClaw Z 1000-skill catalog")
    parser.add_argument(
        "--csv",
        type=Path,
        default=base_dir / "references" / "skill-catalog-1000.csv",
        help="Path to CSV output",
    )
    parser.add_argument(
        "--json",
        type=Path,
        default=base_dir / "references" / "skill-catalog-1000.json",
        help="Path to JSON output",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = build_catalog()

    expected = len(DOMAINS) * len(CAPABILITIES)
    if len(rows) != expected:
        raise RuntimeError(f"Catalog size mismatch: got {len(rows)}, expected {expected}")

    write_csv(args.csv, rows)
    write_json(args.json, rows)

    print(f"Generated {len(rows)} skills")
    print(f"CSV: {args.csv}")
    print(f"JSON: {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
