/**
 * Tests for ConversationOrchestrator.
 *
 * Verifies the full conversation turn lifecycle: simple text responses,
 * tool-use loops, max-turn limits, error handling, context management,
 * and domain event emission using mocked dependencies (London School TDD).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationOrchestrator } from '../../src/mcp/application/conversation-orchestrator.js';
import { ToolRegistry } from '../../src/mcp/application/tool-registry.js';
import { ToolAccessGuard } from '../../src/mcp/application/tool-access-guard.js';
import { ToolExecutor } from '../../src/mcp/application/tool-executor.js';
import type { ToolDefinition, McpServerConfig } from '../../src/mcp/domain/types.js';
import type { ConversationContext } from '../../src/mcp/application/conversation-context.js';
import type { ILlmPort } from '../../src/mcp/ports/llm-port.js';
import type { DomainEventBus, DomainEvent } from '../../src/core/types/domain-events.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';
import type { TextBlock, ToolUseBlock, ToolResultBlock, ChatMessage } from '../../src/core/types/messages.js';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const tenantId = 'telegram:user1:chat1' as TenantIdString;

function createContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    sessionId: overrides.sessionId ?? 'session-1',
    tenantId: overrides.tenantId ?? tenantId,
    tier: overrides.tier ?? 'standard',
    history: overrides.history ?? [],
    maxHistoryTokens: overrides.maxHistoryTokens ?? 100000,
  };
}

function createToolDefinition(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: overrides.name ?? 'test-tool',
    description: overrides.description ?? 'A test tool',
    inputSchema: overrides.inputSchema ?? { type: 'object' },
    requiredTier: overrides.requiredTier ?? 'free',
    category: overrides.category ?? 'code',
    timeout: overrides.timeout ?? 5000,
  };
}

function createServerConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    serverId: overrides.serverId ?? 'server-1',
    name: overrides.name ?? 'Test Server',
    command: overrides.command ?? 'node',
    args: overrides.args ?? ['server.js'],
    env: overrides.env ?? {},
    tools: overrides.tools ?? [createToolDefinition()],
  };
}

function createMockEventBus(): DomainEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
    subscribeAll: vi.fn().mockReturnValue(() => {}),
  };
}

/** Helper to build a JSON chunk the orchestrator can parse via parseResponseChunk */
function textChunk(text: string): string {
  return JSON.stringify({ type: 'text', text } satisfies TextBlock);
}

function toolUseChunk(toolName: string, args: Record<string, unknown>, toolUseId: string): string {
  return JSON.stringify({
    type: 'tool_use',
    toolName,
    arguments: args,
    toolUseId,
  } satisfies ToolUseBlock);
}

/**
 * Creates a mock ILlmPort whose sendMessage returns the given chunks
 * on each successive call.  Each element in `callChunks` is an array
 * of JSON strings yielded for that invocation.
 */
