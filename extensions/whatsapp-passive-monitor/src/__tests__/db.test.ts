import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMessageDb, type MessageDb } from "../db.js";

describe("MessageDb", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: MessageDb;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpm-db-test-"));
    dbPath = path.join(tmpDir, "messages.db");
    db = createMessageDb(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ---- Schema creation ----

  it("creates the database and schema on init", () => {
    // DB file should exist after creation
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("is idempotent — opening the same path twice does not error", () => {
    db.close();
    // Re-open on same path and assign to db so afterEach closes it
    db = createMessageDb(dbPath);
  });

  // ---- Insert ----

  it("inserts an inbound message", () => {
    db.insertMessage({
      conversation_id: "447123456789@s.whatsapp.net",
      sender: "447123456789",
      sender_name: "Alice",
      content: "Hey, are you free Saturday?",
      timestamp: 1700000000000,
      direction: "inbound",
      channel_id: "whatsapp",
    });

    const messages = db.getConversationContext("447123456789@s.whatsapp.net", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hey, are you free Saturday?");
    expect(messages[0].direction).toBe("inbound");
    expect(messages[0].sender_name).toBe("Alice");
  });

  it("inserts an outbound message", () => {
    db.insertMessage({
      conversation_id: "447123456789@s.whatsapp.net",
      sender: "me",
      sender_name: null,
      content: "Yeah, what's up?",
      timestamp: 1700000001000,
      direction: "outbound",
      channel_id: "whatsapp",
    });

    const messages = db.getConversationContext("447123456789@s.whatsapp.net", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe("outbound");
    expect(messages[0].sender_name).toBeNull();
  });

  // ---- Query context ----

  it("returns messages in chronological order (oldest first)", () => {
    // Insert in reverse order to verify sorting
    db.insertMessage({
      conversation_id: "chat-1",
      sender: "bob",
      sender_name: "Bob",
      content: "Third message",
      timestamp: 1700000003000,
      direction: "inbound",
      channel_id: "whatsapp",
    });
    db.insertMessage({
      conversation_id: "chat-1",
      sender: "me",
      sender_name: null,
      content: "First message",
      timestamp: 1700000001000,
      direction: "outbound",
      channel_id: "whatsapp",
    });
    db.insertMessage({
      conversation_id: "chat-1",
      sender: "bob",
      sender_name: "Bob",
      content: "Second message",
      timestamp: 1700000002000,
      direction: "inbound",
      channel_id: "whatsapp",
    });

    const messages = db.getConversationContext("chat-1", 10);
    expect(messages).toHaveLength(3);
    // Chronological: oldest first
    expect(messages[0].content).toBe("First message");
    expect(messages[1].content).toBe("Second message");
    expect(messages[2].content).toBe("Third message");
  });

  it("respects the limit parameter (returns most recent N)", () => {
    for (let i = 0; i < 10; i++) {
      db.insertMessage({
        conversation_id: "chat-1",
        sender: "bob",
        sender_name: "Bob",
        content: `Message ${i}`,
        timestamp: 1700000000000 + i * 1000,
        direction: "inbound",
        channel_id: "whatsapp",
      });
    }

    const messages = db.getConversationContext("chat-1", 3);
    expect(messages).toHaveLength(3);
    // Should return the last 3, in chronological order
    expect(messages[0].content).toBe("Message 7");
    expect(messages[1].content).toBe("Message 8");
    expect(messages[2].content).toBe("Message 9");
  });

  it("isolates conversations — only returns messages for the given conversation_id", () => {
    db.insertMessage({
      conversation_id: "chat-1",
      sender: "alice",
      sender_name: "Alice",
      content: "Hello from chat 1",
      timestamp: 1700000001000,
      direction: "inbound",
      channel_id: "whatsapp",
    });
    db.insertMessage({
      conversation_id: "chat-2",
      sender: "bob",
      sender_name: "Bob",
      content: "Hello from chat 2",
      timestamp: 1700000002000,
      direction: "inbound",
      channel_id: "whatsapp",
    });

    const chat1 = db.getConversationContext("chat-1", 10);
    expect(chat1).toHaveLength(1);
    expect(chat1[0].content).toBe("Hello from chat 1");

    const chat2 = db.getConversationContext("chat-2", 10);
    expect(chat2).toHaveLength(1);
    expect(chat2[0].content).toBe("Hello from chat 2");
  });

  it("returns empty array for unknown conversation", () => {
    const messages = db.getConversationContext("nonexistent", 10);
    expect(messages).toHaveLength(0);
  });

  it("includes both inbound and outbound in context", () => {
    db.insertMessage({
      conversation_id: "chat-1",
      sender: "alice",
      sender_name: "Alice",
      content: "Are you free?",
      timestamp: 1700000001000,
      direction: "inbound",
      channel_id: "whatsapp",
    });
    db.insertMessage({
      conversation_id: "chat-1",
      sender: "me",
      sender_name: null,
      content: "Yeah, what time?",
      timestamp: 1700000002000,
      direction: "outbound",
      channel_id: "whatsapp",
    });

    const messages = db.getConversationContext("chat-1", 10);
    expect(messages).toHaveLength(2);
    expect(messages[0].direction).toBe("inbound");
    expect(messages[1].direction).toBe("outbound");
  });
});
