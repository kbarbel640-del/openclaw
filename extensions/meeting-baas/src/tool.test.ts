import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared mock client — every createBaasClient call returns this same object
const mockClientObj = {
  createBot: vi.fn(),
  getBotDetails: vi.fn(),
  leaveBot: vi.fn(),
  listBots: vi.fn(),
  deleteBotData: vi.fn(),
};

vi.mock("@meeting-baas/sdk", () => ({
  createBaasClient: vi.fn(() => mockClientObj),
}));

import { createBaasClient } from "@meeting-baas/sdk";
import { createMeetingBotTool, _resetClient } from "./tool.js";

describe("meeting_bot tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetClient();
  });

  it("returns error when API key is missing", async () => {
    const tool = createMeetingBotTool({});
    const res = await tool.execute("id", { action: "list_bots" });
    expect(JSON.parse(res.content[0].text)).toMatchObject({
      error: expect.stringContaining("API key not configured"),
    });
  });

  describe("create_bot", () => {
    it("creates a bot successfully", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.createBot.mockResolvedValueOnce({
        success: true,
        data: { bot_id: "bot-123", status: "joining_call" },
      });

      const res = await tool.execute("id", {
        action: "create_bot",
        meeting_url: "https://meet.google.com/abc-defg-hij",
        bot_name: "Test Bot",
        entry_message: "Hello!",
        recording_mode: "speaker_view",
      });

      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.bot_id).toBe("bot-123");
      expect(mockClientObj.createBot).toHaveBeenCalledWith({
        meeting_url: "https://meet.google.com/abc-defg-hij",
        bot_name: "Test Bot",
        entry_message: "Hello!",
        recording_mode: "speaker_view",
      });
    });

    it("errors when meeting_url is missing", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      const res = await tool.execute("id", {
        action: "create_bot",
        bot_name: "Bot",
      });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("meeting_url is required"),
      });
    });

    it("errors when bot_name is missing", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      const res = await tool.execute("id", {
        action: "create_bot",
        meeting_url: "https://zoom.us/j/123",
      });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("bot_name is required"),
      });
    });

    it("handles API error response", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.createBot.mockResolvedValueOnce({
        success: false,
        error: "Invalid meeting URL",
        message: "The meeting URL is not valid",
      });

      const res = await tool.execute("id", {
        action: "create_bot",
        meeting_url: "https://invalid.url",
        bot_name: "Bot",
      });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("Invalid meeting URL"),
      });
    });
  });

  describe("get_bot", () => {
    it("returns bot details", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.getBotDetails.mockResolvedValueOnce({
        success: true,
        data: {
          bot_id: "bot-123",
          status: "in_call_recording",
          participants: [{ name: "Alice" }],
        },
      });

      const res = await tool.execute("id", { action: "get_bot", bot_id: "bot-123" });
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.bot_id).toBe("bot-123");
      expect(parsed.status).toBe("in_call_recording");
    });

    it("errors when bot_id is missing", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      const res = await tool.execute("id", { action: "get_bot" });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("bot_id is required"),
      });
    });
  });

  describe("get_transcript", () => {
    it("returns transcript and media URLs", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.getBotDetails.mockResolvedValueOnce({
        success: true,
        data: {
          bot_id: "bot-123",
          status: "completed",
          transcription: "https://storage.example.com/transcript.json",
          raw_transcription: "https://storage.example.com/raw.json",
          diarization: "https://storage.example.com/diarize.json",
          audio: "https://storage.example.com/audio.mp3",
          video: "https://storage.example.com/video.mp4",
          participants: [{ name: "Alice" }],
          speakers: [{ name: "Alice" }],
          duration_seconds: 3600,
        },
      });

      const res = await tool.execute("id", { action: "get_transcript", bot_id: "bot-123" });
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.transcription).toBe("https://storage.example.com/transcript.json");
      expect(parsed.audio).toBe("https://storage.example.com/audio.mp3");
      expect(parsed.duration_seconds).toBe(3600);
      expect(parsed.speakers).toEqual([{ name: "Alice" }]);
    });

    it("errors when bot_id is missing", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      const res = await tool.execute("id", { action: "get_transcript" });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("bot_id is required"),
      });
    });
  });

  describe("leave_bot", () => {
    it("removes bot from meeting", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.leaveBot.mockResolvedValueOnce({
        success: true,
        data: { ok: true },
      });

      const res = await tool.execute("id", { action: "leave_bot", bot_id: "bot-123" });
      expect(JSON.parse(res.content[0].text)).toMatchObject({ ok: true });
      expect(mockClientObj.leaveBot).toHaveBeenCalledWith({ bot_id: "bot-123" });
    });

    it("errors when bot_id is missing", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      const res = await tool.execute("id", { action: "leave_bot" });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("bot_id is required"),
      });
    });
  });

  describe("list_bots", () => {
    it("lists all bots", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.listBots.mockResolvedValueOnce({
        success: true,
        data: [{ bot_id: "bot-1" }, { bot_id: "bot-2" }],
      });

      const res = await tool.execute("id", { action: "list_bots" });
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed).toHaveLength(2);
    });
  });

  describe("delete_bot_data", () => {
    it("deletes bot data", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.deleteBotData.mockResolvedValueOnce({
        success: true,
        data: { deleted: true },
      });

      const res = await tool.execute("id", { action: "delete_bot_data", bot_id: "bot-123" });
      expect(JSON.parse(res.content[0].text)).toMatchObject({ deleted: true });
      expect(mockClientObj.deleteBotData).toHaveBeenCalledWith({ bot_id: "bot-123" });
    });

    it("errors when bot_id is missing", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      const res = await tool.execute("id", { action: "delete_bot_data" });
      expect(JSON.parse(res.content[0].text)).toMatchObject({
        error: expect.stringContaining("bot_id is required"),
      });
    });
  });

  describe("client caching", () => {
    it("reuses client for same config", async () => {
      const tool = createMeetingBotTool({ apiKey: "test-key" });
      mockClientObj.listBots.mockResolvedValue({ success: true, data: [] });

      await tool.execute("id1", { action: "list_bots" });
      await tool.execute("id2", { action: "list_bots" });

      expect(createBaasClient).toHaveBeenCalledTimes(1);
    });
  });
});
