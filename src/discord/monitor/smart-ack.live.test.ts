import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { isTruthyEnvValue } from "../../infra/env.js";
import { generateSmartAck } from "./smart-ack.js";

const LIVE = isTruthyEnvValue(process.env.LIVE) || isTruthyEnvValue(process.env.CLAWDBOT_LIVE_TEST);
const describeLive = LIVE ? describe : describe.skip;

const stubCfg = {} as OpenClawConfig;
const config = { model: "haiku", timeoutMs: 15000 };

describeLive("smart-ack live", () => {
  it("classifies a greeting as FULL", async () => {
    const result = await generateSmartAck({
      message: "hey! how's it going?",
      senderName: "Chris",
      cfg: stubCfg,
      config,
    });
    expect(result).not.toBeNull();
    expect(result!.isFull).toBe(true);
    expect(result!.text.length).toBeGreaterThan(0);
    expect(result!.text.length).toBeLessThan(500);
  }, 20000);

  it("classifies a technical request as ACK", async () => {
    const result = await generateSmartAck({
      message:
        "Can you refactor the authentication middleware to use JWT tokens instead of session cookies? " +
        "I need it to support refresh tokens and token rotation.",
      senderName: "Chris",
      cfg: stubCfg,
      config,
    });
    expect(result).not.toBeNull();
    expect(result!.isFull).toBe(false);
    expect(result!.text.length).toBeGreaterThan(0);
    expect(result!.text.length).toBeLessThan(500);
  }, 20000);

  it("classifies gibberish as FULL", async () => {
    const result = await generateSmartAck({
      message: "asdfghjkl qwerty zxcvbn",
      senderName: "TestUser",
      cfg: stubCfg,
      config,
    });
    expect(result).not.toBeNull();
    expect(result!.isFull).toBe(true);
    expect(result!.text.length).toBeGreaterThan(0);
  }, 20000);

  it("classifies a simple thank you as FULL", async () => {
    const result = await generateSmartAck({
      message: "thanks, that worked!",
      senderName: "Chris",
      cfg: stubCfg,
      config,
    });
    expect(result).not.toBeNull();
    expect(result!.isFull).toBe(true);
    expect(result!.text.length).toBeGreaterThan(0);
  }, 20000);

  it("classifies a multi-step task as ACK", async () => {
    const result = await generateSmartAck({
      message:
        "set up a new PostgreSQL database, create the users and orders tables with proper indexes, " +
        "write the migration scripts, and add seed data for testing",
      senderName: "Chris",
      cfg: stubCfg,
      config,
    });
    expect(result).not.toBeNull();
    expect(result!.isFull).toBe(false);
    expect(result!.text.length).toBeGreaterThan(0);
  }, 20000);

  it("returns structured result with expected shape", async () => {
    const result = await generateSmartAck({
      message: "hello",
      senderName: "Chris",
      cfg: stubCfg,
      config,
    });
    expect(result).toMatchObject({
      text: expect.any(String),
      isFull: expect.any(Boolean),
    });
  }, 20000);
});
