/**
 * Tests for ToolRegistry.
 *
 * Verifies registration, unregistration, lookup, and filtered listing
 * of MCP tools across multiple servers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/mcp/application/tool-registry.js';
import type { McpServerConfig, ToolDefinition } from '../../src/mcp/domain/types.js';

/**
 * Factory helpers for test data.
 */
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

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a server and make its tools findable', () => {
      const tool = createToolDefinition({ name: 'read-file' });
      const server = createServerConfig({ serverId: 'fs-server', tools: [tool] });

      registry.register(server);

      const found = registry.findTool('read-file');
      expect(found).toBeDefined();
      expect(found!.name).toBe('read-file');
    });

    it('should register multiple tools from a single server', () => {
      const tools = [
        createToolDefinition({ name: 'tool-a', category: 'file' }),
        createToolDefinition({ name: 'tool-b', category: 'shell' }),
        createToolDefinition({ name: 'tool-c', category: 'web' }),
      ];
      const server = createServerConfig({ tools });

      registry.register(server);

      expect(registry.findTool('tool-a')).toBeDefined();
      expect(registry.findTool('tool-b')).toBeDefined();
      expect(registry.findTool('tool-c')).toBeDefined();
    });

    it('should register tools from multiple servers', () => {
      const server1 = createServerConfig({
        serverId: 'server-1',
        tools: [createToolDefinition({ name: 'alpha' })],
      });
      const server2 = createServerConfig({
        serverId: 'server-2',
        tools: [createToolDefinition({ name: 'beta' })],
      });

      registry.register(server1);
      registry.register(server2);

      expect(registry.findTool('alpha')).toBeDefined();
      expect(registry.findTool('beta')).toBeDefined();
    });

    it('should overwrite a tool when re-registered with the same name', () => {
      const toolV1 = createToolDefinition({ name: 'shared-tool', description: 'v1' });
      const toolV2 = createToolDefinition({ name: 'shared-tool', description: 'v2' });

      registry.register(createServerConfig({ serverId: 's1', tools: [toolV1] }));
      registry.register(createServerConfig({ serverId: 's2', tools: [toolV2] }));

      const found = registry.findTool('shared-tool');
      expect(found).toBeDefined();
      expect(found!.description).toBe('v2');
    });
  });

  describe('unregister', () => {
    it('should remove all tools from the unregistered server', () => {
      const tools = [
        createToolDefinition({ name: 'tool-x' }),
        createToolDefinition({ name: 'tool-y' }),
      ];
      const server = createServerConfig({ serverId: 'srv', tools });

      registry.register(server);
      expect(registry.findTool('tool-x')).toBeDefined();
      expect(registry.findTool('tool-y')).toBeDefined();

      registry.unregister('srv');

      expect(registry.findTool('tool-x')).toBeUndefined();
      expect(registry.findTool('tool-y')).toBeUndefined();
    });

    it('should not affect tools from other servers', () => {
      const server1 = createServerConfig({
        serverId: 'srv-1',
        tools: [createToolDefinition({ name: 'keep-me' })],
      });
      const server2 = createServerConfig({
        serverId: 'srv-2',
        tools: [createToolDefinition({ name: 'remove-me' })],
      });

      registry.register(server1);
      registry.register(server2);
      registry.unregister('srv-2');

      expect(registry.findTool('keep-me')).toBeDefined();
      expect(registry.findTool('remove-me')).toBeUndefined();
    });

    it('should be a no-op when unregistering a non-existent server', () => {
      // Should not throw
      registry.unregister('non-existent-server');
      expect(registry.listTools()).toHaveLength(0);
    });

    it('should allow re-registering a server after unregistering', () => {
      const server = createServerConfig({
        serverId: 'reuse',
        tools: [createToolDefinition({ name: 'reborn-tool' })],
      });

      registry.register(server);
      registry.unregister('reuse');
      expect(registry.findTool('reborn-tool')).toBeUndefined();

      registry.register(server);
      expect(registry.findTool('reborn-tool')).toBeDefined();
    });
  });

  describe('findTool', () => {
    it('should return undefined for a non-existent tool', () => {
      expect(registry.findTool('ghost-tool')).toBeUndefined();
    });

    it('should return the correct tool definition', () => {
      const tool = createToolDefinition({
        name: 'specific-tool',
        description: 'Does specific things',
        requiredTier: 'premium',
        category: 'system',
        timeout: 10000,
      });

      registry.register(createServerConfig({ tools: [tool] }));

      const found = registry.findTool('specific-tool');
      expect(found).toEqual(tool);
    });
  });

  describe('listTools', () => {
    it('should return an empty array when no tools are registered', () => {
      const tools = registry.listTools();
      expect(tools).toEqual([]);
    });

    it('should return all registered tools when no filter is provided', () => {
      const server = createServerConfig({
        tools: [
          createToolDefinition({ name: 'a' }),
          createToolDefinition({ name: 'b' }),
          createToolDefinition({ name: 'c' }),
        ],
      });

      registry.register(server);

      const tools = registry.listTools();
      expect(tools).toHaveLength(3);
      const names = tools.map(t => t.name);
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toContain('c');
    });

    it('should filter tools by category', () => {
      const server = createServerConfig({
        tools: [
          createToolDefinition({ name: 'file-tool', category: 'file' }),
          createToolDefinition({ name: 'shell-tool', category: 'shell' }),
          createToolDefinition({ name: 'another-file', category: 'file' }),
        ],
      });

      registry.register(server);

      const fileTools = registry.listTools({ category: 'file' });
      expect(fileTools).toHaveLength(2);
      expect(fileTools.every(t => t.category === 'file')).toBe(true);
    });

    it('should filter tools by tier', () => {
      const server = createServerConfig({
        tools: [
          createToolDefinition({ name: 'free-tool', requiredTier: 'free' }),
          createToolDefinition({ name: 'premium-tool', requiredTier: 'premium' }),
          createToolDefinition({ name: 'admin-tool', requiredTier: 'admin' }),
        ],
      });

      registry.register(server);

      const premiumTools = registry.listTools({ tier: 'premium' });
      expect(premiumTools).toHaveLength(1);
      expect(premiumTools[0]!.name).toBe('premium-tool');
    });

    it('should filter tools by both category and tier simultaneously', () => {
      const server = createServerConfig({
        tools: [
          createToolDefinition({ name: 'free-file', category: 'file', requiredTier: 'free' }),
          createToolDefinition({ name: 'premium-file', category: 'file', requiredTier: 'premium' }),
          createToolDefinition({ name: 'free-shell', category: 'shell', requiredTier: 'free' }),
          createToolDefinition({ name: 'premium-shell', category: 'shell', requiredTier: 'premium' }),
        ],
      });

      registry.register(server);

      const result = registry.listTools({ category: 'file', tier: 'premium' });
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('premium-file');
    });

    it('should return empty array when filter matches nothing', () => {
      const server = createServerConfig({
        tools: [createToolDefinition({ name: 'a', category: 'code' })],
      });

      registry.register(server);

      const result = registry.listTools({ category: 'web' });
      expect(result).toHaveLength(0);
    });

    it('should aggregate tools across multiple servers', () => {
      registry.register(createServerConfig({
        serverId: 'srv-1',
        tools: [createToolDefinition({ name: 'from-1' })],
      }));
      registry.register(createServerConfig({
        serverId: 'srv-2',
        tools: [createToolDefinition({ name: 'from-2' })],
      }));

      const tools = registry.listTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('getServer', () => {
    it('should return the server config for a registered tool', () => {
      const server = createServerConfig({
        serverId: 'my-server',
        name: 'My Server',
        tools: [createToolDefinition({ name: 'my-tool' })],
      });

      registry.register(server);

      const result = registry.getServer('my-tool');
      expect(result).toBeDefined();
      expect(result!.serverId).toBe('my-server');
      expect(result!.name).toBe('My Server');
    });

    it('should return undefined for a non-existent tool', () => {
      expect(registry.getServer('missing-tool')).toBeUndefined();
    });

    it('should return the correct server when tools span multiple servers', () => {
      registry.register(createServerConfig({
        serverId: 'alpha-srv',
        tools: [createToolDefinition({ name: 'alpha-tool' })],
      }));
      registry.register(createServerConfig({
        serverId: 'beta-srv',
        tools: [createToolDefinition({ name: 'beta-tool' })],
      }));

      expect(registry.getServer('alpha-tool')!.serverId).toBe('alpha-srv');
      expect(registry.getServer('beta-tool')!.serverId).toBe('beta-srv');
    });

    it('should return undefined after the owning server is unregistered', () => {
      registry.register(createServerConfig({
        serverId: 'temp-srv',
        tools: [createToolDefinition({ name: 'temp-tool' })],
      }));

      registry.unregister('temp-srv');

      expect(registry.getServer('temp-tool')).toBeUndefined();
    });
  });
});