function createMockLlmPort(callChunks: string[][]): ILlmPort {
  let callIndex = 0;
  return {
    sendMessage: vi.fn().mockImplementation(
      async function* (): AsyncIterable<string> {
        const chunks = callChunks[callIndex] ?? [];
        callIndex++;
        for (const chunk of chunks) {
          yield chunk;
        }
      }
    ),
    estimateTokens: vi.fn().mockReturnValue(10),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ConversationOrchestrator', () => {
  let eventBus: DomainEventBus;
  let toolRegistry: ToolRegistry;
  let accessGuard: ToolAccessGuard;
  let toolExecutor: ToolExecutor;
  let orchestrator: ConversationOrchestrator;

  beforeEach(() => {
    eventBus = createMockEventBus();
    toolRegistry = new ToolRegistry();
    accessGuard = new ToolAccessGuard();
    toolExecutor = new ToolExecutor(eventBus);

    // Spy on registry and guard so we can verify interactions
    vi.spyOn(toolRegistry, 'listTools');
    vi.spyOn(toolRegistry, 'findTool');
    vi.spyOn(toolRegistry, 'getServer');
    vi.spyOn(accessGuard, 'checkAccess');
  });

  function buildOrchestrator(llmPort: ILlmPort): ConversationOrchestrator {
    orchestrator = new ConversationOrchestrator(
      llmPort,
      toolRegistry,
      accessGuard,
      toolExecutor,
      eventBus,
    );
    return orchestrator;
  }

  // -------------------------------------------------------------------------
  // handleTurn() - simple text response (no tool use)
  // -------------------------------------------------------------------------
  describe('processTurn - simple text response', () => {
    it('should return assistant text when the LLM responds with a text block only', async () => {
      const llmPort = createMockLlmPort([
        [textChunk('Hello, how can I help?')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'Hi there', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBe('Hello, how can I help?');
        expect(result.value.toolInvocations).toHaveLength(0);
        expect(result.value.toolResults).toHaveLength(0);
        expect(result.value.userMessage).toBe('Hi there');
        expect(result.value.tenantId).toBe(tenantId);
      }
    });

    it('should pass the user message in the messages array sent to the LLM', async () => {
      const llmPort = createMockLlmPort([[textChunk('OK')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'What is 2+2?', createContext());

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);

      const sentMessages = sendMessageSpy.mock.calls[0]![0] as ChatMessage[];
      const lastMsg = sentMessages[sentMessages.length - 1]!;
      expect(lastMsg.role).toBe('user');
      expect(lastMsg.content).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'What is 2+2?' })])
      );
    });

    it('should pass available tools from the registry to the LLM', async () => {
      const tool = createToolDefinition({ name: 'read-file' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const llmPort = createMockLlmPort([[textChunk('Done')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'test', createContext());

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      const sentTools = sendMessageSpy.mock.calls[0]![1] as ToolDefinition[];
      expect(sentTools).toHaveLength(1);
      expect(sentTools[0]!.name).toBe('read-file');
    });

    it('should set startedAt and completedAt timestamps on the turn', async () => {
      const llmPort = createMockLlmPort([[textChunk('response')]]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'msg', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.startedAt).toBeInstanceOf(Date);
        expect(result.value.completedAt).toBeInstanceOf(Date);
        expect(result.value.completedAt!.getTime()).toBeGreaterThanOrEqual(
          result.value.startedAt.getTime()
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // handleTurn() - response with tool use (single round)
  // -------------------------------------------------------------------------
  describe('processTurn - single tool use round', () => {
    it('should execute the tool and send the result back to the LLM', async () => {
      const tool = createToolDefinition({ name: 'search', requiredTier: 'free' });
      const server = createServerConfig({ tools: [tool] });
      toolRegistry.register(server);

      const llmPort = createMockLlmPort([
        // 1st call: LLM requests a tool
        [toolUseChunk('search', { query: 'vitest' }, 'tu-1')],
        // 2nd call: LLM returns final text after seeing tool result
        [textChunk('Found 3 results for vitest.')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'search vitest', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBe('Found 3 results for vitest.');
        expect(result.value.toolInvocations).toHaveLength(1);
        expect(result.value.toolInvocations[0]!.toolName).toBe('search');
        expect(result.value.toolInvocations[0]!.invocationId).toBe('tu-1');
      }
    });

    it('should send tool result messages back to the LLM in the second call', async () => {
      const tool = createToolDefinition({ name: 'calc' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const llmPort = createMockLlmPort([
        [toolUseChunk('calc', { expr: '1+1' }, 'tu-calc')],
        [textChunk('The answer is 2.')],
      ]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'calculate 1+1', createContext());

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      expect(sendMessageSpy).toHaveBeenCalledTimes(2);

      // The second call should include the tool result
      const secondCallMessages = sendMessageSpy.mock.calls[1]![0] as ChatMessage[];
      const toolResultMsg = secondCallMessages.find(
        m => m.role === 'user' && m.content.some(b => b.type === 'tool_result')
      );
      expect(toolResultMsg).toBeDefined();

      const toolResultBlock = toolResultMsg!.content.find(
        b => b.type === 'tool_result'
      ) as ToolResultBlock;
      expect(toolResultBlock.toolUseId).toBe('tu-calc');
    });
  });

  // -------------------------------------------------------------------------
  // handleTurn() - multi-turn tool use loop
  // -------------------------------------------------------------------------
  describe('processTurn - multi-turn tool use loop', () => {
    it('should handle multiple sequential tool invocations across iterations', async () => {
      const toolA = createToolDefinition({ name: 'tool-a' });
      const toolB = createToolDefinition({ name: 'tool-b' });
      toolRegistry.register(createServerConfig({ tools: [toolA, toolB] }));

      const llmPort = createMockLlmPort([
        // Iteration 1: LLM calls tool-a
        [toolUseChunk('tool-a', { x: 1 }, 'tu-a')],
        // Iteration 2: LLM calls tool-b
        [toolUseChunk('tool-b', { y: 2 }, 'tu-b')],
        // Iteration 3: LLM returns final text
        [textChunk('All done with both tools.')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'do both', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBe('All done with both tools.');
        expect(result.value.toolInvocations).toHaveLength(2);
        expect(result.value.toolInvocations[0]!.toolName).toBe('tool-a');
        expect(result.value.toolInvocations[1]!.toolName).toBe('tool-b');
      }
    });

    it('should handle multiple tool calls within a single LLM response', async () => {
      const toolA = createToolDefinition({ name: 'alpha' });
      const toolB = createToolDefinition({ name: 'beta' });
      toolRegistry.register(createServerConfig({ tools: [toolA, toolB] }));

      const llmPort = createMockLlmPort([
        // Single response with two tool uses (parallel tool calls)
        [
          toolUseChunk('alpha', { a: 1 }, 'tu-alpha'),
          toolUseChunk('beta', { b: 2 }, 'tu-beta'),
        ],
        // Final text
        [textChunk('Both tools executed.')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'parallel tools', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toolInvocations).toHaveLength(2);
        const names = result.value.toolInvocations.map(i => i.toolName);
        expect(names).toContain('alpha');
        expect(names).toContain('beta');
        expect(result.value.assistantResponse).toBe('Both tools executed.');
      }
    });
  });

  // -------------------------------------------------------------------------
  // handleTurn() - max turns exceeded
  // -------------------------------------------------------------------------
  describe('processTurn - max invocations limit', () => {
    it('should stop after MAX_TOOL_INVOCATIONS (10) iterations', async () => {
      const tool = createToolDefinition({ name: 'loop-tool' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      // Build 10 tool-use responses + 1 extra that should never be reached
      const chunks: string[][] = [];
      for (let i = 0; i < 11; i++) {
        chunks.push([toolUseChunk('loop-tool', { i }, `tu-${i}`)]);
      }

      const llmPort = createMockLlmPort(chunks);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'loop', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        // The loop runs at most 10 times
        expect(result.value.toolInvocations.length).toBeLessThanOrEqual(10);
        // No final text was returned, so assistantResponse is undefined
        expect(result.value.assistantResponse).toBeUndefined();
      }

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      expect(sendMessageSpy).toHaveBeenCalledTimes(10);
    });

    it('should still return a valid turn result when max turns are exhausted', async () => {
      const tool = createToolDefinition({ name: 'infinite' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const chunks: string[][] = Array.from({ length: 12 }, (_, i) => [
        toolUseChunk('infinite', {}, `tu-${i}`),
      ]);

      const llmPort = createMockLlmPort(chunks);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'go', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.tenantId).toBe(tenantId);
        expect(result.value.userMessage).toBe('go');
        expect(result.value.startedAt).toBeInstanceOf(Date);
        expect(result.value.completedAt).toBeInstanceOf(Date);
      }
    });
  });

  // -------------------------------------------------------------------------
  // handleTurn() - LLM error handling
  // -------------------------------------------------------------------------
  describe('processTurn - LLM error handling', () => {
    it('should handle unparseable LLM chunks gracefully (no crash)', async () => {
      const llmPort = createMockLlmPort([
        ['not-valid-json', '{broken', textChunk('Still works')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'test', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBe('Still works');
      }
    });

    it('should handle LLM returning empty response (no blocks)', async () => {
      const llmPort = createMockLlmPort([[]]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'empty', createContext());

      // Empty response = no text block and no tool use blocks => loop breaks
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBeUndefined();
        expect(result.value.toolInvocations).toHaveLength(0);
      }
    });

    it('should propagate if the LLM async generator throws', async () => {
      const llmPort: ILlmPort = {
        sendMessage: vi.fn().mockImplementation(
          async function* (): AsyncIterable<string> {
            throw new Error('LLM provider unavailable');
          }
        ),
        estimateTokens: vi.fn().mockReturnValue(10),
      };
      buildOrchestrator(llmPort);

      await expect(
        orchestrator.processTurn(tenantId, 'crash', createContext())
      ).rejects.toThrow('LLM provider unavailable');
    });

    it('should propagate if the LLM throws mid-stream', async () => {
      const llmPort: ILlmPort = {
        sendMessage: vi.fn().mockImplementation(
          async function* (): AsyncIterable<string> {
            yield textChunk('partial');
            throw new Error('Stream interrupted');
          }
        ),
        estimateTokens: vi.fn().mockReturnValue(10),
      };
      buildOrchestrator(llmPort);

      await expect(
        orchestrator.processTurn(tenantId, 'interrupt', createContext())
      ).rejects.toThrow('Stream interrupted');
    });
  });

  // -------------------------------------------------------------------------
  // handleTurn() - tool execution error handling
  // -------------------------------------------------------------------------
  describe('processTurn - tool execution errors', () => {
    it('should include an error tool_result when the tool is not found', async () => {
      // Do NOT register the tool in the registry so findTool returns undefined
      const llmPort = createMockLlmPort([
        [toolUseChunk('missing-tool', {}, 'tu-miss')],
        [textChunk('Tool was not found.')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'use missing', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        // The invocation is tracked even on failure
        expect(result.value.toolInvocations).toHaveLength(1);
        // No successful tool result was pushed
        expect(result.value.toolResults).toHaveLength(0);
        expect(result.value.assistantResponse).toBe('Tool was not found.');
      }

      // Verify the error was sent back to the LLM as an error tool_result
      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      const secondCallMessages = sendMessageSpy.mock.calls[1]![0] as ChatMessage[];
      const errorResultMsg = secondCallMessages.find(m =>
        m.content.some(b => b.type === 'tool_result' && (b as ToolResultBlock).isError)
      );
      expect(errorResultMsg).toBeDefined();
    });

    it('should include an error tool_result when the server is not found for the tool', async () => {
      // Register a tool but mock getServer to return undefined
      const tool = createToolDefinition({ name: 'orphan-tool' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));
      vi.spyOn(toolRegistry, 'getServer').mockReturnValue(undefined);

      const llmPort = createMockLlmPort([
        [toolUseChunk('orphan-tool', {}, 'tu-orphan')],
        [textChunk('Server not found.')],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'orphan', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toolResults).toHaveLength(0);
      }
    });

    it('should include an error tool_result when access is denied', async () => {
      const tool = createToolDefinition({ name: 'admin-tool', requiredTier: 'admin' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const llmPort = createMockLlmPort([
        [toolUseChunk('admin-tool', {}, 'tu-admin')],
        [textChunk('Access denied.')],
      ]);
      buildOrchestrator(llmPort);

      // Context tier is 'free', tool requires 'admin'
      const ctx = createContext({ tier: 'free' });
      const result = await orchestrator.processTurn(tenantId, 'use admin tool', ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toolResults).toHaveLength(0);
      }

      // Verify error result was sent to LLM
      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      const secondCallMessages = sendMessageSpy.mock.calls[1]![0] as ChatMessage[];
      const toolResultMessage = secondCallMessages.find(m =>
        m.content.some(b => b.type === 'tool_result')
      );
      const errorBlock = toolResultMessage!.content.find(
        b => b.type === 'tool_result'
      ) as ToolResultBlock;
      expect(errorBlock.isError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // handleTurn() - stop_sequence / early termination
  // -------------------------------------------------------------------------
  describe('processTurn - early termination', () => {
    it('should stop when text block is received even if tool blocks are also present', async () => {
      // When a text block is present alongside tool use blocks, the text wins
      const tool = createToolDefinition({ name: 'side-tool' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const llmPort = createMockLlmPort([
        [
          textChunk('I have the answer already.'),
          toolUseChunk('side-tool', {}, 'tu-side'),
        ],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'question', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Text block was found, so the loop breaks immediately at iteration 1
        expect(result.value.assistantResponse).toBe('I have the answer already.');
        // No tool invocations because we break on text
        expect(result.value.toolInvocations).toHaveLength(0);
      }
    });

    it('should terminate loop when LLM returns neither text nor tool_use', async () => {
      // Only unparseable junk => no blocks => loop breaks
      const llmPort = createMockLlmPort([['invalid-json-only']]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'junk', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBeUndefined();
        expect(result.value.toolInvocations).toHaveLength(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Context management - history building across turns
  // -------------------------------------------------------------------------
  describe('context management - history building', () => {
    it('should include previous history messages when calling the LLM', async () => {
      const previousMessages: ChatMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'previous question' }],
          timestamp: new Date('2025-01-01T00:00:00Z'),
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'previous answer' }],
          timestamp: new Date('2025-01-01T00:01:00Z'),
        },
      ];

      const ctx = createContext({ history: previousMessages });
      const llmPort = createMockLlmPort([[textChunk('new answer')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'new question', ctx);

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      const sentMessages = sendMessageSpy.mock.calls[0]![0] as ChatMessage[];

      // History (2 messages) + new user message (1) = 3
      expect(sentMessages).toHaveLength(3);
      expect(sentMessages[0]!.role).toBe('user');
      expect((sentMessages[0]!.content[0] as TextBlock).text).toBe('previous question');
      expect(sentMessages[1]!.role).toBe('assistant');
      expect(sentMessages[2]!.role).toBe('user');
      expect((sentMessages[2]!.content[0] as TextBlock).text).toBe('new question');
    });

    it('should build up the message array across tool-use iterations', async () => {
      const tool = createToolDefinition({ name: 'step-tool' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const llmPort = createMockLlmPort([
        [toolUseChunk('step-tool', {}, 'tu-step')],
        [textChunk('Final answer.')],
      ]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'go', createContext());

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      expect(sendMessageSpy).toHaveBeenCalledTimes(2);

      // The orchestrator mutates the same `messages` array in-place, so both
      // calls share a reference.  After the full turn the array has all 3 entries:
      //   [user message, assistant tool_use, user tool_result]
      // We verify the final shape and the roles at each position.
      const messages = sendMessageSpy.mock.calls[0]![0] as ChatMessage[];
      expect(messages.length).toBeGreaterThanOrEqual(3);
      expect(messages[0]!.role).toBe('user');
      expect(messages[1]!.role).toBe('assistant');
      expect(messages[1]!.content[0]!.type).toBe('tool_use');
      expect(messages[2]!.role).toBe('user');
      expect(messages[2]!.content[0]!.type).toBe('tool_result');
    });
  });

  // -------------------------------------------------------------------------
  // Context management - token budget trimming
  // -------------------------------------------------------------------------
  describe('context management - token budget trimming', () => {
    it('should trim old messages when history exceeds maxHistoryTokens', async () => {
      const bigHistory: ChatMessage[] = Array.from({ length: 5 }, (_, i) => ({
        role: 'user' as const,
        content: [{ type: 'text' as const, text: `message ${i} ${'x'.repeat(100)}` }],
        timestamp: new Date(2025, 0, 1, 0, i),
      }));

      // estimateTokens returns 50 per message => 5 messages = 250 tokens
      // Set budget to 100 so trimming must happen
      const ctx = createContext({ history: bigHistory, maxHistoryTokens: 100 });

      const llmPort: ILlmPort = {
        sendMessage: vi.fn().mockImplementation(
          async function* (): AsyncIterable<string> {
            yield textChunk('trimmed response');
          }
        ),
        estimateTokens: vi.fn().mockReturnValue(50),
      };
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'after trim', ctx);

      const sendMessageSpy = llmPort.sendMessage as ReturnType<typeof vi.fn>;
      const sentMessages = sendMessageSpy.mock.calls[0]![0] as ChatMessage[];

      // Trimmed history should have fewer than 5 messages + the new user message
      // With 50 tokens each and budget of 100, only 2 history messages fit
      // Plus the new user message = 3 total
      expect(sentMessages.length).toBeLessThan(5 + 1);
      // The last message should always be the new user message
      const lastMsg = sentMessages[sentMessages.length - 1]!;
      expect(lastMsg.role).toBe('user');
      expect((lastMsg.content[0] as TextBlock).text).toBe('after trim');
    });

    it('should call estimateTokens bound to the LLM port', async () => {
      const history: ChatMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'hello' }],
          timestamp: new Date(),
        },
      ];
      const ctx = createContext({ history });

      const llmPort = createMockLlmPort([[textChunk('ok')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'test', ctx);

      const estimateTokensSpy = llmPort.estimateTokens as ReturnType<typeof vi.fn>;
      expect(estimateTokensSpy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Event emission for conversation lifecycle
  // -------------------------------------------------------------------------
  describe('event emission', () => {
    it('should emit ConversationStarted event at the beginning', async () => {
      const llmPort = createMockLlmPort([[textChunk('hi')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'greet', createContext({ sessionId: 'sess-42' }));

      const publishSpy = eventBus.publish as ReturnType<typeof vi.fn>;
      const startedCall = publishSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.conversation.started'
      );

      expect(startedCall).toBeDefined();
      const payload = (startedCall![0] as DomainEvent).payload as {
        tenantId: string;
        sessionId: string;
        userMessage: string;
      };
      expect(payload.tenantId).toBe(tenantId);
      expect(payload.sessionId).toBe('sess-42');
      expect(payload.userMessage).toBe('greet');
    });

    it('should emit ConversationCompleted event at the end', async () => {
      const llmPort = createMockLlmPort([[textChunk('bye')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'farewell', createContext({ sessionId: 'sess-99' }));

      const publishSpy = eventBus.publish as ReturnType<typeof vi.fn>;
      const completedCall = publishSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.conversation.completed'
      );

      expect(completedCall).toBeDefined();
      const payload = (completedCall![0] as DomainEvent).payload as {
        tenantId: string;
        sessionId: string;
        durationMs: number;
        toolInvocationCount: number;
      };
      expect(payload.tenantId).toBe(tenantId);
      expect(payload.sessionId).toBe('sess-99');
      expect(payload.durationMs).toBeGreaterThanOrEqual(0);
      expect(payload.toolInvocationCount).toBe(0);
    });

    it('should emit ConversationStarted before ConversationCompleted', async () => {
      const publishOrder: string[] = [];
      (eventBus.publish as ReturnType<typeof vi.fn>).mockImplementation(
        (event: DomainEvent) => {
          publishOrder.push(event.type);
        }
      );

      const llmPort = createMockLlmPort([[textChunk('order')]]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'check order', createContext());

      const startedIdx = publishOrder.indexOf('mcp.conversation.started');
      const completedIdx = publishOrder.indexOf('mcp.conversation.completed');

      expect(startedIdx).toBeGreaterThanOrEqual(0);
      expect(completedIdx).toBeGreaterThanOrEqual(0);
      expect(startedIdx).toBeLessThan(completedIdx);
    });

    it('should report correct toolInvocationCount in the completed event', async () => {
      const tool = createToolDefinition({ name: 'counted-tool' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const llmPort = createMockLlmPort([
        [toolUseChunk('counted-tool', {}, 'tu-1')],
        [toolUseChunk('counted-tool', {}, 'tu-2')],
        [textChunk('done')],
      ]);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'count tools', createContext());

      const publishSpy = eventBus.publish as ReturnType<typeof vi.fn>;
      const completedCall = publishSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.conversation.completed'
      );

      const payload = (completedCall![0] as DomainEvent).payload as {
        toolInvocationCount: number;
      };
      expect(payload.toolInvocationCount).toBe(2);
    });

    it('should emit completed event even when max invocations are reached', async () => {
      const tool = createToolDefinition({ name: 'exhaust' });
      toolRegistry.register(createServerConfig({ tools: [tool] }));

      const chunks: string[][] = Array.from({ length: 10 }, (_, i) => [
        toolUseChunk('exhaust', {}, `tu-${i}`),
      ]);

      const llmPort = createMockLlmPort(chunks);
      buildOrchestrator(llmPort);

      await orchestrator.processTurn(tenantId, 'exhaust', createContext());

      const publishSpy = eventBus.publish as ReturnType<typeof vi.fn>;
      const completedCall = publishSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as DomainEvent).type === 'mcp.conversation.completed'
      );

      expect(completedCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // parseResponseChunk - edge cases
  // -------------------------------------------------------------------------
  describe('parseResponseChunk behavior (via processTurn)', () => {
    it('should silently skip chunks that are not valid JSON', async () => {
      const llmPort = createMockLlmPort([
        ['garbage', '{"type":"text","text":"valid"}'],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'test', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBe('valid');
      }
    });

    it('should handle a mix of parseable and unparseable chunks', async () => {
      const llmPort = createMockLlmPort([
        [
          'bad1',
          textChunk('answer'),
          'bad2',
        ],
      ]);
      buildOrchestrator(llmPort);

      const result = await orchestrator.processTurn(tenantId, 'mixed', createContext());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assistantResponse).toBe('answer');
      }
    });
  });
});
