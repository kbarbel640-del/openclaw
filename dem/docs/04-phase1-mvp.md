# Phase 1 MVP: "Quarter in the Arcade"

## Goal
Prove the end-to-end flow works:
1. User pays (fake USD)
2. Payment converts to testnet crypto
3. Smart contract receives payment
4. Orchestrator agent executes
5. Result returns to user

**No real money. No real data. Just the plumbing.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WEB2 FRONTEND                                   │
│                   (Next.js / React)                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  "Pay $10 to run investigation"                              │   │
│  │  [Credit Card] [Crypto Wallet]                               │   │
│  │                                                              │   │
│  │  Fake Stripe checkout (test mode)                            │   │
│  │  OR                                                          │   │
│  │  NEAR Wallet connect (testnet)                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND API                                     │
│                   (Node.js / Python)                                │
│                                                                     │
│  POST /api/payment                                                  │
│  ├── Receive Stripe test payment confirmation                      │
│  ├── OR receive NEAR testnet transaction ID                        │
│  ├── Convert: $10 USD → 10 USDC (fake, just record)               │
│  ├── Call NEAR testnet contract                                    │
│  └── Return job_id to frontend                                     │
│                                                                     │
│  GET /api/job/:id                                                   │
│  └── Poll for job status and results                               │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  NEAR TESTNET                                       │
│                                                                     │
│  meatus-mvp.testnet (DAO/Treasury contract)                        │
│  ├── receive_payment(amount, job_params)                           │
│  ├── Emits: JobCreated { job_id, customer, amount }                │
│  └── Stores job in contract state                                  │
│                                                                     │
│  orchestrator.meatus-mvp.testnet (Orchestrator contract)           │
│  ├── Listens for JobCreated events                                 │
│  ├── execute_job(job_id)                                           │
│  ├── Does "hello world" work (returns timestamp + message)         │
│  └── Emits: JobCompleted { job_id, result }                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack for MVP

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | Next.js 14 + TypeScript | Fast, SSR, good DX |
| Styling | Tailwind CSS | Rapid prototyping |
| Wallet | NEAR Wallet Selector | Official NEAR wallet integration |
| Fiat Payment | Stripe Test Mode | Industry standard, easy test mode |
| Backend | Node.js + Express (or Python FastAPI) | Quick to build |
| Smart Contract | Rust + near-sdk | NEAR's native contract language |
| Contract Tooling | cargo-near + near-cli | Official NEAR tools |

---

## Step-by-Step Build Plan

### Step 1: NEAR Testnet Setup
```bash
# Install NEAR CLI
npm install -g near-cli

# Create testnet accounts
near create-account meatus-mvp.testnet --useFaucet
near create-account orchestrator.meatus-mvp.testnet --masterAccount meatus-mvp.testnet

# Verify
near state meatus-mvp.testnet
```

### Step 2: Hello World Smart Contract

**Contract: meatus-mvp (Treasury/Job Manager)**

```rust
// src/lib.rs
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, Balance, PanicOnDefault};

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct MeatusMVP {
    jobs: LookupMap<u64, Job>,
    job_counter: u64,
    orchestrator: AccountId,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Job {
    id: u64,
    customer: AccountId,
    amount: Balance,
    params: String,
    status: JobStatus,
    result: Option<String>,
    created_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, PartialEq)]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[near_bindgen]
impl MeatusMVP {
    #[init]
    pub fn new(orchestrator: AccountId) -> Self {
        Self {
            jobs: LookupMap::new(b"j"),
            job_counter: 0,
            orchestrator,
        }
    }

    /// Customer calls this with attached payment
    #[payable]
    pub fn create_job(&mut self, params: String) -> u64 {
        let amount = env::attached_deposit();
        let customer = env::predecessor_account_id();

        let job_id = self.job_counter;
        self.job_counter += 1;

        let job = Job {
            id: job_id,
            customer: customer.clone(),
            amount,
            params,
            status: JobStatus::Pending,
            result: None,
            created_at: env::block_timestamp(),
        };

        self.jobs.insert(&job_id, &job);

        // Log event for indexer/orchestrator
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"job_created\",\"job_id\":{},\"customer\":\"{}\",\"amount\":\"{}\"}}",
            job_id, customer, amount
        ));

        job_id
    }

    /// Orchestrator calls this to mark job complete
    pub fn complete_job(&mut self, job_id: u64, result: String) {
        assert_eq!(
            env::predecessor_account_id(),
            self.orchestrator,
            "Only orchestrator can complete jobs"
        );

        let mut job = self.jobs.get(&job_id).expect("Job not found");
        job.status = JobStatus::Completed;
        job.result = Some(result.clone());
        self.jobs.insert(&job_id, &job);

        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"job_completed\",\"job_id\":{},\"result\":\"{}\"}}",
            job_id, result
        ));
    }

    /// View job status
    pub fn get_job(&self, job_id: u64) -> Option<JobView> {
        self.jobs.get(&job_id).map(|j| JobView {
            id: j.id,
            customer: j.customer.to_string(),
            amount: j.amount.to_string(),
            params: j.params,
            status: format!("{:?}", j.status),
            result: j.result,
        })
    }
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JobView {
    id: u64,
    customer: String,
    amount: String,
    params: String,
    status: String,
    result: Option<String>,
}
```

