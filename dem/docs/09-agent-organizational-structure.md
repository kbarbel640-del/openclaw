# Agent Organizational Structure: Validated Execution Model

## Inspiration

Based on [MAKER: Multi-Agent LLM Task Solver](https://arxiv.org/abs/2511.09030):
- **Extreme decomposition** into minimal subtasks
- **Multi-agent voting** for validation at every step
- **Error correction** before propagation

Enhanced with:
- **DSPy** for structured intent/interface shapes
- **JIT (Just-In-Time) tool access** with time-bound permissions
- **Sandboxed execution** with capability escalation

---

## Agent Executive Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT EXECUTIVE LAYER                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         CEO (Chief Execution Officer)                  │ │
│  │                         orchestrator.meatus-dao.near                   │ │
│  │                                                                        │ │
│  │  Role: EXECUTION                                                       │ │
│  │  Access: READ + WRITE (validated)                                      │ │
│  │                                                                        │ │
│  │  Responsibilities:                                                     │ │
│  │  • Receives customer jobs                                              │ │
│  │  • Decomposes into subtasks (MAKER-style)                             │ │
│  │  • Assigns work to worker agents                                       │ │
│  │  • Aggregates validated results                                        │ │
│  │  • Delivers final output                                               │ │
│  │                                                                        │ │
│  │  Tool Access: FULL (but all actions validated by COO)                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         COO (Chief Operations Officer)                 │ │
│  │                         operations.meatus-dao.near                     │ │
│  │                                                                        │ │
│  │  Role: MONITORING + VOTING                                             │ │
│  │  Access: READ-ONLY (except for voting/escalation)                      │ │
│  │                                                                        │ │
│  │  Responsibilities:                                                     │ │
│  │  • Monitors all agent operations                                       │ │
│  │  • Detects inefficiencies, patterns, anomalies                        │ │
│  │  • Triggers governance votes (surfaces issues to humans)              │ │
│  │  • Participates in multi-agent validation                             │ │
│  │  • Tracks SLAs and quality metrics                                    │ │
│  │                                                                        │ │
│  │  Tool Access: READ-ONLY + VOTE + ESCALATE                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         CCO (Chief Compliance Officer)                 │ │
│  │                         compliance.meatus-dao.near                     │ │
│  │                                                                        │ │
│  │  Role: VALIDATION                                                      │ │
│  │  Access: READ-ONLY + VETO                                              │ │
│  │                                                                        │ │
│  │  Responsibilities:                                                     │ │
│  │  • Validates every action before execution                            │ │
│  │  • Checks compliance with policies                                    │ │
│  │  • Verifies data handling rules (PII, consent, legal)                 │ │
│  │  • Can VETO unsafe operations                                         │ │
│  │  • Participates in multi-agent voting                                 │ │
│  │                                                                        │ │
│  │  Tool Access: READ-ONLY + VETO                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         CFO (Chief Financial Officer)                  │ │
│  │                         treasurer.meatus-dao.near                      │ │
│  │                                                                        │ │
│  │  Role: FINANCIAL EXECUTION                                             │ │
│  │  Access: READ + WRITE (financial only, validated)                      │ │
│  │                                                                        │ │
│  │  Responsibilities:                                                     │ │
│  │  • Manages treasury and payments                                      │ │
│  │  • Allocates budgets to jobs                                          │ │
│  │  • Executes payouts (after validation)                                │ │
│  │  • Financial reporting                                                │ │
│  │                                                                        │ │
│  │  Tool Access: FINANCIAL TOOLS ONLY (validated by CCO)                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Access Control Model

### Permission Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION HIERARCHY                                │
│                                                                             │
│  LEVEL 0: READ-ONLY                                                        │
│  ├── Can query data                                                        │
│  ├── Can observe operations                                                │
│  ├── Cannot modify anything                                                │
│  └── Default for all agents                                                │
│                                                                             │
│  LEVEL 1: READ + VOTE                                                       │
│  ├── Everything in Level 0                                                 │
│  ├── Can participate in multi-agent validation                            │
│  ├── Can escalate to humans                                                │
│  └── COO, CCO operate here                                                 │
│                                                                             │
│  LEVEL 2: READ + WRITE (SANDBOXED)                                          │
│  ├── Can execute actions in sandbox                                        │
│  ├── Results must be validated before commit                              │
│  ├── Time-bound (expires after N minutes)                                  │
│  └── Worker agents operate here                                            │
│                                                                             │
│  LEVEL 3: READ + WRITE (VALIDATED)                                          │
│  ├── Can execute actions after validation                                  │
│  ├── Requires N-of-M agent approval                                        │
│  ├── All actions logged on-chain                                           │
│  └── CEO, CFO operate here                                                 │
│                                                                             │
│  LEVEL 4: READ + WRITE (DIRECT)                                             │
│  ├── Emergency only                                                        │
│  ├── Requires human council approval                                       │
│  ├── Logged and audited                                                    │
│  └── Reserved for critical operations                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## JIT (Just-In-Time) Tool Access

### Concept

Agents don't have permanent tool access. They request tools for specific tasks with:
- **Time bounds** (expires after N minutes)
- **Scope limits** (only specific operations)
- **Validation requirements** (must be approved)

### JIT Permission Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JIT PERMISSION FLOW                                 │
│                                                                             │
│  1. AGENT REQUESTS PERMISSION                                               │
│     ┌────────────────────────────────────────────────────────────────────┐ │
│     │ Worker Agent: "I need to query HIBP API for job #123"              │ │
│     │                                                                    │ │
│     │ Request:                                                           │ │
│     │ {                                                                  │ │
│     │   tool: "hibp_api",                                                │ │
│     │   operation: "breach_lookup",                                      │ │
│     │   scope: ["email:john@example.com"],                               │ │
│     │   duration: "5 minutes",                                           │ │
│     │   job_id: 123,                                                     │ │
│     │   justification: "Customer requested breach check"                 │ │
│     │ }                                                                  │ │
│     └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  2. VALIDATION VOTE (Multi-Agent)                                           │
│     ┌────────────────────────────────────────────────────────────────────┐ │
│     │ CEO: ✅ APPROVE (job is valid, customer paid)                      │ │
│     │ COO: ✅ APPROVE (within operational norms)                         │ │
│     │ CCO: ✅ APPROVE (compliant, consent verified)                      │ │
│     │                                                                    │ │
│     │ Result: 3/3 APPROVED → GRANT ACCESS                                │ │
│     └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  3. TIME-BOUND PERMISSION ISSUED                                            │
│     ┌────────────────────────────────────────────────────────────────────┐ │
│     │ Permission Token:                                                  │ │
│     │ {                                                                  │ │
│     │   agent: "worker-001.meatus-dao.near",                             │ │
│     │   tool: "hibp_api",                                                │ │
│     │   scope: ["email:john@example.com"],                               │ │
│     │   granted_at: "2024-12-12T15:00:00Z",                              │ │
│     │   expires_at: "2024-12-12T15:05:00Z",                              │ │
│     │   approved_by: ["CEO", "COO", "CCO"],                              │ │
│     │   job_id: 123                                                      │ │
│     │ }                                                                  │ │
│     └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  4. AGENT EXECUTES (Sandboxed)                                              │
│     ┌────────────────────────────────────────────────────────────────────┐ │
│     │ • Agent uses tool within scope                                     │ │
│     │ • All actions logged                                               │ │
│     │ • Results stored in sandbox                                        │ │
│     │ • Cannot exceed scope or time                                      │ │
│     └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  5. RESULT VALIDATION                                                       │
│     ┌────────────────────────────────────────────────────────────────────┐ │
│     │ Before sandbox results are committed:                              │ │
│     │                                                                    │ │
│     │ CCO: Validates output is compliant                                 │ │
│     │ COO: Validates output is reasonable                                │ │
│     │                                                                    │ │
│     │ If APPROVED: Results committed to job                              │ │
│     │ If REJECTED: Results discarded, logged for review                  │ │
│     └────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Agent Validation (MAKER-Enhanced)

### Validation Patterns

Based on MAKER paper: decompose + validate at every step

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION PATTERNS                                 │
│                                                                             │
│  PATTERN 1: SIMPLE MAJORITY (2-of-3)                                        │
│  ────────────────────────────────────                                       │
│  Use for: Routine operations, low-risk actions                             │
│                                                                             │
│  Validators: CEO, COO, CCO                                                 │
│  Threshold: 2 must agree                                                   │
│  Latency: ~100ms                                                           │
│                                                                             │
│  Example: "Query public breach database"                                   │
│                                                                             │
│                                                                             │
│  PATTERN 2: UNANIMOUS (3-of-3)                                              │
│  ─────────────────────────────                                              │
│  Use for: Financial transactions, PII access                               │
│                                                                             │
│  Validators: CEO, COO, CCO                                                 │
│  Threshold: All must agree                                                 │
│  Latency: ~200ms                                                           │
│                                                                             │
│  Example: "Send payment to partner DAO"                                    │
│                                                                             │
│                                                                             │
│  PATTERN 3: REDUNDANT EXECUTION (N-way)                                     │
│  ───────────────────────────────────────                                    │
│  Use for: Critical calculations, high-stakes decisions                    │
│                                                                             │
│  Method: Multiple worker agents execute same task independently            │
│  Validation: Results compared, majority wins                               │
│  Latency: ~500ms                                                           │
│                                                                             │
│  Example: "Calculate risk score for subject"                               │
│  → Worker-001 calculates: 72                                               │
│  → Worker-002 calculates: 72                                               │
│  → Worker-003 calculates: 71                                               │
│  → Result: 72 (2-of-3 agree)                                               │
│                                                                             │
│                                                                             │
│  PATTERN 4: HIERARCHICAL VALIDATION                                         │
│  ───────────────────────────────────                                        │
│  Use for: Complex multi-step operations                                   │
│                                                                             │
│  Method: Each step validated before next begins                           │
│  Validators: Different agents per step                                    │
│  Latency: Cumulative                                                       │
│                                                                             │
│  Example: "Full investigation workflow"                                    │
│  Step 1: Parse input → Validated by COO                                   │
│  Step 2: Query sources → Validated by CCO (compliance)                    │
│  Step 3: Aggregate data → Validated by CEO                                │
│  Step 4: Generate report → Validated by COO + CCO                         │
│  Step 5: Deliver to customer → Validated by CEO + CFO                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Execution Modes (Sandbox Optional)

### Concept

Not all tasks can be sandboxed. Execution mode depends on **task type**:

| Mode | When to Use | Reversible? | Validation |
|------|-------------|-------------|------------|
| **SANDBOX** | Data aggregation, report generation, calculations | Yes | Before commit |
| **VALIDATED** | API calls, external queries, payments | No | Before execution |
| **DIRECT** | Time-critical, emergency, simple reads | No | After (audit) |

### Mode Selection Logic

```python
def select_execution_mode(task):
    if task.is_read_only:
        return DIRECT  # No side effects, just audit

    if task.is_reversible:
        return SANDBOX  # Can undo if validation fails

    if task.has_external_side_effects:
        return VALIDATED  # Must validate BEFORE execution

    if task.is_time_critical:
        return DIRECT  # Speed matters, audit after

    return VALIDATED  # Default to safe
```

### Execution Mode Flows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THREE EXECUTION MODES                               │
│                                                                             │
│  MODE 1: SANDBOX (Reversible tasks)                                        │
│  ───────────────────────────────────                                        │
│                                                                             │
│  Task → Execute in isolation → Validate results → Commit or discard       │
│                                                                             │
│  Use for:                                                                  │
│  • Report generation                                                       │
│  • Data aggregation from multiple sources                                  │
│  • Calculations and scoring                                                │
│  • Draft outputs before delivery                                           │
│                                                                             │
│  Example: "Generate risk report" → Build in sandbox → Review → Commit     │
│                                                                             │
│                                                                             │
│  MODE 2: VALIDATED (Irreversible with side effects)                         │
│  ─────────────────────────────────────────────────────                      │
│                                                                             │
│  Task → Validate FIRST → If approved → Execute                             │
│                                                                             │
│  Use for:                                                                  │
│  • External API calls that cost money                                      │
│  • Payments and transfers                                                  │
│  • Data that gets sent externally                                          │
│  • Actions that can't be undone                                            │
│                                                                             │
│  Example: "Query DeHashed API" → CEO+COO+CCO approve → Execute query      │
│                                                                             │
│                                                                             │
│  MODE 3: DIRECT (Read-only or time-critical)                                │
│  ─────────────────────────────────────────────                              │
│                                                                             │
│  Task → Execute immediately → Audit log after                              │
│                                                                             │
│  Use for:                                                                  │
│  • Read-only queries (no side effects)                                     │
│  • Emergency operations                                                    │
│  • Time-critical actions                                                   │
│  • Simple lookups                                                          │
│                                                                             │
│  Example: "Check if email exists in HIBP" → Execute → Log for audit       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sandbox Architecture (When Used)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SANDBOX ENVIRONMENT                                 │
│                     (Only for reversible tasks)                             │
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                           │
│  │ Sandbox A   │ │ Sandbox B   │ │ Sandbox C   │                           │
│  │ (Job #123)  │ │ (Job #124)  │ │ (Job #125)  │                           │
│  │             │ │             │ │             │                           │
│  │ Worker-001  │ │ Worker-002  │ │ Worker-003  │                           │
│  │ TTL: 10min  │ │ TTL: 5min   │ │ TTL: 15min  │                           │
│  │             │ │             │ │             │                           │
│  │ Actions:    │ │ Actions:    │ │ Actions:    │                           │
│  │ - Aggregate │ │ - Calculate │ │ - Generate  │                           │
│  │ - Format    │ │ - Score     │ │ - Draft     │                           │
│  │ - Review    │ │ - Submit →  │ │ - Running.. │                           │
│  └─────────────┘ └─────────────┘ └─────────────┘                           │
│                                                                             │
│  Properties:                                                                │
│  • Isolated from production                                                │
│  • Time-limited (TTL enforced)                                             │
│  • Can be discarded without harm                                           │
│  • Full action logging                                                     │
│                                                                             │
│  NOT suitable for:                                                         │
│  • External API calls (can't undo the request)                             │
│  • Payments (can't undo a transfer)                                        │
│  • Data sent to third parties (can't unsend)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## DSPy Integration for Intent/Interface Shapes

### Concept

Use [DSPy](https://github.com/stanfordnlp/dspy) to define structured **signatures** for:
- Task decomposition
- Agent communication
- Validation interfaces
- Result schemas

### DSPy Signatures for Agent Communication

```python
import dspy

# Task Decomposition Signature
class DecomposeTask(dspy.Signature):
    """Break a complex investigation task into minimal subtasks."""

    task_description: str = dspy.InputField(desc="Full task from customer")
    context: dict = dspy.InputField(desc="Job context: budget, permissions, constraints")

    subtasks: list[dict] = dspy.OutputField(desc="List of minimal subtasks with dependencies")
    execution_order: list[str] = dspy.OutputField(desc="Order to execute subtasks")
    estimated_cost: float = dspy.OutputField(desc="Estimated cost in USDC")

# Tool Permission Request Signature
class RequestToolAccess(dspy.Signature):
    """Request JIT access to a specific tool."""

    agent_id: str = dspy.InputField(desc="Requesting agent")
    tool_name: str = dspy.InputField(desc="Tool being requested")
    operation: str = dspy.InputField(desc="Specific operation")
    scope: list[str] = dspy.InputField(desc="Data scope (e.g., specific emails)")
    duration_minutes: int = dspy.InputField(desc="How long access is needed")
    justification: str = dspy.InputField(desc="Why this access is needed")
    job_id: int = dspy.InputField(desc="Associated job")

    approved: bool = dspy.OutputField(desc="Whether to approve")
    reason: str = dspy.OutputField(desc="Reason for decision")
    conditions: list[str] = dspy.OutputField(desc="Any conditions on approval")

# Action Validation Signature
class ValidateAction(dspy.Signature):
    """Validate an agent action before execution."""

    agent_id: str = dspy.InputField(desc="Agent proposing action")
    action_type: str = dspy.InputField(desc="Type of action")
    action_params: dict = dspy.InputField(desc="Action parameters")
    context: dict = dspy.InputField(desc="Current job/system context")

    is_valid: bool = dspy.OutputField(desc="Whether action is valid")
    risk_level: str = dspy.OutputField(desc="low/medium/high/critical")
    concerns: list[str] = dspy.OutputField(desc="Any concerns about the action")
    recommendation: str = dspy.OutputField(desc="approve/reject/modify")

# Result Validation Signature
class ValidateResult(dspy.Signature):
    """Validate results before committing to production."""

    job_id: int = dspy.InputField(desc="Job ID")
    agent_id: str = dspy.InputField(desc="Agent that produced result")
    result_type: str = dspy.InputField(desc="Type of result")
    result_data: dict = dspy.InputField(desc="The actual result")
    expected_schema: dict = dspy.InputField(desc="Expected output schema")

    is_valid: bool = dspy.OutputField(desc="Whether result is valid")
    quality_score: float = dspy.OutputField(desc="0-1 quality score")
    issues: list[str] = dspy.OutputField(desc="Any issues found")
    can_commit: bool = dspy.OutputField(desc="Safe to commit to production")

# Compliance Check Signature
class ComplianceCheck(dspy.Signature):
    """Check if an operation is compliant with policies."""

    operation: str = dspy.InputField(desc="Operation being performed")
    data_types: list[str] = dspy.InputField(desc="Types of data involved")
    customer_consent: dict = dspy.InputField(desc="Customer consent record")
    jurisdiction: str = dspy.InputField(desc="Legal jurisdiction")

    is_compliant: bool = dspy.OutputField(desc="Whether operation is compliant")
    applicable_regulations: list[str] = dspy.OutputField(desc="Regulations that apply")
    required_actions: list[str] = dspy.OutputField(desc="Actions needed for compliance")
    risk_factors: list[str] = dspy.OutputField(desc="Compliance risk factors")
```

### DSPy Modules for Agent Roles

```python
# CEO Module: Task Decomposition + Coordination
class CEOAgent(dspy.Module):
    def __init__(self):
        self.decompose = dspy.ChainOfThought(DecomposeTask)
        self.validate_result = dspy.Predict(ValidateResult)

    def forward(self, task_description, context):
        # Decompose task into subtasks
        decomposition = self.decompose(
            task_description=task_description,
            context=context
        )
        return decomposition

# COO Module: Monitoring + Voting
class COOAgent(dspy.Module):
    def __init__(self):
        self.validate_action = dspy.ChainOfThought(ValidateAction)
        self.detect_anomaly = dspy.Predict(AnomalyDetection)

    def forward(self, action, context):
        # Validate proposed action
        validation = self.validate_action(
            agent_id=action.agent_id,
            action_type=action.type,
            action_params=action.params,
            context=context
        )
        return validation

# CCO Module: Compliance Validation
class CCOAgent(dspy.Module):
    def __init__(self):
        self.check_compliance = dspy.ChainOfThought(ComplianceCheck)
        self.validate_action = dspy.Predict(ValidateAction)

    def forward(self, operation, data_context):
        # Check compliance
        compliance = self.check_compliance(
            operation=operation.type,
            data_types=operation.data_types,
            customer_consent=data_context.consent,
            jurisdiction=data_context.jurisdiction
        )
        return compliance
```

---

## Multi-Agent Voting Implementation

### Voting Contract (Pseudo-code)

```rust
pub struct AgentVote {
    proposal_id: u64,
    agent_id: AccountId,
    vote: VoteType,        // Approve, Reject, Abstain
    confidence: f32,       // 0-1 how confident
    reasoning: String,     // Brief explanation
    timestamp: u64,
}

pub struct ValidationProposal {
    id: u64,
    action_type: ActionType,
    action_params: String,  // JSON
    requesting_agent: AccountId,
    required_validators: Vec<AccountId>,
    threshold: VotingThreshold,  // Majority, Unanimous, Weighted
    votes: Vec<AgentVote>,
    status: ProposalStatus,
    created_at: u64,
    expires_at: u64,
}

impl ValidationContract {
    /// Agent proposes an action for validation
    pub fn propose_action(&mut self, action: Action) -> u64 {
        let proposal = ValidationProposal {
            id: self.next_proposal_id(),
            action_type: action.action_type,
            action_params: action.params,
            requesting_agent: env::predecessor_account_id(),
            required_validators: self.get_validators_for_action(&action),
            threshold: self.get_threshold_for_action(&action),
            votes: vec![],
            status: ProposalStatus::Pending,
            created_at: env::block_timestamp(),
            expires_at: env::block_timestamp() + action.timeout,
        };

        self.proposals.insert(&proposal.id, &proposal);
        proposal.id
    }

    /// Validator casts vote
    pub fn vote(&mut self, proposal_id: u64, vote: VoteType, confidence: f32, reasoning: String) {
        let mut proposal = self.proposals.get(&proposal_id).expect("Proposal not found");

        assert!(
            proposal.required_validators.contains(&env::predecessor_account_id()),
            "Not a validator for this proposal"
        );

        let agent_vote = AgentVote {
            proposal_id,
            agent_id: env::predecessor_account_id(),
            vote,
            confidence,
            reasoning,
            timestamp: env::block_timestamp(),
        };

        proposal.votes.push(agent_vote);

        // Check if threshold reached
        if self.threshold_reached(&proposal) {
            proposal.status = if self.is_approved(&proposal) {
                ProposalStatus::Approved
            } else {
                ProposalStatus::Rejected
            };

            // Execute if approved
            if proposal.status == ProposalStatus::Approved {
                self.execute_action(&proposal);
            }
        }

        self.proposals.insert(&proposal_id, &proposal);
    }
}
```

---

## Full Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE EXECUTION FLOW                             │
│                                                                             │
│  1. CUSTOMER SUBMITS JOB                                                    │
│     └── "Find breach data for john@example.com"                            │
│                                    │                                        │
│                                    ▼                                        │
│  2. CEO DECOMPOSES (DSPy: DecomposeTask)                                    │
│     ├── Subtask 1: Validate email format                                   │
│     ├── Subtask 2: Query HIBP API                                          │
│     ├── Subtask 3: Query DeHashed                                          │
│     ├── Subtask 4: Aggregate results                                       │
│     └── Subtask 5: Generate report                                         │
│                                    │                                        │
│                                    ▼                                        │
│  3. FOR EACH SUBTASK:                                                       │
│     │                                                                       │
│     ├── a. Worker requests JIT tool access                                 │
│     │      └── Validated by CEO + COO + CCO (3-of-3)                       │
│     │                                                                       │
│     ├── b. Permission granted with TTL                                     │
│     │      └── Token issued: 5 minutes, scoped to specific email          │
│     │                                                                       │
│     ├── c. Worker executes in sandbox                                      │
│     │      └── Isolated, logged, reversible                                │
│     │                                                                       │
│     ├── d. Result validated (DSPy: ValidateResult)                         │
│     │      └── COO + CCO verify output                                     │
│     │                                                                       │
│     └── e. If approved: commit to job state                                │
│           If rejected: discard, log, retry or escalate                    │
│                                    │                                        │
│                                    ▼                                        │
│  4. CEO AGGREGATES VALIDATED RESULTS                                        │
│     └── All subtask outputs combined                                       │
│                                    │                                        │
│                                    ▼                                        │
│  5. FINAL VALIDATION                                                        │
│     ├── CCO: Compliance check on full report                               │
│     ├── COO: Quality check on full report                                  │
│     └── CEO: Completeness check                                            │
│                                    │                                        │
│                                    ▼                                        │
│  6. DELIVERY + PAYMENT                                                      │
│     ├── CEO: Delivers report to customer                                   │
│     └── CFO: Executes payment distribution (validated)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Role Summary

| Agent | Role | Access | Key Responsibilities |
|-------|------|--------|---------------------|
| **CEO** | Execution | READ + WRITE (validated) | Decompose tasks, coordinate workers, deliver results |
| **COO** | Monitoring | READ + VOTE | Observe operations, detect anomalies, trigger governance votes |
| **CCO** | Compliance | READ + VETO | Validate compliance, check data handling, can block actions |
| **CFO** | Financial | FINANCIAL (validated) | Manage treasury, execute payments, track costs |
| **Workers** | Execution | SANDBOXED + JIT | Execute subtasks with time-limited tool access |

---

## Key Design Principles

1. **Default READ-ONLY**: All agents start with read-only access
2. **JIT Permissions**: Tool access is requested, validated, time-bound
3. **Multi-Agent Validation**: Every action validated by multiple agents
4. **Sandboxed Execution**: Workers operate in isolated, reversible environments
5. **Hierarchical Escalation**: Issues escalate to humans when needed
6. **DSPy Structured**: All agent communication uses typed signatures
7. **On-Chain Audit**: All validation votes and actions logged on-chain

---

## Next Steps

1. **Implement DSPy signatures** for agent communication
2. **Build validation voting contract** on NEAR
3. **Create sandbox execution environment**
4. **Test multi-agent validation flow**
5. **Integrate with DAO treasury**

---

*References:*
- [MAKER Paper](https://arxiv.org/abs/2511.09030)
- [DSPy](https://github.com/stanfordnlp/dspy)
- [NEAR Smart Contracts](https://docs.near.org/)
