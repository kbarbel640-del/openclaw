# Dual-Token Governance: Payment vs. Influence

## Your Insight

You want:
1. **Payment currency** - For actual transactions (NEAR, USDC, etc.)
2. **Influence currency** - For governance, voting, signaling priority

The influence currency:
- Renews on a schedule (weekly allocation)
- Can be banked or spent
- Shows conviction (spend more = signal stronger belief)
- Creates cooperative game dynamics

This is a sophisticated governance model that draws from several established patterns.

---

## Existing Models That Align With Your Thinking

### 1. Conviction Voting ([1Hive](https://1hive.org/), [Aragon](https://www.aragon.org/))

From [Quadratic vs Conviction Voting](https://markaicode.com/quadratic-vs-conviction-voting/):

- Votes accumulate **weight over time** (conviction builds)
- Longer you hold your vote on something, stronger it becomes
- Changing your vote resets your conviction
- Rewards **consistent, long-term thinking**
- Turns vote **buying** into vote **renting** (attackers must sustain spend)

**Pros:**
- Patient, thoughtful governance
- Resistant to flash attacks
- Rewards committed members

**Cons:**
- Slow for urgent decisions
- Complex to understand

### 2. Quadratic Voting

From [DAO Voting Mechanisms](https://limechain.tech/blog/dao-voting-mechanisms-explained-2022-guide/):

- Cost to vote increases **quadratically**
- 1 vote = 1 token, 2 votes = 4 tokens, 3 votes = 9 tokens
- Makes "going all in" **expensive but meaningful**
- Balances large and small holders

**Pros:**
- Reduces plutocracy (whale dominance)
- Shows intensity of preference
- More democratic

**Cons:**
- Sybil attacks (split into many wallets)
- Requires identity or caps

### 3. Your Model: "Conviction Budget" (New Hybrid)

Combines elements:
- **Budget allocation** (weekly tokens for influence)
- **Quadratic cost** (spending more shows conviction)
- **Banking** (save for important issues)
- **Cooperative signaling** (seeing someone go all-in tells others "pay attention")

---

## Proposed: MEATUS Dual-Token Model

### Token 1: $NEAR / $USDC (Payment)
- Actual value transfers
- Customer payments
- Partner payouts
- Infrastructure fees
- Profit distributions

### Token 2: $VOICE (Governance Influence)
- Non-transferable (soulbound to wallet)
- Renewable on schedule
- Spent to vote/signal
- Quadratic cost for intensity

---

## $VOICE Token Mechanics

### Allocation
```
Every Monday at 00:00 UTC:
├── Each council member receives: 100 $VOICE
├── Each executive agent receives: 50 $VOICE (for operational signals)
└── Each partner receives: 25 $VOICE (limited influence)

Maximum bankable: 300 $VOICE (3 weeks worth)
Expiry: Tokens older than 4 weeks expire
```

### Spending (Quadratic Cost)

```
Vote Strength    $VOICE Cost    Signal Meaning
────────────────────────────────────────────────
1 vote           1 $VOICE       "I have an opinion"
2 votes          4 $VOICE       "I care about this"
3 votes          9 $VOICE       "This matters to me"
4 votes          16 $VOICE      "I feel strongly"
5 votes          25 $VOICE      "This is critical"
6 votes          36 $VOICE      "I'm going all in"
7 votes          49 $VOICE      "Override my other priorities"
8 votes          64 $VOICE      "This defines my position"
9 votes          81 $VOICE      "Bet the farm"
10 votes         100 $VOICE     "Maximum conviction"
```

### Example Scenario

**Proposal:** "Add new partner DAO for threat intelligence"

```
Founder 1 (has 150 $VOICE banked):
├── Votes: 3 (costs 9 $VOICE)
├── Remaining: 141 $VOICE
└── Signal: "I think this is good"

Founder 2 (has 200 $VOICE banked):
├── Votes: 7 (costs 49 $VOICE)
├── Remaining: 151 $VOICE
└── Signal: "I really want this, I'm spending significant voice"

Founder 3 (has 100 $VOICE banked):
├── Votes: 10 (costs 100 $VOICE)
├── Remaining: 0 $VOICE
└── Signal: "This is the most important thing to me right now"

Orchestrator Agent (has 50 $VOICE):
├── Votes: 4 (costs 16 $VOICE)
├── Remaining: 34 $VOICE
└── Signal: "Operationally, this would help a lot"

Total vote weight: 3 + 7 + 10 + 4 = 24 votes
```

### What This Reveals

When Founder 3 spends **all** their voice:
- Other members see: "They're betting everything on this"
- Creates conversation: "Why do you care so much?"
- Might change minds: "If it matters that much to them..."
- Or might not: "I disagree but I respect your conviction"

This is your **cooperative game** dynamic - seeing someone's commitment reveals their priorities and invites dialogue.

---

## The "What Do You Really Want" Dynamic

In negotiation, the best outcomes come from understanding underlying interests, not just positions.

**Traditional voting:**
- "I vote yes" / "I vote no"
- No intensity information
- No dialogue trigger

**$VOICE voting:**
- "I spent 49 $VOICE on this" → "You really care, why?"
- "I spent 1 $VOICE" → "You don't care much, open to persuasion?"
- "I spent 100 $VOICE" → "This is your hill to die on, let's talk"

### Built-In Negotiation Mechanics

```
Proposal A: Add Partner X
├── Founder 1: 25 $VOICE (5 votes) FOR
├── Founder 2: 64 $VOICE (8 votes) AGAINST
└── Founder 3: 9 $VOICE (3 votes) FOR

Result: 8 vs 8 (tie-ish but Founder 2 spent WAY more)

Dialogue triggered:
"Founder 2, you spent 64 $VOICE against this. What would
make you comfortable? What's your real concern?"

Founder 2: "I'm worried about their data quality. If they
can show 3 months of accuracy metrics, I'd support it."

New proposal: "Add Partner X with 3-month probation period"
├── Founder 1: 4 $VOICE (2 votes) FOR
├── Founder 2: 4 $VOICE (2 votes) FOR ← Changed position!
└── Founder 3: 4 $VOICE (2 votes) FOR

Passed with less total spend because everyone aligned.
```

---

## Agent-Triggered Voting

### Operations Agent Surfaces Issues

The Orchestrator or an Operations agent can **trigger votes** when it detects:

1. **Efficiency opportunities**
   - "I've noticed 40% of jobs use Partner X. Should we negotiate bulk pricing?"

2. **Quality issues**
   - "Partner Y has failed 15% of jobs this month. Review partnership?"

3. **Customer requests**
   - "5 customers have asked for crypto payment option. Add feature?"

4. **Resource constraints**
   - "Queue times exceeding SLA. Request infrastructure expansion?"

### Agent Vote Triggering

```
Agent triggers:
├── Creates proposal automatically
├── Spends some $VOICE to surface it (shows agent believes it's important)
├── Notifies human council members
└── Waits for human votes

Agent cannot:
├── Cast deciding votes on governance
├── Spend more than 25 $VOICE on any single proposal
└── Create more than 3 proposals per week
```

---

## Implementation on NEAR

### Can Sputnik DAO Support This?

Sputnik DAO v2 has basic voting but not quadratic/conviction voting built-in. Options:

**Option A: Custom Smart Contract**
- Build our own governance contract
- Full control over mechanics
- More development work

**Option B: Extend Sputnik**
- Use Sputnik for execution (treasury, payments)
- Add separate $VOICE contract for signaling
- Proposals created based on $VOICE signals

**Option C: Use Existing Tools**
- [Gardens](https://gardens.1hive.org/) - Conviction voting on various chains
- [Snapshot](https://snapshot.org/) - Off-chain signaling with strategies
- Custom NEAR contract for $VOICE

### Recommended: Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOVERNANCE LAYER                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     $VOICE Contract                                  │   │
│  │                                                                      │   │
│  │  - Mints weekly allocation to members                               │   │
│  │  - Tracks balances (non-transferable)                               │   │
│  │  - Records votes with quadratic cost                                │   │
│  │  - Emits VoteRecorded events                                        │   │
│  │                                                                      │   │
│  │  Functions:                                                         │   │
│  │  - allocate_weekly()                                                │   │
│  │  - vote(proposal_id, vote_strength, direction)                      │   │
│  │  - get_balance(account)                                             │   │
│  │  - get_votes(proposal_id)                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Sputnik DAO v2                                   │   │
│  │                                                                      │   │
│  │  - Treasury management                                              │   │
│  │  - Execution of approved proposals                                  │   │
│  │  - Role-based permissions                                           │   │
│  │  - On-chain actions                                                 │   │
│  │                                                                      │   │
│  │  Proposal execution triggered when:                                 │   │
│  │  - $VOICE threshold reached                                         │   │
│  │  - Minimum participation met                                        │   │
│  │  - No blocking votes above threshold                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Potential Failure Modes (You Asked!)

### Risk 1: Hoarding
**Problem:** Everyone banks $VOICE, no one votes on small things
**Mitigation:**
- Decay over time (use it or lose it after 4 weeks)
- Minimum participation requirements
- Agents can surface low-vote proposals for attention

### Risk 2: All-In Battles
**Problem:** Two members go all-in on opposite sides, deadlock
**Mitigation:**
- Dialogue requirement before all-in (must state reasoning)
- Cooling-off period for high-conviction votes
- Mediation trigger at certain thresholds

### Risk 3: Conviction Manipulation
**Problem:** Fake strong feelings to influence others
**Mitigation:**
- Track voting history (patterns of manipulation visible)
- Reputation system (history of going all-in on things that failed)
- Post-vote retrospectives

### Risk 4: Agent Gaming
**Problem:** Agents learn to game the system
**Mitigation:**
- Agent $VOICE caps
- Human override always available
- Agent voting visible and auditable

---

## Is This a Recipe for Disaster?

**Honest answer:** It's an experiment.

**What makes it NOT a disaster:**
1. **Transparency** - Everyone sees everyone's spend
2. **Dialogue trigger** - High conviction invites conversation
3. **Renewable** - Weekly reset prevents permanent lockout
4. **Caps** - No one can dominate forever
5. **Human override** - Council can always emergency override

**What could go wrong:**
1. Analysis paralysis (too much thinking about votes)
2. Political gaming (saving votes to block others)
3. Hurt feelings (going all-in and losing)

**Mitigation:** Start simple, iterate. Begin with:
- Basic $VOICE allocation
- Simple quadratic voting
- Observe behavior
- Adjust mechanics based on real usage

---

## Game Theory Foundations

You mentioned reading von Neumann. This model draws from several foundational concepts:

### Von Neumann & Morgenstern: Cooperative Games

From *Theory of Games and Economic Behavior* (1944):

**Key insight:** In cooperative games, players can form coalitions and make binding agreements. The question becomes: how do you divide the payoff fairly?

**Relevance to $VOICE:**
- DAO members are in a cooperative game (aligned goals)
- $VOICE spending reveals **utility functions** (what do you value?)
- High conviction signals = "I value this outcome highly"
- Enables **side payments** in the form of vote trading
- Creates incentive for **coalition formation** around shared priorities

### The Shapley Value (Lloyd Shapley, 1953)

**Concept:** Fair division of payoff based on marginal contribution

**Relevance:**
- Members who contribute more (infrastructure, capital, expertise) should have proportional influence
- But $VOICE equalizes: everyone gets same weekly allocation
- Conviction spending then reveals who *cares more* (not who *has more*)

### Revealed Preference Theory

**Concept:** Actions reveal true preferences better than words

**Relevance:**
- Quadratic cost makes lying expensive
- Going "all-in" reveals true priorities
- Voting history creates preference profile

### Schelling Points (Thomas Schelling, 1960)

**Concept:** Focal points for coordination without communication

**Relevance:**
- High-conviction votes create focal points
- "Founder 3 went all-in on this" = coordination signal
- Others can rally around visible commitment

### Positive-Sum Outcomes (Pareto Efficiency)

**Von Neumann's key insight:** Cooperative games can be positive-sum

**Relevance:**
- Finding what others "really want" enables Pareto improvements
- "I'll support your priority if you support mine"
- $VOICE makes these trades visible and costable

### Nash Equilibrium Considerations

**Risk:** Gaming can create bad equilibria (everyone hoards, nobody votes)

**Mitigation:**
- Decay forces participation
- Agents surface issues (external trigger)
- Weekly renewal prevents permanent lock-in

---

## Simple Starting Point

For MVP, implement:

1. **$VOICE token** (NEP-141 compliant, non-transferable)
2. **Weekly allocation** (100 per council member)
3. **Quadratic voting** (cost = votes²)
4. **Bank limit** (max 300)
5. **Expiry** (4 weeks)
6. **Basic proposal system** (title, description, vote)

Iterate from there based on actual usage patterns.

---

## Resources

- [Conviction Voting Explained](https://medium.com/giveth/conviction-voting-a-novel-continuous-decision-making-alternative-to-governance-aa746cfb9475)
- [Quadratic Voting](https://www.radicalxchange.org/concepts/plural-voting/)
- [1Hive Gardens](https://gardens.1hive.org/)
- [Aragon Governance](https://www.aragon.org/how-to/set-your-dao-governance)
- [DAO Voting Mechanisms Compared](https://limechain.tech/blog/dao-voting-mechanisms-explained-2022-guide/)

---

*Next: Design the $VOICE smart contract*
