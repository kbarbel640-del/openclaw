/**
 * VividWalls Business Goal Seeding — Populates the mabos knowledge graph
 *
 * Programmatically inserts agents, desires, goals (3-tier TOGAF hierarchy),
 * beliefs, and Tropos dependency relations derived from VividWalls' BRD,
 * 5-year financial model, and Business Model Canvas.
 *
 * Goal structure follows TOGAF Driver/Goal/Objective catalog:
 *   Strategic (5-year vision) → Tactical (Year 1-2 milestones) → Operational (monthly/weekly)
 *
 * All entities are scoped via agent_owns to their responsible C-suite agent.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { OpenClawPluginApi, AnyAgentTool } from "openclaw/plugin-sdk";
import { getTypeDBClient } from "../knowledge/typedb-client.js";
import {
  GoalStoreQueries,
  DesireStoreQueries,
  BeliefStoreQueries,
} from "../knowledge/typedb-queries.js";
import { textResult } from "./common.js";

// ── Seed Data ───────────────────────────────────────────────────────────

const AGENTS = [
  { id: "vw-ceo", name: "CEO Agent" },
  { id: "vw-cfo", name: "CFO Agent" },
  { id: "vw-cmo", name: "CMO Agent" },
  { id: "vw-cto", name: "CTO Agent" },
  { id: "vw-coo", name: "COO Agent" },
  { id: "vw-hr", name: "HR Agent" },
  { id: "vw-legal", name: "Legal Agent" },
  { id: "vw-knowledge", name: "Knowledge Agent" },
  { id: "vw-strategy", name: "Strategy Agent" },
];

interface DesireSeed {
  id: string;
  agentId: string;
  name: string;
  description: string;
  priority: number;
  importance: number;
  urgency: number;
  alignment: number;
  category: string;
}

const DESIRES: DesireSeed[] = [
  // CEO
  {
    id: "D-CEO-001",
    agentId: "vw-ceo",
    name: "Business Viability",
    description: "Ensure VividWalls survives and thrives as a premium art e-commerce business",
    priority: 0.95,
    importance: 1.0,
    urgency: 0.8,
    alignment: 1.0,
    category: "terminal",
  },
  {
    id: "D-CEO-002",
    agentId: "vw-ceo",
    name: "Strategic Coherence",
    description: "All departments and agents work toward aligned VividWalls objectives",
    priority: 0.87,
    importance: 0.9,
    urgency: 0.7,
    alignment: 1.0,
    category: "terminal",
  },
  {
    id: "D-CEO-003",
    agentId: "vw-ceo",
    name: "Innovation & Growth",
    description: "Continuously improve art offerings and expand to new markets",
    priority: 0.72,
    importance: 0.8,
    urgency: 0.5,
    alignment: 0.9,
    category: "terminal",
  },
  // CFO
  {
    id: "D-CFO-001",
    agentId: "vw-cfo",
    name: "Financial Solvency",
    description: "Ensure VividWalls always has enough cash to operate",
    priority: 0.94,
    importance: 1.0,
    urgency: 0.8,
    alignment: 1.0,
    category: "terminal",
  },
  {
    id: "D-CFO-002",
    agentId: "vw-cfo",
    name: "Revenue Growth",
    description: "Drive revenue from $2.3M to $13.7M over 5 years",
    priority: 0.88,
    importance: 0.9,
    urgency: 0.7,
    alignment: 0.95,
    category: "terminal",
  },
  {
    id: "D-CFO-003",
    agentId: "vw-cfo",
    name: "Cost Optimization",
    description: "Reduce COGS from 60% to 48% through scale and efficiency",
    priority: 0.82,
    importance: 0.8,
    urgency: 0.6,
    alignment: 0.9,
    category: "instrumental",
  },
  // CMO
  {
    id: "D-CMO-001",
    agentId: "vw-cmo",
    name: "Brand Awareness",
    description: "Establish VividWalls as the premium abstract art destination",
    priority: 0.9,
    importance: 0.9,
    urgency: 0.8,
    alignment: 0.95,
    category: "terminal",
  },
  {
    id: "D-CMO-002",
    agentId: "vw-cmo",
    name: "Customer Acquisition",
    description: "Grow customer base across consumer, designer, and commercial segments",
    priority: 0.88,
    importance: 0.9,
    urgency: 0.8,
    alignment: 0.9,
    category: "terminal",
  },
  {
    id: "D-CMO-003",
    agentId: "vw-cmo",
    name: "Limited Edition Success",
    description: "Drive premium pricing and FOMO through scarcity marketing",
    priority: 0.85,
    importance: 0.85,
    urgency: 0.7,
    alignment: 0.9,
    category: "terminal",
  },
  // CTO
  {
    id: "D-CTO-001",
    agentId: "vw-cto",
    name: "Platform Reliability",
    description: "Maintain 99.9% uptime for vividwalls.co e-commerce platform",
    priority: 0.92,
    importance: 0.95,
    urgency: 0.8,
    alignment: 0.9,
    category: "terminal",
  },
  {
    id: "D-CTO-002",
    agentId: "vw-cto",
    name: "AI/ML Excellence",
    description: "Leverage AI for operations efficiency, personalization, and art generation",
    priority: 0.85,
    importance: 0.85,
    urgency: 0.6,
    alignment: 0.9,
    category: "terminal",
  },
  {
    id: "D-CTO-003",
    agentId: "vw-cto",
    name: "AR Innovation",
    description: "Develop augmented reality preview features for wall art visualization",
    priority: 0.78,
    importance: 0.75,
    urgency: 0.5,
    alignment: 0.85,
    category: "instrumental",
  },
  // COO
  {
    id: "D-COO-001",
    agentId: "vw-coo",
    name: "Operational Efficiency",
    description: "Streamline order fulfillment, printing, and shipping processes",
    priority: 0.91,
    importance: 0.9,
    urgency: 0.8,
    alignment: 0.9,
    category: "terminal",
  },
  {
    id: "D-COO-002",
    agentId: "vw-coo",
    name: "Supply Chain Reliability",
    description: "Ensure consistent supply of premium canvas, inks, and framing materials",
    priority: 0.86,
    importance: 0.85,
    urgency: 0.7,
    alignment: 0.85,
    category: "terminal",
  },
  {
    id: "D-COO-003",
    agentId: "vw-coo",
    name: "Quality Control",
    description: "Maintain 95%+ print quality score and <5% return rate",
    priority: 0.88,
    importance: 0.9,
    urgency: 0.75,
    alignment: 0.9,
    category: "terminal",
  },
  // HR
  {
    id: "D-HR-001",
    agentId: "vw-hr",
    name: "Talent Acquisition",
    description: "Recruit skilled team for art curation, tech, and operations",
    priority: 0.8,
    importance: 0.8,
    urgency: 0.6,
    alignment: 0.85,
    category: "terminal",
  },
  // Legal
  {
    id: "D-LEGAL-001",
    agentId: "vw-legal",
    name: "IP Protection",
    description: "Protect art collections, brand, and limited edition authenticity",
    priority: 0.82,
    importance: 0.85,
    urgency: 0.6,
    alignment: 0.9,
    category: "terminal",
  },
  // Strategy
  {
    id: "D-STRAT-001",
    agentId: "vw-strategy",
    name: "Competitive Positioning",
    description: "Maintain premium positioning against AI-driven art platforms",
    priority: 0.85,
    importance: 0.85,
    urgency: 0.65,
    alignment: 0.95,
    category: "terminal",
  },
];

interface GoalSeed {
  id: string;
  agentId: string;
  name: string;
  description: string;
  hierarchy_level: string;
  priority: number;
  success_criteria?: string;
  deadline?: string;
  parent_goal_id?: string;
  desire_ids: string[]; // desires that motivate this goal
}

const GOALS: GoalSeed[] = [
  // ── Strategic Goals (5-year) ──────────────────────────────────────
  {
    id: "G-S001",
    agentId: "vw-cfo",
    name: "Reach $13.7M Revenue by Year 5",
    description:
      "Grow VividWalls from $2.3M to $13.7M annual revenue across consumer, designer, and commercial segments",
    hierarchy_level: "strategic",
    priority: 0.95,
    success_criteria: "Annual revenue >= $13.7M",
    deadline: "2030-12-31",
    desire_ids: ["D-CFO-002"],
  },
  {
    id: "G-S002",
    agentId: "vw-cfo",
    name: "Achieve 26% EBITDA Margin by Year 5",
    description:
      "Improve profitability from -12% to 26% EBITDA margin through scale and cost optimization",
    hierarchy_level: "strategic",
    priority: 0.9,
    success_criteria: "EBITDA margin >= 26%",
    deadline: "2030-12-31",
    desire_ids: ["D-CFO-001", "D-CFO-003"],
  },
  {
    id: "G-S003",
    agentId: "vw-cmo",
    name: "Grow to 18,767 Orders/Year by Year 5",
    description: "Scale order volume from 3,833 to 18,767 orders annually",
    hierarchy_level: "strategic",
    priority: 0.88,
    success_criteria: "Annual orders >= 18,767",
    deadline: "2030-12-31",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-S004",
    agentId: "vw-cmo",
    name: "Reach $730 Average Order Value by Year 5",
    description: "Increase AOV from $600 to $730 through upselling and premium products",
    hierarchy_level: "strategic",
    priority: 0.85,
    success_criteria: "AOV >= $730",
    deadline: "2030-12-31",
    desire_ids: ["D-CMO-001", "D-CMO-003"],
  },
  {
    id: "G-S005",
    agentId: "vw-cmo",
    name: "Achieve 45% Repeat Purchase Rate",
    description: "Build customer loyalty from 25% to 45% repeat purchase rate",
    hierarchy_level: "strategic",
    priority: 0.87,
    success_criteria: "Repeat rate >= 45%",
    deadline: "2030-12-31",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-S006",
    agentId: "vw-cmo",
    name: "Reduce CAC to $60",
    description:
      "Halve customer acquisition cost from $120 to $60 through organic and referral growth",
    hierarchy_level: "strategic",
    priority: 0.82,
    success_criteria: "CAC <= $60",
    deadline: "2030-12-31",
    desire_ids: ["D-CMO-002", "D-CFO-003"],
  },
  {
    id: "G-S007",
    agentId: "vw-cmo",
    name: "Scale Limited Edition to 20% Revenue Mix",
    description:
      "Grow limited edition share from 10% to 20% of total revenue with 50% price premium",
    hierarchy_level: "strategic",
    priority: 0.86,
    success_criteria: "LE revenue mix >= 20%",
    deadline: "2030-12-31",
    desire_ids: ["D-CMO-003"],
  },
  {
    id: "G-S008",
    agentId: "vw-ceo",
    name: "Expand to International Markets",
    description: "Launch in EU and Asia markets by Year 4-5",
    hierarchy_level: "strategic",
    priority: 0.8,
    success_criteria: "Active in >= 3 international markets",
    deadline: "2030-12-31",
    desire_ids: ["D-CEO-003"],
  },
  {
    id: "G-S009",
    agentId: "vw-cto",
    name: "Launch AR Preview Technology",
    description: "Develop augmented reality wall art preview feature for customers",
    hierarchy_level: "strategic",
    priority: 0.78,
    success_criteria: "AR feature live in production",
    deadline: "2028-12-31",
    desire_ids: ["D-CTO-003"],
  },
  {
    id: "G-S010",
    agentId: "vw-cto",
    name: "Build Proprietary AI Art Generation",
    description: "Create custom AI art generation service for unique VividWalls collections",
    hierarchy_level: "strategic",
    priority: 0.75,
    success_criteria: "AI generation MVP launched",
    deadline: "2030-12-31",
    desire_ids: ["D-CTO-002"],
  },
  {
    id: "G-S011",
    agentId: "vw-coo",
    name: "Open Physical Showroom",
    description: "Establish physical showroom in major metropolitan market",
    hierarchy_level: "strategic",
    priority: 0.7,
    success_criteria: "Showroom open and operational",
    deadline: "2030-12-31",
    desire_ids: ["D-COO-001"],
  },
  {
    id: "G-S012",
    agentId: "vw-coo",
    name: "Achieve $1.14M Revenue Per Employee",
    description: "Increase employee productivity from $460K to $1.14M revenue per employee",
    hierarchy_level: "strategic",
    priority: 0.82,
    success_criteria: "Rev/employee >= $1.14M",
    deadline: "2030-12-31",
    desire_ids: ["D-COO-001"],
  },

  // ── Tactical Goals (Year 1-2) ─────────────────────────────────────
  {
    id: "G-T001",
    agentId: "vw-cfo",
    name: "Reach $2.3M Revenue Year 1",
    description: "Achieve first year revenue target of $2.3M",
    hierarchy_level: "tactical",
    priority: 0.93,
    success_criteria: "Y1 revenue >= $2.3M",
    deadline: "2026-12-31",
    parent_goal_id: "G-S001",
    desire_ids: ["D-CFO-002"],
  },
  {
    id: "G-T002",
    agentId: "vw-cfo",
    name: "Reach $4.0M Revenue Year 2",
    description: "Achieve 74% growth to $4.0M in second year",
    hierarchy_level: "tactical",
    priority: 0.88,
    success_criteria: "Y2 revenue >= $4.0M",
    deadline: "2027-12-31",
    parent_goal_id: "G-S001",
    desire_ids: ["D-CFO-002"],
  },
  {
    id: "G-T003",
    agentId: "vw-cfo",
    name: "Achieve Positive EBITDA by Year 2",
    description: "Move from -12% to 11% EBITDA margin",
    hierarchy_level: "tactical",
    priority: 0.9,
    success_criteria: "EBITDA > 0",
    deadline: "2027-12-31",
    parent_goal_id: "G-S002",
    desire_ids: ["D-CFO-001"],
  },
  {
    id: "G-T004",
    agentId: "vw-coo",
    name: "Process 3,833 Orders Year 1",
    description: "Build fulfillment capacity for 319 orders/month",
    hierarchy_level: "tactical",
    priority: 0.85,
    success_criteria: "Y1 orders >= 3,833",
    deadline: "2026-12-31",
    parent_goal_id: "G-S003",
    desire_ids: ["D-COO-001"],
  },
  {
    id: "G-T005",
    agentId: "vw-cmo",
    name: "Maintain $600 AOV Year 1",
    description: "Establish baseline AOV at $600 across all segments",
    hierarchy_level: "tactical",
    priority: 0.83,
    success_criteria: "AOV >= $600",
    deadline: "2026-12-31",
    parent_goal_id: "G-S004",
    desire_ids: ["D-CMO-001"],
  },
  {
    id: "G-T006",
    agentId: "vw-cmo",
    name: "Achieve 25% Repeat Purchase Rate Year 1",
    description: "Build initial customer loyalty and retention",
    hierarchy_level: "tactical",
    priority: 0.8,
    success_criteria: "Repeat rate >= 25%",
    deadline: "2026-12-31",
    parent_goal_id: "G-S005",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-T007",
    agentId: "vw-cmo",
    name: "Reduce CAC to $120 Year 1",
    description: "Optimize marketing spend efficiency in first year",
    hierarchy_level: "tactical",
    priority: 0.78,
    success_criteria: "CAC <= $120",
    deadline: "2026-12-31",
    parent_goal_id: "G-S006",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-T008",
    agentId: "vw-cmo",
    name: "Launch LE Program at 10% Mix",
    description: "Establish limited edition program with initial 10% revenue share",
    hierarchy_level: "tactical",
    priority: 0.85,
    success_criteria: "LE mix >= 10%",
    deadline: "2026-12-31",
    parent_goal_id: "G-S007",
    desire_ids: ["D-CMO-003"],
  },
  {
    id: "G-T009",
    agentId: "vw-cmo",
    name: "Achieve 35% LE Price Premium Year 1",
    description: "Price limited editions at 35% above standard prints",
    hierarchy_level: "tactical",
    priority: 0.82,
    success_criteria: "LE premium >= 35%",
    deadline: "2026-12-31",
    parent_goal_id: "G-S007",
    desire_ids: ["D-CMO-003"],
  },
  {
    id: "G-T010",
    agentId: "vw-cto",
    name: "Research AR Preview Feasibility",
    description: "Evaluate AR technology options and build proof-of-concept",
    hierarchy_level: "tactical",
    priority: 0.7,
    success_criteria: "Feasibility report delivered",
    deadline: "2027-06-30",
    parent_goal_id: "G-S009",
    desire_ids: ["D-CTO-003"],
  },
  {
    id: "G-T011",
    agentId: "vw-cmo",
    name: "Grow Consumer Segment to 65% Revenue",
    description: "Build individual art collector customer base as primary revenue driver",
    hierarchy_level: "tactical",
    priority: 0.8,
    success_criteria: "Consumer revenue >= 65%",
    deadline: "2026-12-31",
    parent_goal_id: "G-S003",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-T012",
    agentId: "vw-cmo",
    name: "Build Designer Segment to 25% Revenue",
    description: "Develop interior designer trade program partnerships",
    hierarchy_level: "tactical",
    priority: 0.78,
    success_criteria: "Designer revenue >= 25%",
    deadline: "2027-12-31",
    parent_goal_id: "G-S003",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-T013",
    agentId: "vw-cmo",
    name: "Develop Commercial Segment to 15% Revenue",
    description: "Build B2B commercial accounts for hotels, offices, healthcare",
    hierarchy_level: "tactical",
    priority: 0.75,
    success_criteria: "Commercial revenue >= 15%",
    deadline: "2027-12-31",
    parent_goal_id: "G-S003",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-T014",
    agentId: "vw-coo",
    name: "Optimize Fulfillment to <7 Days",
    description: "Streamline order-to-delivery pipeline",
    hierarchy_level: "tactical",
    priority: 0.85,
    success_criteria: "Avg fulfillment <= 7 days",
    deadline: "2026-12-31",
    parent_goal_id: "G-S012",
    desire_ids: ["D-COO-001"],
  },
  {
    id: "G-T015",
    agentId: "vw-coo",
    name: "Reduce COGS from 60% to 55% Year 2",
    description: "Improve gross margins through scale and supplier negotiations",
    hierarchy_level: "tactical",
    priority: 0.82,
    success_criteria: "COGS <= 55%",
    deadline: "2027-12-31",
    parent_goal_id: "G-S002",
    desire_ids: ["D-COO-001", "D-CFO-003"],
  },

  // ── Operational Goals (Monthly/Weekly) ────────────────────────────
  {
    id: "G-O001",
    agentId: "vw-cfo",
    name: "Generate $192K Monthly Revenue",
    description: "Maintain monthly revenue run-rate of $192K to hit $2.3M annual target",
    hierarchy_level: "operational",
    priority: 0.9,
    success_criteria: "Monthly revenue >= $192K",
    deadline: "ongoing",
    parent_goal_id: "G-T001",
    desire_ids: ["D-CFO-002"],
  },
  {
    id: "G-O002",
    agentId: "vw-coo",
    name: "Fulfill 319 Orders/Month",
    description: "Process and ship average 319 orders per month",
    hierarchy_level: "operational",
    priority: 0.88,
    success_criteria: "Monthly orders >= 319",
    deadline: "ongoing",
    parent_goal_id: "G-T004",
    desire_ids: ["D-COO-001"],
  },
  {
    id: "G-O003",
    agentId: "vw-cmo",
    name: "Maintain $600 AOV Across Channels",
    description: "Monitor and optimize AOV across web, social, and partner channels",
    hierarchy_level: "operational",
    priority: 0.82,
    success_criteria: "Rolling 30-day AOV >= $600",
    deadline: "ongoing",
    parent_goal_id: "G-T005",
    desire_ids: ["D-CMO-001"],
  },
  {
    id: "G-O004",
    agentId: "vw-cmo",
    name: "Run Monthly Email Retention Campaigns",
    description: "Execute targeted email campaigns for customer retention and repeat purchases",
    hierarchy_level: "operational",
    priority: 0.78,
    success_criteria: "1 campaign/month, 30%+ open rate",
    deadline: "ongoing",
    parent_goal_id: "G-T006",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-O005",
    agentId: "vw-cmo",
    name: "Optimize Ad Spend to <$120/Acquisition",
    description: "Manage Facebook, Instagram, Pinterest ad budgets for CAC efficiency",
    hierarchy_level: "operational",
    priority: 0.8,
    success_criteria: "Blended CAC <= $120",
    deadline: "ongoing",
    parent_goal_id: "G-T007",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-O006",
    agentId: "vw-cmo",
    name: "Curate First 3 Limited Edition Collections",
    description: "Select and launch initial LE collections with numbered certificates",
    hierarchy_level: "operational",
    priority: 0.85,
    success_criteria: "3 LE collections launched",
    deadline: "2026-06-30",
    parent_goal_id: "G-T008",
    desire_ids: ["D-CMO-003"],
  },
  {
    id: "G-O007",
    agentId: "vw-coo",
    name: "Produce 50-100 Prints Per LE Run",
    description: "Manage limited edition print runs at 50-100 units with quality control",
    hierarchy_level: "operational",
    priority: 0.8,
    success_criteria: "Each LE run 50-100 units",
    deadline: "ongoing",
    parent_goal_id: "G-T008",
    desire_ids: ["D-COO-001", "D-COO-003"],
  },
  {
    id: "G-O008",
    agentId: "vw-cmo",
    name: "Price LEs at 35% Premium Over Standard",
    description: "Set and maintain limited edition pricing at 35% above standard prints",
    hierarchy_level: "operational",
    priority: 0.78,
    success_criteria: "LE price premium >= 35%",
    deadline: "ongoing",
    parent_goal_id: "G-T009",
    desire_ids: ["D-CMO-003"],
  },
  {
    id: "G-O009",
    agentId: "vw-coo",
    name: "Maintain <24hr Customer Response Time",
    description: "Respond to all customer inquiries within 24 hours",
    hierarchy_level: "operational",
    priority: 0.85,
    success_criteria: "Avg response time < 24hrs",
    deadline: "ongoing",
    parent_goal_id: "G-T014",
    desire_ids: ["D-COO-001"],
  },
  {
    id: "G-O010",
    agentId: "vw-coo",
    name: "Achieve 95%+ Print Quality Score",
    description: "Maintain 300+ DPI, 95%+ color accuracy on all prints",
    hierarchy_level: "operational",
    priority: 0.88,
    success_criteria: "Quality score >= 95%",
    deadline: "ongoing",
    parent_goal_id: "G-T014",
    desire_ids: ["D-COO-003"],
  },
  {
    id: "G-O011",
    agentId: "vw-coo",
    name: "Negotiate Bulk Material Discounts",
    description: "Secure volume discounts with canvas, ink, and framing suppliers",
    hierarchy_level: "operational",
    priority: 0.75,
    success_criteria: ">=10% discount on bulk orders",
    deadline: "2026-09-30",
    parent_goal_id: "G-T015",
    desire_ids: ["D-COO-002"],
  },
  {
    id: "G-O012",
    agentId: "vw-cmo",
    name: "Run Facebook/Instagram/Pinterest Campaigns",
    description: "Execute weekly social media advertising across 3 platforms",
    hierarchy_level: "operational",
    priority: 0.8,
    success_criteria: "Active campaigns on 3 platforms",
    deadline: "ongoing",
    parent_goal_id: "G-T011",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-O013",
    agentId: "vw-cmo",
    name: "Recruit 50 Interior Designer Partners",
    description: "Build trade program with 50 active designer accounts",
    hierarchy_level: "operational",
    priority: 0.75,
    success_criteria: ">=50 designer accounts",
    deadline: "2026-12-31",
    parent_goal_id: "G-T012",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-O014",
    agentId: "vw-cmo",
    name: "Close 5 Commercial Accounts",
    description: "Sign 5 commercial clients (hotels, offices, healthcare facilities)",
    hierarchy_level: "operational",
    priority: 0.73,
    success_criteria: ">=5 commercial accounts",
    deadline: "2026-12-31",
    parent_goal_id: "G-T013",
    desire_ids: ["D-CMO-002"],
  },
  {
    id: "G-O015",
    agentId: "vw-coo",
    name: "Reduce Return Rate to <5%",
    description: "Minimize returns through quality assurance and accurate product imagery",
    hierarchy_level: "operational",
    priority: 0.82,
    success_criteria: "Return rate < 5%",
    deadline: "ongoing",
    parent_goal_id: "G-T015",
    desire_ids: ["D-COO-003"],
  },
];

interface BeliefSeed {
  id: string;
  agentId: string;
  category: string;
  certainty: number;
  subject: string;
  content: string;
  source: string;
  supports_goals: string[];
}

const BELIEFS: BeliefSeed[] = [
  {
    id: "B-001",
    agentId: "vw-cmo",
    category: "environment",
    certainty: 0.85,
    subject: "target-market",
    content:
      "VividWalls target market is 35-65 year olds with household income >$75K who value quality art for personal spaces",
    source: "BRD market research",
    supports_goals: ["G-S003", "G-T011"],
  },
  {
    id: "B-002",
    agentId: "vw-cfo",
    category: "environment",
    certainty: 0.8,
    subject: "pricing-power",
    content:
      "Premium abstract art market supports $600+ average order value with free shipping threshold at $250",
    source: "BMC pricing analysis",
    supports_goals: ["G-S004", "G-T005"],
  },
  {
    id: "B-003",
    agentId: "vw-cmo",
    category: "environment",
    certainty: 0.9,
    subject: "scarcity-value",
    content:
      "Limited editions at 50-100 units with numbered certificates drive 25-50% price premium via FOMO",
    source: "LE strategy analysis",
    supports_goals: ["G-S007", "G-T008", "G-T009"],
  },
  {
    id: "B-004",
    agentId: "vw-cto",
    category: "self",
    certainty: 0.75,
    subject: "ai-efficiency",
    content:
      "AI-driven operations can reduce costs by 12% over 5 years while improving personalization",
    source: "Financial model projection",
    supports_goals: ["G-S002", "G-S010"],
  },
  {
    id: "B-005",
    agentId: "vw-cmo",
    category: "environment",
    certainty: 0.8,
    subject: "designer-channel",
    content:
      "Interior designer channel represents 25% revenue opportunity with 10% trade discount model",
    source: "BMC channel analysis",
    supports_goals: ["G-T012", "G-O013"],
  },
  {
    id: "B-006",
    agentId: "vw-coo",
    category: "self",
    certainty: 0.85,
    subject: "quality-standard",
    content:
      "300+ DPI print resolution with 95%+ color accuracy and archival inks is achievable at scale",
    source: "Production capability assessment",
    supports_goals: ["G-O010", "G-O015"],
  },
  {
    id: "B-007",
    agentId: "vw-cfo",
    category: "environment",
    certainty: 0.7,
    subject: "market-risk",
    content:
      "New AI-driven art platforms pose competitive threat but VividWalls' quality focus provides defensibility",
    source: "Competitive analysis",
    supports_goals: ["G-S008"],
  },
  {
    id: "B-008",
    agentId: "vw-cmo",
    category: "environment",
    certainty: 0.78,
    subject: "commercial-opportunity",
    content:
      "Hotels, offices, and healthcare facilities represent $3,600 average order commercial segment",
    source: "BMC segment analysis",
    supports_goals: ["G-T013", "G-O014"],
  },
];

// ── Tool Parameters ─────────────────────────────────────────────────────

const GoalSeedParams = Type.Object({
  business_id: Type.String({ description: "Business ID (e.g., 'vividwalls')" }),
  database: Type.Optional(
    Type.String({ description: "TypeDB database name (defaults to 'mabos')" }),
  ),
});

// ── Tool Factory ────────────────────────────────────────────────────────

export function createGoalSeedTools(_api: OpenClawPluginApi): AnyAgentTool[] {
  return [
    {
      name: "goal_seed_business",
      label: "Seed Business Goals",
      description:
        "Seed the TypeDB knowledge graph with VividWalls business goals, desires, and beliefs " +
        "from the BRD/financial model. Uses TOGAF 3-tier goal hierarchy with Tropos agent mapping.",
      parameters: GoalSeedParams,
      async execute(_id: string, params: Static<typeof GoalSeedParams>) {
        const client = getTypeDBClient();
        if (!client.isAvailable()) {
          const connected = await client.connect();
          if (!connected) {
            return textResult("TypeDB is not available. Start the server first.");
          }
        }

        const dbName = params.database || "mabos";
        const counts = {
          agents: 0,
          desires: 0,
          goals: 0,
          beliefs: 0,
          desire_goal_links: 0,
          belief_goal_links: 0,
          errors: [] as string[],
        };

        try {
          await client.ensureDatabase(dbName);
        } catch (e) {
          return textResult(
            `Failed to ensure database "${dbName}": ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        // 1. Insert agents
        for (const agent of AGENTS) {
          try {
            await client.insertData(
              `insert $agent isa agent, has uid ${JSON.stringify(agent.id)}, has name ${JSON.stringify(agent.name)};`,
              dbName,
            );
            counts.agents++;
          } catch {
            // Agent may already exist
          }
        }

        // 2. Insert desires
        for (const d of DESIRES) {
          try {
            const typeql = DesireStoreQueries.createDesire(d.agentId, {
              id: d.id,
              name: d.name,
              description: d.description,
              priority: d.priority,
              importance: d.importance,
              urgency: d.urgency,
              alignment: d.alignment,
              category: d.category,
            });
            await client.insertData(typeql, dbName);
            counts.desires++;
          } catch (e) {
            counts.errors.push(`Desire ${d.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // 3. Insert goals
        for (const g of GOALS) {
          try {
            const typeql = GoalStoreQueries.createGoal(g.agentId, {
              id: g.id,
              name: g.name,
              description: g.description,
              hierarchy_level: g.hierarchy_level,
              priority: g.priority,
              success_criteria: g.success_criteria,
              deadline: g.deadline,
              parent_goal_id: g.parent_goal_id,
            });
            await client.insertData(typeql, dbName);
            counts.goals++;
          } catch (e) {
            counts.errors.push(`Goal ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // 4. Link desires → goals
        for (const g of GOALS) {
          for (const desireId of g.desire_ids) {
            try {
              const typeql = GoalStoreQueries.linkDesireToGoal(g.agentId, desireId, g.id);
              await client.insertData(typeql, dbName);
              counts.desire_goal_links++;
            } catch (e) {
              counts.errors.push(
                `Link ${desireId}→${g.id}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }

        // 5. Insert beliefs
        for (const b of BELIEFS) {
          try {
            const typeql = BeliefStoreQueries.createBelief(b.agentId, {
              id: b.id,
              category: b.category,
              certainty: b.certainty,
              subject: b.subject,
              content: b.content,
              source: b.source,
            });
            await client.insertData(typeql, dbName);
            counts.beliefs++;
          } catch (e) {
            counts.errors.push(`Belief ${b.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // 6. Link beliefs → goals
        for (const b of BELIEFS) {
          for (const goalId of b.supports_goals) {
            try {
              const typeql = BeliefStoreQueries.linkBeliefToGoal(b.agentId, b.id, goalId);
              await client.insertData(typeql, dbName);
              counts.belief_goal_links++;
            } catch (e) {
              counts.errors.push(
                `Link ${b.id}→${goalId}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }

        const errorSummary =
          counts.errors.length > 0
            ? `\n\n### Errors (${counts.errors.length})\n${counts.errors
                .slice(0, 10)
                .map((e) => `- ${e}`)
                .join(
                  "\n",
                )}${counts.errors.length > 10 ? `\n- ... and ${counts.errors.length - 10} more` : ""}`
            : "";

        return textResult(`## VividWalls Knowledge Graph Seeded

**Database:** ${dbName}
**Business:** ${params.business_id}

### Entities Inserted
- Agents: ${counts.agents}/${AGENTS.length}
- Desires: ${counts.desires}/${DESIRES.length}
- Goals: ${counts.goals}/${GOALS.length} (${GOALS.filter((g) => g.hierarchy_level === "strategic").length} strategic, ${GOALS.filter((g) => g.hierarchy_level === "tactical").length} tactical, ${GOALS.filter((g) => g.hierarchy_level === "operational").length} operational)
- Beliefs: ${counts.beliefs}/${BELIEFS.length}

### Relations Created
- desire_motivates_goal: ${counts.desire_goal_links}
- belief_supports_goal: ${counts.belief_goal_links}${errorSummary}`);
      },
    },
  ];
}
