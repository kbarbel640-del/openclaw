import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Mem0SQLite } from './mem0.js';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';

describe('Mem0SQLite', () => {
  let mem0: Mem0SQLite;
  let tempDir: string;
  let dbPath: string;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), 'openclaw-mem0-test-' + Date.now());
    dbPath = path.join(tempDir, 'mem0.db');
    mem0 = await Mem0SQLite.create(dbPath);
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  it('should add and retrieve memories by layer', async () => {
    await mem0.addMemory('pref', 'User likes TypeScript');
    await mem0.addMemory('fact', 'Server is at 10.0.0.1');

    const context = await mem0.getContext();
    expect(context).toContain('User likes TypeScript');
    expect(context).toContain('Server is at 10.0.0.1');
  });

  it('should deduplicate exact memories in the same layer', async () => {
    await mem0.addMemory('pref', 'Unique Preference');
    await mem0.addMemory('pref', 'Unique Preference');

    const context = await mem0.getContext();
    const occurrences = (context.match(/Unique Preference/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('should update session summary', async () => {
    const summary = 'Discussion about vault hardening.';
    await mem0.updateSessionSummary(summary);

    const context = await mem0.getContext();
    expect(context).toContain(summary);
  });

  it('should respect token budget', async () => {
    await mem0.addMemory('fact', 'Long fact that should be truncated');
    const smallBudgetContext = await mem0.getContext(20);
    expect(smallBudgetContext.length).toBeLessThanOrEqual(20);
  });
});
