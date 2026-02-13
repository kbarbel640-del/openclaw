import type { Result } from '../../core/types/result.js';
import { err } from '../../core/types/result.js';
import { PluginExecutionError } from '../domain/errors.js';

/**
 * Plugin execution sandbox interface.
 * Provides isolation and resource limits for plugin code execution.
 */
export interface IPluginSandbox {
  /**
   * Execute a plugin function in a sandboxed environment
   */
  execute(
    pluginId: string,
    fn: string,
    args: unknown[]
  ): Promise<Result<unknown, PluginExecutionError>>;

  /**
   * Get current memory usage for a plugin
   */
  getMemoryUsage(pluginId: string): number;

  /**
   * Terminate a running plugin
   */
  terminate(pluginId: string): void;
}

/**
 * No-op sandbox implementation for testing.
 * In production, this would use worker threads or VM isolation.
 */
export class NoOpSandbox implements IPluginSandbox {
  async execute(
    pluginId: string,
    _fn: string,
    _args: unknown[]
  ): Promise<Result<unknown, PluginExecutionError>> {
    return err(
      new PluginExecutionError(
        `Sandbox not implemented for plugin ${pluginId}`
      )
    );
  }

  getMemoryUsage(_pluginId: string): number {
    return 0;
  }

  terminate(_pluginId: string): void {
    // No-op
  }
}
