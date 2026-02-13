import { OpenClawError } from '../../core/types/errors.js';

export class PluginSystemError extends OpenClawError {
  readonly code = 'PLUGIN_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Plugin error occurred.';
  }
}

export class PluginNotFoundError extends PluginSystemError {
  constructor(pluginId: string) {
    super(`Plugin not found: ${pluginId}`);
    this.name = 'PluginNotFoundError';
  }

  toUserMessage(): string {
    return 'The requested plugin was not found.';
  }
}

export class PluginInstallError extends PluginSystemError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'PluginInstallError';
  }

  toUserMessage(): string {
    return 'Failed to install plugin.';
  }
}

export class PluginPermissionError extends PluginSystemError {
  constructor(message: string) {
    super(message);
    this.name = 'PluginPermissionError';
  }

  toUserMessage(): string {
    return 'Plugin does not have required permissions.';
  }
}

export class PluginExecutionError extends PluginSystemError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'PluginExecutionError';
  }

  toUserMessage(): string {
    return 'Plugin execution failed.';
  }
}

export class PluginConfigError extends PluginSystemError {
  constructor(message: string) {
    super(message);
    this.name = 'PluginConfigError';
  }

  toUserMessage(): string {
    return 'Plugin configuration is invalid.';
  }
}
