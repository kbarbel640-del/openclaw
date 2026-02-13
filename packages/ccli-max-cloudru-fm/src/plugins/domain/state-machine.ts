import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { PluginState } from './types.js';
import { PluginSystemError } from './errors.js';

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  registered: ['installed', 'error'],
  installed: ['active', 'error'],
  active: ['disabled', 'error'],
  disabled: ['active', 'error'],
  error: ['disabled'],
};

export function transitionPlugin(
  current: PluginState,
  target: PluginState
): Result<PluginState, PluginSystemError> {
  if (current === target) {
    return ok(current);
  }

  const allowedTargets = VALID_TRANSITIONS[current];
  if (!allowedTargets || !allowedTargets.includes(target)) {
    return err(
      new PluginSystemError(
        `Invalid state transition: ${current} -> ${target}`
      )
    );
  }

  return ok(target);
}

export function canTransition(current: PluginState, target: PluginState): boolean {
  if (current === target) {
    return true;
  }

  const allowedTargets = VALID_TRANSITIONS[current];
  return allowedTargets ? allowedTargets.includes(target) : false;
}

export function getValidTransitions(current: PluginState): PluginState[] {
  return VALID_TRANSITIONS[current] || [];
}
