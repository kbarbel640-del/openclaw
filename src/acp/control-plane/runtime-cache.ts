import type { AcpRuntime, AcpRuntimeHandle, AcpRuntimeSessionMode } from "../runtime/types.js";

export type CachedRuntimeState = {
  runtime: AcpRuntime;
  handle: AcpRuntimeHandle;
  backend: string;
  agent: string;
  mode: AcpRuntimeSessionMode;
  cwd?: string;
  appliedControlSignature?: string;
};

export class RuntimeCache {
  private readonly cache = new Map<string, CachedRuntimeState>();

  size(): number {
    return this.cache.size;
  }

  has(actorKey: string): boolean {
    return this.cache.has(actorKey);
  }

  get(actorKey: string): CachedRuntimeState | null {
    return this.cache.get(actorKey) ?? null;
  }

  set(actorKey: string, state: CachedRuntimeState): void {
    this.cache.set(actorKey, state);
  }

  clear(actorKey: string): void {
    this.cache.delete(actorKey);
  }
}
