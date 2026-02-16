# Learning Path: DAO + Multisig + Agent Payment Flow

## What You Want to Learn

```
PAYMENT FLOW WITH DAO GOVERNANCE

Customer Payment
      │
      ▼
┌─────────────────┐
│  Conversion     │   USD/Crypto → USDC/NEAR
│  (Gateway)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DAO Treasury   │   Multisig wallet holds funds
│  (Multisig)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrator   │   Agent executes the job
│  Agent          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validation     │   Verify work was done correctly
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Payment        │   Pay data providers, services
│  Distribution   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DAO Owner      │   Remaining profit to DAO members
│  Wallets        │
└─────────────────┘
```

---

## Learning Modules

### Module 1: NEAR Basics
- Create accounts
- Understand NEAR's account model
- Send transactions
- Deploy a simple contract

### Module 2: Sputnik DAO
- What is Sputnik DAO
- Create a DAO
- Add members/roles
- Create and vote on proposals
- Treasury management

### Module 3: Multisig Wallets
- What is multisig (M of N signatures)
- NEAR multisig patterns
- Sputnik DAO as multisig
- Transaction approval flows

### Module 4: Smart Contract Basics
- Rust + near-sdk
- State management
- Cross-contract calls
- Payments and deposits

### Module 5: Agent Integration
- Off-chain agent watching on-chain events
- Agent executing with its own wallet
- Agent calling back to contracts
- Agent paying external services

### Module 6: Full Payment Flow
- End-to-end integration
- Testing on testnet
- Error handling
- Monitoring and logging

---

## Module 1: NEAR Basics

### 1.1 Install NEAR CLI

```bash
# Install Node.js if needed (v18+)
# Then install NEAR CLI
npm install -g near-cli-rs

# Verify installation
near --version
```

### 1.2 NEAR Account Model

NEAR uses human-readable account names (unlike Ethereum addresses):

```
Top-level accounts:    alice.near, bob.near
Sub-accounts:          app.alice.near, dao.alice.near
Testnet:               alice.testnet, myapp.testnet

Key concepts:
- Accounts can have multiple keys (full access, function call only)
- Accounts can hold NEAR tokens
- Accounts can have contracts deployed to them
- Sub-accounts are controlled by parent (initially)
```

### 1.3 Create Testnet Accounts

```bash
# Create your main testnet account
# Option 1: Use NEAR faucet (gets free testnet NEAR)
near create-account YOUR_NAME.testnet --useFaucet

# Option 2: Create via web wallet
# Visit: https://testnet.mynearwallet.com/

# Check account state
near view-account YOUR_NAME.testnet

# Check balance
near view-account YOUR_NAME.testnet --output json | jq '.amount'
```

### 1.4 Send Transactions

```bash
# Send NEAR to another account
near send YOUR_NAME.testnet recipient.testnet 1

# Call a contract method
near call CONTRACT_ID method_name '{"arg": "value"}' --accountId YOUR_NAME.testnet

# View a contract method (no gas, read-only)
near view CONTRACT_ID method_name '{"arg": "value"}'
```

---

## Module 2: Sputnik DAO

### 2.1 What is Sputnik DAO?

Sputnik is NEAR's native DAO framework:
- **Treasury**: Holds funds, controlled by governance
- **Proposals**: Members create proposals for actions
- **Voting**: Members vote to approve/reject
- **Roles**: Different permissions for different member types
- **Policies**: Rules for voting thresholds, bonds, etc.

### 2.2 Create a DAO

**Option 1: Use AstroDAO UI (Recommended for Learning)**

1. Visit: https://testnet.app.astrodao.com/
2. Connect your testnet wallet
3. Click "Create DAO"
4. Configure:
   - Name: `meatus-test` (becomes `meatus-test.sputnik-dao.near`)
   - Purpose: "Learning DAO for Meatus project"
   - Council members: Add your testnet account
   - Voting policy: Start with simple majority

**Option 2: Use CLI**

```bash
# The Sputnik factory creates DAOs for you
# Factory on testnet: sputnikv2.testnet

near call sputnikv2.testnet create '{
  "name": "meatus-test",
  "args": "BASE64_ENCODED_CONFIG"
}' --accountId YOUR_NAME.testnet --deposit 6
```

The config structure (before base64 encoding):
```json
{
  "policy": {
    "roles": [
      {
        "name": "council",
        "kind": { "Group": ["YOUR_NAME.testnet"] },
        "permissions": ["*:*"],
        "vote_policy": {}
      }
    ],
    "default_vote_policy": {
      "weight_kind": "RoleWeight",
      "quorum": "0",
      "threshold": [1, 2]
    },
    "proposal_bond": "100000000000000000000000",
    "proposal_period": "604800000000000",
    "bounty_bond": "100000000000000000000000",
    "bounty_forgiveness_period": "604800000000000"
  }
}
```