### Step 3: Orchestrator Contract (Simple Version)

For MVP, the orchestrator can be a simple off-chain script that:
1. Watches for `job_created` events
2. Processes the job (hello world)
3. Calls `complete_job` on the main contract

```python
# orchestrator/main.py
import asyncio
import json
from py_near.account import Account
from py_near.providers import JsonProvider

NEAR_RPC = "https://rpc.testnet.near.org"
CONTRACT_ID = "meatus-mvp.testnet"
ORCHESTRATOR_KEY = "path/to/orchestrator-key.json"

async def process_job(job_id: int, params: str) -> str:
    """Hello world job processor"""
    # This is where real agent logic would go
    return f"Hello from Meatus! Job {job_id} processed. Params: {params}. Timestamp: {asyncio.get_event_loop().time()}"

async def watch_jobs():
    provider = JsonProvider(NEAR_RPC)
    orchestrator = Account.from_json_file(ORCHESTRATOR_KEY, provider)

    last_processed = 0

    while True:
        # Poll for new jobs (MVP approach - production would use indexer)
        # ... fetch recent events or poll job counter

        # When new job found:
        # result = await process_job(job_id, params)
        # await orchestrator.call(CONTRACT_ID, "complete_job", {"job_id": job_id, "result": result})

        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(watch_jobs())
```

### Step 4: Frontend

```
frontend/
├── app/
│   ├── page.tsx              # Landing page
│   ├── pay/
│   │   └── page.tsx          # Payment page
│   └── job/
│       └── [id]/
│           └── page.tsx      # Job status page
├── components/
│   ├── PaymentForm.tsx
│   ├── WalletConnect.tsx
│   └── JobStatus.tsx
└── lib/
    ├── near.ts               # NEAR wallet integration
    └── api.ts                # Backend API calls
```

**Key Frontend Component:**

```tsx
// components/PaymentForm.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/near';

export function PaymentForm() {
  const [amount, setAmount] = useState(10);
  const [params, setParams] = useState('');
  const [jobId, setJobId] = useState<number | null>(null);
  const { wallet, signedIn } = useWallet();

  const handlePayWithNEAR = async () => {
    if (!wallet) return;

    const result = await wallet.callMethod({
      contractId: 'meatus-mvp.testnet',
      method: 'create_job',
      args: { params },
      deposit: BigInt(amount * 1e24).toString(), // NEAR in yocto
    });

    // Extract job_id from result
    setJobId(result.job_id);
  };

  const handlePayWithStripe = async () => {
    // Call backend which handles Stripe test payment
    const response = await fetch('/api/payment', {
      method: 'POST',
      body: JSON.stringify({ amount, params }),
    });
    const { jobId } = await response.json();
    setJobId(jobId);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Run Investigation</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Investigation Parameters
        </label>
        <input
          type="text"
          value={params}
          onChange={(e) => setParams(e.target.value)}
          placeholder="e.g., email@example.com"
          className="w-full p-2 border rounded"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Amount: ${amount}
        </label>
      </div>

      <div className="space-y-2">
        {signedIn ? (
          <button
            onClick={handlePayWithNEAR}
            className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
          >
            Pay with NEAR Wallet
          </button>
        ) : (
          <button
            onClick={() => wallet?.signIn()}
            className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
          >
            Connect NEAR Wallet
          </button>
        )}

        <button
          onClick={handlePayWithStripe}
          className="w-full bg-gray-800 text-white p-3 rounded hover:bg-gray-900"
        >
          Pay with Credit Card (Test)
        </button>
      </div>

      {jobId !== null && (
        <div className="mt-4 p-4 bg-green-50 rounded">
          <p className="text-green-800">
            Job created! ID: {jobId}
            <a href={`/job/${jobId}`} className="ml-2 underline">
              View Status →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 5: Backend API

```typescript
// api/src/index.ts
import express from 'express';
import Stripe from 'stripe';
import { connect, keyStores, Contract } from 'near-api-js';

