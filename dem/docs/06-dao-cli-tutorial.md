# Creating a DAO via CLI (Official NEAR Method)

Based on [NEAR Official Documentation](https://docs.near.org/primitives/dao).

The DAO web UIs (AstroDAO/AstraDAO) appear to be down. We'll use the CLI - this is actually better for learning because you see exactly what's happening on-chain.

---

## Prerequisites

### 1. Install NEAR CLI

```bash
# Install the new Rust-based NEAR CLI (recommended)
# On Linux/macOS:
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh

# Or via npm (older JS version, still works):
npm install -g near-cli

# Verify installation
near --version
```

### 2. Install Sputnik DAO CLI (Optional Helper Tool)

```bash
npm install -g sputnikdao
```

### 3. Create a NEAR Testnet Account

**Option A: Via Web Wallet**
1. Go to https://testnet.mynearwallet.com/
2. Create an account (e.g., `yourname.testnet`)
3. Save your seed phrase

**Option B: Via CLI**
```bash
# Create account with faucet (gets free testnet NEAR)
near account create-account sponsor-by-faucet-service yourname.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
```

### 4. Verify Your Account

```bash
# Check account exists and has balance
near account view-account-summary yourname.testnet network-config testnet now

# Should show ~10 NEAR from faucet
```

---

## Method 1: Using Global DAO Contract (Easiest)

NEAR provides a pre-deployed DAO contract you can use without deploying your own.

### Step 1: Create Your DAO

```bash
# Replace 'meatus-test' with your DAO name
# Replace 'yourname.testnet' with your account

near contract deploy meatus-test.yourname.testnet \
  use-global-account-id dao.globals.primitives.testnet \
  with-init-call new \
  json-args '{
    "config": {
      "name": "Meatus Test DAO",
      "purpose": "Learning Web3 agent architecture",
      "metadata": ""
    },
    "policy": ["yourname.testnet"]
  }' \
  prepaid-gas '100.0 Tgas' \
  attached-deposit '0 NEAR' \
  network-config testnet \
  sign-with-keychain \
  send
```

### Step 2: Verify DAO Created

```bash
# View DAO policy
near contract call-function as-read-only meatus-test.yourname.testnet get_policy json-args {} network-config testnet now

# View DAO config
near contract call-function as-read-only meatus-test.yourname.testnet get_config json-args {} network-config testnet now
```

---

## Method 2: Using Sputnik DAO Factory (Official NEAR Docs Method)

From [NEAR Official Documentation](https://docs.near.org/primitives/dao):

### Step 1: Prepare and Create DAO

```bash
# Set your council members (just you for learning)
export COUNCIL='["yourname.testnet"]'

# Create the args (config + policy) and base64 encode
export ARGS=$(echo '{"config": {"name": "meatus-learning", "purpose": "Learning DAO for Meatus project", "metadata":""}, "policy": '$COUNCIL'}' | base64)

# Create the DAO (costs ~6 NEAR for storage)
# This creates: meatus-learning.sputnikv2.testnet
near call sputnikv2.testnet create "{\"name\": \"meatus-learning\", \"args\": \"$ARGS\"}" \
  --accountId yourname.testnet \
  --amount 6 \
  --gas 150000000000000
```

### Step 2: Verify

```bash
# Check it exists
near state meatus-learning.sputnikv2.testnet

# View policy
near view meatus-learning.sputnikv2.testnet get_policy '{}'

# View config
near view meatus-learning.sputnikv2.testnet get_config '{}'
```

### Alternative: Full Policy Control

For more control over voting thresholds (e.g., 2-of-3 multisig):

```bash
export POLICY='{
  "roles": [
    {
      "name": "council",
      "kind": {"Group": ["founder1.testnet", "founder2.testnet", "founder3.testnet"]},
      "permissions": ["*:*"],
      "vote_policy": {}
    }
  ],
  "default_vote_policy": {
    "weight_kind": "RoleWeight",
    "quorum": "0",
    "threshold": [2, 3]
  },
  "proposal_bond": "100000000000000000000000",
  "proposal_period": "604800000000000",
  "bounty_bond": "100000000000000000000000",
  "bounty_forgiveness_period": "604800000000000"
}'

export ARGS=$(echo '{"config": {"name": "meatus-multisig", "purpose": "2-of-3 multisig DAO", "metadata":""}, "policy": '$POLICY'}' | base64)

near call sputnikv2.testnet create "{\"name\": \"meatus-multisig\", \"args\": \"$ARGS\"}" \
  --accountId yourname.testnet \
  --amount 6 \
  --gas 150000000000000
```

---

## Method 3: Using sputnikdao CLI Tool (Simplest Commands)

If you installed the `sputnikdao` npm package:

```bash
# Set environment variables
export COUNCIL_MEMBER=yourname.testnet
export DAO_ACCOUNT=meatus-dao
export SIGNER_ACCOUNT=yourname.testnet

# Create DAO
sputnikdao create $DAO_ACCOUNT $COUNCIL_MEMBER --accountId $SIGNER_ACCOUNT

# View DAO info
sputnikdao info --daoAcc $DAO_ACCOUNT --accountId $SIGNER_ACCOUNT
```

---

## Working with Your DAO

### Add a Council Member

From [NEAR Official Docs](https://docs.near.org/primitives/dao):

```bash
# Create proposal to add new member (requires 0.1 NEAR bond)
near call meatus-learning.sputnikv2.testnet add_proposal '{
  "proposal": {
    "description": "Add alice as council member",
    "kind": {
      "AddMemberToRole": {
        "member_id": "alice.testnet",
        "role": "council"
      }
    }
  }
}' --accountId yourname.testnet --deposit 0.1 --gas 300000000000000
```

### Vote on a Proposal

```bash
# Vote to approve proposal #0
# Options: VoteApprove, VoteReject, VoteRemove
near call meatus-learning.sputnikv2.testnet act_proposal '{"id": 0, "action": "VoteApprove"}' \
  --accountId yourname.testnet \
  --gas 300000000000000
```

### Transfer Funds from Treasury

```bash
# First, fund the DAO treasury
near send yourname.testnet meatus-learning.sputnikv2.testnet 5

# Create transfer proposal (amount in yoctoNEAR, 1 NEAR = 10^24 yocto)
near call meatus-learning.sputnikv2.testnet add_proposal '{
  "proposal": {
    "description": "Pay contractor 1 NEAR for development",
    "kind": {
      "Transfer": {
        "token_id": "",
        "receiver_id": "contractor.testnet",
        "amount": "1000000000000000000000000"
      }
    }
  }
}' --accountId yourname.testnet --deposit 0.1 --gas 300000000000000
```

### View All Proposals

```bash
near view meatus-learning.sputnikv2.testnet get_proposals '{"from_index": 0, "limit": 100}'
```

### Call a Contract (For Agent Integration)

```bash
# Create proposal to call an external contract
# args must be base64 encoded: echo '{"job_id": 1}' | base64 = eyJqb2JfaWQiOiAxfQo=
near call meatus-learning.sputnikv2.testnet add_proposal '{
  "proposal": {
    "description": "Execute job on orchestrator contract",
    "kind": {
      "FunctionCall": {
        "receiver_id": "orchestrator.testnet",
        "actions": [
          {
            "method_name": "execute_job",
            "args": "eyJqb2JfaWQiOiAxfQo=",
            "deposit": "0",
            "gas": "50000000000000"
          }
        ]
      }
    }
  }
}' --accountId yourname.testnet --deposit 0.1 --gas 300000000000000
```

---

## Setting Up Multisig (2-of-3)

### Create DAO with Multiple Council Members

```bash
export POLICY_2OF3='{
  "roles": [
    {
      "name": "council",
      "kind": {"Group": ["founder1.testnet", "founder2.testnet", "founder3.testnet"]},
      "permissions": ["*:*"],
      "vote_policy": {
        "*:*": {
          "weight_kind": "RoleWeight",
          "quorum": "0",
          "threshold": [2, 3]
        }
      }
    }
  ],
  "default_vote_policy": {
    "weight_kind": "RoleWeight",
    "quorum": "0",
    "threshold": [2, 3]
  },
  "proposal_bond": "100000000000000000000000",
  "proposal_period": "604800000000000",
  "bounty_bond": "100000000000000000000000",
  "bounty_forgiveness_period": "604800000000000"
}'

# Now 2 of 3 council members must approve any proposal
```

### Test Multisig Flow

1. **Founder1 creates proposal**
2. **Founder1 votes approve** → Status: 1/2 votes
3. **Founder2 votes approve** → Status: 2/2 votes → **Proposal executes**

```bash
# Founder 1 creates and votes
near contract call-function as-transaction meatus-multisig.sputnikv2.testnet add_proposal \
  json-args '{"proposal": {"description": "Test transfer", "kind": {"Transfer": {"token_id": "", "receiver_id": "test.testnet", "amount": "1000000000000000000000000"}}}}' \
  prepaid-gas '100.0 Tgas' \
  attached-deposit '0.1 NEAR' \
  sign-as founder1.testnet \
  network-config testnet \
  sign-with-keychain \
  send

# Check proposal status
near contract call-function as-read-only meatus-multisig.sputnikv2.testnet get_proposal \
  json-args '{"id": 0}' \
  network-config testnet now

# Founder 2 votes (this should execute the proposal)
near contract call-function as-transaction meatus-multisig.sputnikv2.testnet act_proposal \
  json-args '{"id": 0, "action": "VoteApprove"}' \
  prepaid-gas '100.0 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as founder2.testnet \
  network-config testnet \
  sign-with-keychain \
  send
```

---

## Useful Commands Reference

```bash
# Account Management
near account view-account-summary ACCOUNT network-config testnet now
near tokens ACCOUNT send-near RECIPIENT 'AMOUNT NEAR' network-config testnet sign-with-keychain send

# DAO Queries (Read-Only)
near contract call-function as-read-only DAO_ACCOUNT get_config json-args {} network-config testnet now
near contract call-function as-read-only DAO_ACCOUNT get_policy json-args {} network-config testnet now
near contract call-function as-read-only DAO_ACCOUNT get_proposals json-args '{"from_index": 0, "limit": 100}' network-config testnet now
near contract call-function as-read-only DAO_ACCOUNT get_proposal json-args '{"id": 0}' network-config testnet now

# DAO Actions (Require Signing)
# add_proposal - Create new proposal (requires bond deposit)
# act_proposal - Vote on proposal (VoteApprove, VoteReject, VoteRemove)
```

---

## Next Steps

1. ✅ Create your testnet account
2. ✅ Create your first DAO
3. ✅ Create a proposal
4. ✅ Vote on it
5. → Set up 2-of-3 multisig
6. → Integrate with orchestrator agent

---

## Troubleshooting

**"Account not found"**
- Make sure you're using testnet, not mainnet
- Check spelling of account name

**"Not enough balance"**
- Get testnet NEAR from faucet: https://near-faucet.io/

**"Access key not found"**
- Run: `near account import-account using-seed-phrase "your seed phrase" --hd-path "m/44'/397'/0'" network-config testnet`

**"Proposal expired"**
- Default proposal period is 7 days
- Create a new proposal

---

## Resources

- [Sputnik DAO Contracts](https://github.com/near-daos/sputnik-dao-contract)
- [sputnikdao CLI](https://www.npmjs.com/package/sputnikdao)
- [NEAR Documentation - DAOs](https://docs.near.org/primitives/dao)
- [NEAR Testnet Explorer](https://testnet.nearblocks.io/)
- [NEAR Testnet Wallet](https://testnet.mynearwallet.com/)