### 2.3 DAO Structure

```
meatus-test.sputnikv2.testnet
├── Treasury (NEAR balance)
├── Roles
│   ├── council (full permissions)
│   ├── community (limited permissions)
│   └── custom roles...
├── Proposals
│   ├── Transfer proposals
│   ├── AddMemberToRole proposals
│   ├── FunctionCall proposals
│   └── UpgradeSelf proposals
└── Policy (voting rules)
```

### 2.4 Create a Proposal

```bash
# Add a new council member
near call meatus-test.sputnikv2.testnet add_proposal '{
  "proposal": {
    "description": "Add alice as council member",
    "kind": {
      "AddMemberToRole": {
        "member_id": "alice.testnet",
        "role": "council"
      }
    }
  }
}' --accountId YOUR_NAME.testnet --deposit 0.1

# Transfer funds from treasury
near call meatus-test.sputnikv2.testnet add_proposal '{
  "proposal": {
    "description": "Pay contractor 5 NEAR",
    "kind": {
      "Transfer": {
        "token_id": "",
        "receiver_id": "contractor.testnet",
        "amount": "5000000000000000000000000"
      }
    }
  }
}' --accountId YOUR_NAME.testnet --deposit 0.1
```

### 2.5 Vote on a Proposal

```bash
# Vote to approve (VoteApprove, VoteReject, VoteRemove)
near call meatus-test.sputnikv2.testnet act_proposal '{
  "id": 0,
  "action": "VoteApprove"
}' --accountId YOUR_NAME.testnet
```

---

## Module 3: Multisig Patterns

### 3.1 Sputnik DAO as Multisig

Sputnik DAO IS a multisig. When you configure voting policy:

```json
{
  "threshold": [2, 3]  // 2 of 3 members must approve
}
```

This means any action requires M of N signatures (votes).

### 3.2 Common Multisig Configurations

```
2-of-3: Two founders must agree
        Good for: Small teams, quick decisions

3-of-5: Three of five board members
        Good for: Medium organizations

5-of-9: Majority of large council
        Good for: Decentralized governance
```

### 3.3 Setting Up Multisig for Meatus

```json
{
  "policy": {
    "roles": [
      {
        "name": "founders",
        "kind": {
          "Group": [
            "titus.testnet",
            "cofounder1.testnet",
            "cofounder2.testnet"
          ]
        },
        "permissions": ["*:*"],
        "vote_policy": {
          "Transfer": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [2, 3]  // 2 of 3 founders for transfers
          },
          "FunctionCall": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [2, 3]  // 2 of 3 for contract calls
          }
        }
      },
      {
        "name": "agents",
        "kind": {
          "Group": [
            "orchestrator.meatus.testnet"
          ]
        },
        "permissions": [
          "call:complete_job",      // Can mark jobs complete
          "call:request_payment"    // Can request payment for services
        ],
        "vote_policy": {}  // No voting, just execution permissions
      }
    ]
  }
}
```

---

## Module 4: The Full Payment Flow

### 4.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CUSTOMER PAYMENT                                                    │
│                                                                             │
│   Customer pays $100 USD (Stripe) or 100 NEAR (wallet)                     │
│                                                                             │
│   Frontend → Backend API                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: CONVERSION                                                          │
│                                                                             │
│   Backend converts USD → NEAR (or USDC on NEAR)                            │
│   Options:                                                                  │
│   - Stripe → Buy NEAR via exchange API → Send to DAO                       │
│   - Direct crypto → Swap on DEX if needed → Send to DAO                    │
│                                                                             │
│   For MVP: Just use testnet NEAR, skip real conversion                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: DAO TREASURY RECEIVES FUNDS                                         │
│                                                                             │
│   meatus-dao.sputnikv2.testnet receives payment                            │
│   Job record created with:                                                  │
│   - job_id                                                                  │
│   - customer                                                                │
│   - amount                                                                  │
│   - parameters                                                              │
│   - status: "pending"                                                       │
│                                                                             │
│   Event emitted: JobCreated { job_id, customer, amount }                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: ORCHESTRATOR AGENT EXECUTES                                         │
│                                                                             │
│   orchestrator.meatus-dao.testnet (off-chain process)                      │
│   - Watches for JobCreated events                                          │
│   - Picks up pending jobs                                                  │
│   - Executes investigation logic                                           │
│   - Calls external services (data providers)                               │
│   - Pays for services from agent wallet (pre-funded from DAO)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: VALIDATION                                                          │
│                                                                             │
│   Options:                                                                  │
│   A) Automatic: Agent self-reports completion                              │
│   B) Oracle: Third-party validates work                                    │
│   C) Customer: Customer confirms satisfaction                              │
│   D) DAO Vote: Council reviews and approves (for large jobs)               │
│                                                                             │
│   For MVP: Automatic (agent trusted)                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: PAYMENT DISTRIBUTION                                                │
│                                                                             │
│   $100 job payment split:                                                  │
│   ├── Data providers: $40 (paid during execution)                          │
│   ├── Infrastructure: $10 (compute, storage)                               │
│   ├── DAO Treasury: $30 (reserve, governance)                              │
│   └── DAO Owners: $20 (profit distribution)                                │
│                                                                             │
│   Distribution requires:                                                    │
│   - Proposal created: "Distribute profits for Job #123"                    │
│   - 2-of-3 founders approve                                                │
│   - Funds transferred to owner wallets                                     │
│                                                                             │
│   OR: Automatic distribution via smart contract rules                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: DAO OWNER RECEIVES                                                  │
│                                                                             │
│   founder1.testnet: +$10                                                   │
│   founder2.testnet: +$10                                                   │
│                                                                             │
│   (Or based on token holdings if tokenized DAO)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Smart Contract for This Flow