const app = express();
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_TEST_KEY!);

// NEAR setup
const nearConfig = {
  networkId: 'testnet',
  keyStore: new keyStores.UnencryptedFileSystemKeyStore('~/.near-credentials'),
  nodeUrl: 'https://rpc.testnet.near.org',
};

app.post('/api/payment', async (req, res) => {
  const { amount, params } = req.body;

  // 1. Create Stripe test payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // cents
    currency: 'usd',
    // In test mode, use test card: 4242 4242 4242 4242
  });

  // 2. For MVP, we'll auto-confirm and proceed
  // (In production, frontend would handle Stripe Elements)

  // 3. "Convert" to crypto (just accounting for MVP)
  const cryptoAmount = amount; // 1:1 for simplicity

  // 4. Call NEAR contract on behalf of user
  const near = await connect(nearConfig);
  const account = await near.account('backend-service.meatus-mvp.testnet');

  const result = await account.functionCall({
    contractId: 'meatus-mvp.testnet',
    methodName: 'create_job',
    args: { params },
    attachedDeposit: BigInt(cryptoAmount * 1e24).toString(),
  });

  // Extract job_id from logs
  const jobId = extractJobIdFromResult(result);

  res.json({
    jobId,
    paymentIntentId: paymentIntent.id,
    status: 'created'
  });
});

app.get('/api/job/:id', async (req, res) => {
  const jobId = parseInt(req.params.id);

  const near = await connect(nearConfig);
  const account = await near.account('backend-service.meatus-mvp.testnet');

  const job = await account.viewFunction({
    contractId: 'meatus-mvp.testnet',
    methodName: 'get_job',
    args: { job_id: jobId },
  });

  res.json(job);
});

app.listen(3001, () => {
  console.log('API running on http://localhost:3001');
});
```

---

## Directory Structure

```
meatus/
├── VISION.md
├── docs/
│   ├── 01-web3-agent-ecosystem.md
│   ├── 02-ai-reasoning-architecture.md
│   ├── 03-ring-osint-architecture.md
│   └── 04-phase1-mvp.md              # This document
├── contracts/
│   └── meatus-mvp/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs                 # Main contract
├── orchestrator/
│   ├── requirements.txt
│   └── main.py                        # Job processor
├── api/
│   ├── package.json
│   └── src/
│       └── index.ts                   # Express API
└── frontend/
    ├── package.json
    ├── next.config.js
    └── app/
        └── ...                        # Next.js app
```

---

## Development Sequence

### Week 1: Foundation
- [ ] Set up NEAR testnet accounts
- [ ] Write and deploy meatus-mvp contract
- [ ] Test contract via near-cli

### Week 2: Backend + Orchestrator
- [ ] Build Express API
- [ ] Integrate Stripe test mode
- [ ] Write orchestrator script
- [ ] Test full payment → job → completion flow

### Week 3: Frontend
- [ ] Create Next.js app
- [ ] Integrate NEAR Wallet Selector
- [ ] Build payment form
- [ ] Build job status page
- [ ] End-to-end testing

### Week 4: Polish + Prepare for Phase 2
- [ ] Error handling
- [ ] Better UI/UX
- [ ] Documentation
- [ ] Plan Phase 2 (real agent integration)

---

## Success Criteria for Phase 1

1. ✅ User can pay with test credit card
2. ✅ User can pay with NEAR testnet wallet
3. ✅ Payment creates a job on NEAR testnet
4. ✅ Orchestrator detects new job
5. ✅ Orchestrator processes job (hello world)
6. ✅ User can see job result in frontend

**No real money. No real data. Just proving the flow works.**

---

## Next Steps

Ready to start coding? I suggest we begin with:

1. **Set up the NEAR testnet accounts** (5 min)
2. **Write the smart contract** (30 min)
3. **Deploy and test via CLI** (15 min)

Then we'll have something on-chain to build the rest around.

Want me to scaffold out the actual project files?
