import { describe, expect, it, vi } from "vitest";

import { ClawdisAgent } from "./agent.js";

describe("ClawdisAgent", () => {
	const mockConnection = {
		sessionUpdate: vi.fn().mockResolvedValue(undefined),
		requestPermission: vi.fn().mockResolvedValue({ outcome: { outcome: "allow_once", optionId: "allow" } }),
		readTextFile: vi.fn(),
		writeTextFile: vi.fn(),
		createTerminal: vi.fn(),
		extMethod: vi.fn(),
		extNotification: vi.fn(),
	};

	describe("initialize", () => {
		it("returns protocol version and capabilities", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			const response = await agent.initialize({
				protocolVersion: 1,
				clientCapabilities: {
					fs: { readTextFile: true, writeTextFile: true },
					terminal: true,
				},
				clientInfo: { name: "test-client", version: "1.0.0" },
			});

			expect(response.protocolVersion).toBe(1);
			expect(response.agentCapabilities).toBeDefined();
			expect(response.agentCapabilities?.loadSession).toBe(false);
			expect(response.agentInfo?.name).toBe("clawd");
		});
	});

	describe("newSession", () => {
		it("creates a session with a unique ID", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			const response = await agent.newSession({
				cwd: "/tmp/test",
				mcpServers: [],
			});

			expect(response.sessionId).toBeDefined();
			expect(typeof response.sessionId).toBe("string");
			expect(response.sessionId.length).toBeGreaterThan(0);
		});

		it("creates unique session IDs for each call", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			const response1 = await agent.newSession({ cwd: "/tmp/test1", mcpServers: [] });
			const response2 = await agent.newSession({ cwd: "/tmp/test2", mcpServers: [] });

			expect(response1.sessionId).not.toBe(response2.sessionId);
		});
	});

	describe("prompt", () => {
		it("throws for unknown session", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			await expect(
				agent.prompt({
					sessionId: "nonexistent",
					prompt: [{ type: "text", text: "hello" }],
				}),
			).rejects.toThrow("Session nonexistent not found");
		});
	});

	describe("cancel", () => {
		it("does not throw for unknown session", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			// Should not throw
			await agent.cancel({ sessionId: "nonexistent" });
		});
	});

	describe("authenticate", () => {
		it("returns empty response (no auth required)", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			const response = await agent.authenticate({ methodId: "none" });

			expect(response).toEqual({});
		});
	});

	describe("setSessionMode", () => {
		it("returns empty response", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			const response = await agent.setSessionMode({
				sessionId: "test",
				mode: { name: "default" },
			});

			expect(response).toEqual({});
		});
	});

	describe("loadSession", () => {
		it("throws not implemented", async () => {
			const agent = new ClawdisAgent(mockConnection as any);

			await expect(
				agent.loadSession({ sessionId: "test" }),
			).rejects.toThrow("Session loading not yet implemented");
		});
	});
});