```rust
// contracts/meatus-job-manager/src/lib.rs

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedSet};
use near_sdk::{env, near_bindgen, AccountId, Balance, Promise, PanicOnDefault};

const DATA_PROVIDER_SHARE: u128 = 40;  // 40%
const INFRA_SHARE: u128 = 10;          // 10%
const TREASURY_SHARE: u128 = 30;       // 30%
const OWNER_SHARE: u128 = 20;          // 20%

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct MeatusJobManager {
    dao: AccountId,                          // The DAO that owns this contract
    orchestrator: AccountId,                 // Authorized agent
    owners: UnorderedSet<AccountId>,         // DAO owner wallets for profit distribution
    jobs: LookupMap<u64, Job>,
    job_counter: u64,
    infra_wallet: AccountId,                 // Infrastructure costs
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct Job {
    id: u64,
    customer: AccountId,
    amount: Balance,
    params: String,
    status: JobStatus,
    result_cid: Option<String>,              // IPFS CID of results
    data_provider_costs: Balance,            // What was paid to data sources
    created_at: u64,
    completed_at: Option<u64>,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, PartialEq)]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Disputed,
}

#[near_bindgen]
impl MeatusJobManager {
    #[init]
    pub fn new(
        dao: AccountId,
        orchestrator: AccountId,
        infra_wallet: AccountId,
        owners: Vec<AccountId>,
    ) -> Self {
        let mut owners_set = UnorderedSet::new(b"o");
        for owner in owners {
            owners_set.insert(&owner);
        }

        Self {
            dao,
            orchestrator,
            owners: owners_set,
            jobs: LookupMap::new(b"j"),
            job_counter: 0,
            infra_wallet,
        }
    }

    /// Customer creates a job with attached payment
    #[payable]
    pub fn create_job(&mut self, params: String) -> u64 {
        let amount = env::attached_deposit();
        assert!(amount > 0, "Payment required");

        let job_id = self.job_counter;
        self.job_counter += 1;

        let job = Job {
            id: job_id,
            customer: env::predecessor_account_id(),
            amount,
            params: params.clone(),
            status: JobStatus::Pending,
            result_cid: None,
            data_provider_costs: 0,
            created_at: env::block_timestamp(),
            completed_at: None,
        };

        self.jobs.insert(&job_id, &job);

        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"job_created\",\"job_id\":{},\"amount\":\"{}\"}}",
            job_id, amount
        ));

        job_id
    }

    /// Orchestrator marks job as processing and gets budget
    pub fn start_job(&mut self, job_id: u64) -> Promise {
        self.assert_orchestrator();

        let mut job = self.jobs.get(&job_id).expect("Job not found");
        assert_eq!(job.status, JobStatus::Pending, "Job not pending");

        job.status = JobStatus::Processing;
        self.jobs.insert(&job_id, &job);

        // Calculate agent budget (data provider share)
        let agent_budget = (job.amount * DATA_PROVIDER_SHARE) / 100;

        // Transfer budget to orchestrator for paying data sources
        Promise::new(self.orchestrator.clone()).transfer(agent_budget)
    }

    /// Orchestrator completes job and triggers distribution
    pub fn complete_job(
        &mut self,
        job_id: u64,
        result_cid: String,
        data_provider_costs: Balance,
    ) {
        self.assert_orchestrator();

        let mut job = self.jobs.get(&job_id).expect("Job not found");
        assert_eq!(job.status, JobStatus::Processing, "Job not processing");

        job.status = JobStatus::Completed;
        job.result_cid = Some(result_cid);
        job.data_provider_costs = data_provider_costs;
        job.completed_at = Some(env::block_timestamp());
        self.jobs.insert(&job_id, &job);

        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"job_completed\",\"job_id\":{}}}",
            job_id
        ));

        // Trigger automatic distribution
        self.distribute_payment(job_id);
    }

    /// Internal: Distribute payment after job completion
    fn distribute_payment(&mut self, job_id: u64) {
        let job = self.jobs.get(&job_id).expect("Job not found");
        let remaining = job.amount - ((job.amount * DATA_PROVIDER_SHARE) / 100);

        // Infrastructure share
        let infra_amount = (job.amount * INFRA_SHARE) / 100;
        Promise::new(self.infra_wallet.clone()).transfer(infra_amount);

        // Treasury share (stays in contract or goes to DAO)
        let treasury_amount = (job.amount * TREASURY_SHARE) / 100;
        Promise::new(self.dao.clone()).transfer(treasury_amount);

        // Owner share (split equally among owners)
        let owner_amount = (job.amount * OWNER_SHARE) / 100;
        let owner_count = self.owners.len();
        if owner_count > 0 {
            let per_owner = owner_amount / (owner_count as u128);
            for owner in self.owners.iter() {
                Promise::new(owner).transfer(per_owner);
            }
        }

        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"payment_distributed\",\"job_id\":{},\"infra\":\"{}\",\"treasury\":\"{}\",\"owners\":\"{}\"}}",
            job_id, infra_amount, treasury_amount, owner_amount
        ));
    }

    // === Admin Functions ===

    /// Add a new owner (requires DAO call)
    pub fn add_owner(&mut self, owner: AccountId) {
        self.assert_dao();
        self.owners.insert(&owner);
    }

    /// Remove an owner (requires DAO call)
    pub fn remove_owner(&mut self, owner: AccountId) {
        self.assert_dao();
        self.owners.remove(&owner);
    }

    /// Update orchestrator (requires DAO call)
    pub fn set_orchestrator(&mut self, orchestrator: AccountId) {
        self.assert_dao();
        self.orchestrator = orchestrator;
    }

    // === View Functions ===

    pub fn get_job(&self, job_id: u64) -> Option<JobView> {
        self.jobs.get(&job_id).map(|j| JobView::from(j))
    }

    pub fn get_owners(&self) -> Vec<AccountId> {
        self.owners.iter().collect()
    }

    // === Internal ===

    fn assert_orchestrator(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.orchestrator,
            "Only orchestrator"
        );
    }

    fn assert_dao(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.dao,
            "Only DAO"
        );
    }
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JobView {
    pub id: u64,
    pub customer: String,
    pub amount: String,
    pub status: String,
    pub result_cid: Option<String>,
}

impl From<Job> for JobView {
    fn from(j: Job) -> Self {
        Self {
            id: j.id,
            customer: j.customer.to_string(),
            amount: j.amount.to_string(),
            status: format!("{:?}", j.status),
            result_cid: j.result_cid,
        }
    }
}
```

