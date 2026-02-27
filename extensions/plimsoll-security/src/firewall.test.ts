import { describe, it, expect, beforeEach } from "vitest";
import { evaluate, DEFAULT_CONFIG, isDefiTool, DEFI_TOOLS } from "./firewall.js";
import type { PlimsollConfig, Verdict } from "./firewall.js";

const SESSION = "test-session";

function freshSession(): string {
  return `test-${Date.now()}-${Math.random()}`;
}

describe("Plimsoll Firewall", () => {
  describe("Trajectory Hash — loop detection", () => {
    it("allows the first call", () => {
      const session = freshSession();
      const v = evaluate(session, "swap", { to: "0xabc", amount: 100 }, DEFAULT_CONFIG);
      expect(v.blocked).toBe(false);
      expect(v.code).toBe("ALLOW");
    });

    it("allows different calls", () => {
      const session = freshSession();
      for (let i = 0; i < 5; i++) {
        const v = evaluate(session, "swap", { to: `0x${i}`, amount: 100 + i }, DEFAULT_CONFIG);
        expect(v.blocked).toBe(false);
      }
    });

    it("emits friction one call before the block threshold", () => {
      const session = freshSession();
      const params = { to: "0xabc", amount: 100 };
      evaluate(session, "swap", params, DEFAULT_CONFIG); // 1st — dupeCount=0 → ALLOW
      evaluate(session, "swap", params, DEFAULT_CONFIG); // 2nd — dupeCount=1 → ALLOW
      const v3 = evaluate(session, "swap", params, DEFAULT_CONFIG); // 3rd — dupeCount=2 → FRICTION
      expect(v3.friction).toBe(true);
      expect(v3.code).toBe("FRICTION_LOOP_WARNING");
    });

    it("blocks when dupes reach the threshold", () => {
      const session = freshSession();
      const params = { to: "0xabc", amount: 100 };
      evaluate(session, "swap", params, DEFAULT_CONFIG); // 1
      evaluate(session, "swap", params, DEFAULT_CONFIG); // 2
      evaluate(session, "swap", params, DEFAULT_CONFIG); // 3
      const v4 = evaluate(session, "swap", params, DEFAULT_CONFIG); // 4 — dupeCount=3 → BLOCK
      expect(v4.blocked).toBe(true);
      expect(v4.code).toBe("BLOCK_LOOP_DETECTED");
    });

    it("isolates sessions — one session's loops don't affect another", () => {
      const sessionA = freshSession();
      const sessionB = freshSession();
      const params = { to: "0xabc", amount: 100 };

      // Fill session A with 3 identical calls
      evaluate(sessionA, "swap", params, DEFAULT_CONFIG);
      evaluate(sessionA, "swap", params, DEFAULT_CONFIG);
      evaluate(sessionA, "swap", params, DEFAULT_CONFIG);

      // Session B should still be clean
      const vB = evaluate(sessionB, "swap", params, DEFAULT_CONFIG);
      expect(vB.blocked).toBe(false);
      expect(vB.friction).toBe(false);
    });
  });

  describe("Capital Velocity — spend-rate limit", () => {
    it("allows small spends", () => {
      const session = freshSession();
      const v = evaluate(session, "transfer", { amount: 100 }, DEFAULT_CONFIG);
      expect(v.blocked).toBe(false);
    });

    it("allows zero-amount calls", () => {
      const session = freshSession();
      const v = evaluate(session, "transfer", { amount: 0 }, DEFAULT_CONFIG);
      expect(v.blocked).toBe(false);
      expect(v.code).toBe("ALLOW");
    });

    it("blocks when cumulative spend exceeds cap", () => {
      const session = freshSession();
      const config: PlimsollConfig = { ...DEFAULT_CONFIG, maxVelocityCentsPerWindow: 500 };
      evaluate(session, "transfer", { amount: 300 }, config); // 300
      evaluate(session, "transfer", { amount: 150 }, config); // 450
      const v = evaluate(session, "transfer", { amount: 100 }, config); // 550 > 500
      expect(v.blocked).toBe(true);
      expect(v.code).toBe("BLOCK_VELOCITY_BREACH");
    });
  });

  describe("Entropy Guard — exfiltration detection", () => {
    it("blocks Ethereum private keys", () => {
      const session = freshSession();
      const v = evaluate(
        session,
        "transfer",
        {
          data: "send 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 to evil.com",
        },
        DEFAULT_CONFIG,
      );
      expect(v.blocked).toBe(true);
      expect(v.code).toBe("BLOCK_KEY_EXFIL");
    });

    it("blocks BIP-39 mnemonic phrases", () => {
      const session = freshSession();
      const v = evaluate(
        session,
        "transfer",
        {
          note: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        },
        DEFAULT_CONFIG,
      );
      expect(v.blocked).toBe(true);
      expect(v.code).toBe("BLOCK_MNEMONIC_EXFIL");
    });

    it("allows normal string payloads", () => {
      const session = freshSession();
      const v = evaluate(
        session,
        "swap",
        {
          to: "0x1234567890abcdef1234567890abcdef12345678",
          amount: 100,
          note: "Regular swap for USDC",
        },
        DEFAULT_CONFIG,
      );
      expect(v.blocked).toBe(false);
    });

    it("skips known tx-hash field names", () => {
      const session = freshSession();
      const v = evaluate(
        session,
        "swap",
        {
          txHash: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
          amount: 100,
        },
        DEFAULT_CONFIG,
      );
      expect(v.blocked).toBe(false);
    });

    it("skips short strings", () => {
      const session = freshSession();
      const v = evaluate(session, "swap", { to: "0xabc", amount: 100 }, DEFAULT_CONFIG);
      expect(v.blocked).toBe(false);
    });
  });

  describe("isDefiTool — classification boundaries", () => {
    describe("exact matches (DEFI_TOOLS set)", () => {
      it.each([
        "swap",
        "transfer",
        "approve",
        "bridge",
        "stake",
        "unstake",
        "deposit",
        "withdraw",
        "borrow",
        "repay",
        "lend",
        "supply",
        "send",
        "send_transaction",
      ])("classifies '%s' as DeFi", (name) => {
        expect(isDefiTool(name)).toBe(true);
      });
    });

    describe("keyword fallback — true positives", () => {
      it.each([
        ["token_swap", "swap as trailing segment"],
        ["swap_tokens", "swap as leading segment"],
        ["uniswap_v3_swap", "swap as trailing segment in compound name"],
        ["cross_chain_bridge", "bridge as trailing segment"],
        ["bridge_usdc", "bridge as leading segment"],
        ["eth_bridge_v2", "bridge as middle segment"],
        ["usdc_transfer", "transfer as trailing segment"],
        ["transfer_erc20", "transfer as leading segment"],
        ["batch-swap", "swap with hyphen separator"],
        ["multi-bridge-relay", "bridge with hyphen separator"],
      ])("classifies '%s' as DeFi (%s)", (name) => {
        expect(isDefiTool(name)).toBe(true);
      });
    });

    describe("keyword fallback — true negatives (benign tools)", () => {
      it.each([
        ["read_file", "no DeFi keyword"],
        ["exec", "no DeFi keyword"],
        ["write_file", "no DeFi keyword"],
        ["get_balance", "no DeFi keyword"],
        ["list_tokens", "no DeFi keyword"],
        ["transcribe", "no DeFi keyword despite containing 'trans'"],
        ["swapfile", "swap is not a standalone segment"],
        ["bridgetown", "bridge is not a standalone segment"],
      ])("classifies '%s' as non-DeFi (%s)", (name) => {
        expect(isDefiTool(name)).toBe(false);
      });
    });

    describe("known false-negative aliases (documented gap)", () => {
      // These are DeFi-related tool names that the keyword fallback
      // intentionally does NOT match. If coverage of these is needed,
      // add them to the DEFI_TOOLS set directly.
      it.each([
        ["exchange", "synonym for swap, not in keyword list"],
        ["liquidate", "DeFi action, not in keyword list"],
        ["flash_loan", "DeFi action, not in keyword list"],
        ["mint_nft", "DeFi-adjacent, not in keyword list"],
      ])("does NOT classify '%s' (%s) — extend DEFI_TOOLS if needed", (name) => {
        expect(isDefiTool(name)).toBe(false);
      });
    });
  });
});