---

## Hands-On Exercises

### Exercise 1: Create Your First DAO
1. Go to https://testnet.app.astrodao.com/
2. Create a DAO called `meatus-learning-YOURNAME`
3. Add yourself as the only council member
4. Create a proposal
5. Vote on it

### Exercise 2: Multisig Simulation
1. Create a DAO with 2-of-3 voting
2. Add two other testnet accounts (create them)
3. Create a transfer proposal
4. Try to execute with 1 vote (should fail)
5. Add second vote (should succeed)

### Exercise 3: Deploy the Job Manager Contract
1. Set up Rust development environment
2. Clone the contract template
3. Build the contract
4. Deploy to testnet
5. Test via near-cli

### Exercise 4: Write the Orchestrator
1. Write Python/Node script that watches for events
2. Process a "hello world" job
3. Call complete_job
4. Verify funds distributed

---

## Resources

### NEAR Documentation
- [NEAR Docs](https://docs.near.org/)
- [Sputnik DAO](https://github.com/near-daos/sputnik-dao-contract)
- [AstroDAO](https://app.astrodao.com/) - Web UI for Sputnik

### Tutorials
- [NEAR 101](https://docs.near.org/tutorials/welcome)
- [Build a Contract](https://docs.near.org/tutorials/examples/count-near)
- [Sputnik DAO Guide](https://github.com/near-daos/sputnik-dao-contract/blob/main/README.md)

### Tools
- [NEAR CLI](https://docs.near.org/tools/near-cli)
- [NEAR Explorer](https://testnet.nearblocks.io/)
- [NEAR Wallet](https://testnet.mynearwallet.com/)

---

## Next Steps

1. **Complete Exercise 1**: Create your first DAO on AstroDAO
2. **Complete Exercise 2**: Understand multisig voting
3. **Set up Rust environment**: For smart contract development
4. **Deploy Job Manager**: Get contract on testnet
5. **Build Orchestrator**: Connect the off-chain piece

Want me to walk through any of these exercises step by step?
