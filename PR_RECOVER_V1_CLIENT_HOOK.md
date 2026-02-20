PR: recover/v1.0-client-hook

Summary
-------
This PR adds a client-facing integration point for the auto-recover plugin flow:

- Introduces a new plugin hook `run_error` that allows plugins to inspect a run failure and return a recovery decision.
  - Hook signature (JS):
    onRunError(event) => Promise<{ action: 'retry'|'switch'|'fail', newModel?: string } | void>
  - Event carries: error message, error type, runId, sessionId, sessionKey, agentId, provider, model, attempt, timedOut, aborted, assistant

- Adds hook runner API: `hookRunner.runRunError(event, ctx)` and registers it in the global hook runner.

- Adds an opt-in flag on embedded PI runner params: `autoRecover?: boolean` (default false). When true, the runner will honor plugin responses that request automatic retry or model switch.

- Calls the `run_error` hook from the pi-embedded runner whenever a run fails (assistant stopReason === 'error', promptError, or timed out with no payloads). The runner:
  - Invokes the hook with a structured event and a recoveryAttempt counter
  - If the hook returns { action: 'retry' } and autoRecover=true: the runner will automatically resubmit the run
  - If the hook returns { action: 'switch', newModel } and autoRecover=true: the runner will switch the model and retry the run
  - If autoRecover=false (default): the runner will not automatically retry; instead it annotates the returned meta with `recoverySuggestion` (so clients can show a manual retry/switch UI)
  - The runner gracefully ignores hook failures (logging a warning) so existing behavior is not broken when plugins are absent or buggy

Files changed
-------------
- src/plugins/types.ts  (+PluginHookRunErrorEvent, PluginHookRunErrorResult, added "run_error" to PluginHookName and handler map)
- src/plugins/hooks.ts  (+runRunError wrapper + exported in hook runner)
- src/agents/pi-embedded-runner/run/params.ts  (+autoRecover?: boolean)
- src/agents/pi-embedded-runner/run.ts  (call-site: invoke run_error hook on failures; support for retry/switch/fail; add meta.recoverySuggestion; opt-in autoRecover behavior)

Branch
------
Branch created: recover/v1.0-client-hook (local branch in the `openclaw/` repository). To push:

  cd openclaw
  git push origin recover/v1.0-client-hook

PR body (copy to GitHub)
------------------------
Title: feat(recover): add run_error plugin hook + client-side integration (opt-in autoRecover)

Description:
Adds a new plugin hook `run_error` and wires it into the embedded PI agent runner. This hook enables plugins (the auto-recover plugin) to make recovery decisions when a run fails and optionally request automatic retries or model switches.

Behavior summary:
- Runner invokes `run_error` for error/timeout/prompt errors
- If plugin suggests `retry` or `switch` and run param `autoRecover=true`, the runner will automatically perform the requested action (up to existing loop limits)
- If `autoRecover=false` (default), the runner will not auto-retry; instead clients can surface a manual retry/switch option using `meta.recoverySuggestion` returned with run results
- Hook failures are non-fatal and will be logged, preserving previous behavior when no hook is present

Why this approach:
- Keeps backward compatibility: no change in default behavior (manual confirmation)
- Minimal, targeted surface area: new hook + runner call-site; clients can opt-in to automatic recovery or simply display the plugin suggestion
- Plugin-runner contract is small and explicit (action + optional newModel)

Testing & QA Plan
-----------------
Manual test (quick):
1. Create a tiny plugin implementing the `run_error` hook and register it with the Gateway (see plugin docs). Example hook body:
   module.exports = {
     hooks: {
       run_error: async (event, ctx) => {
         // for testing, request an immediate retry on first attempt
         if (event.attempt === 0) return { action: 'retry' };
         return { action: 'fail' };
       }
     }
   };

2. Start Gateway with the plugin enabled and run a query that triggers a model/provider failure (or mock a failure in tests).
3. Run the same scenario with `autoRecover: true` (set on the runner params/embedding caller path) and verify the runner resubmits the run automatically.
4. Run the scenario with `autoRecover: false` (default) and verify the returned run `meta` includes `recoverySuggestion` and there is no auto-retry.

Automated tests to add (recommended):
- Unit test for hooks.ts: ensure runRunError forwards to runModifyingHook and returns the expected result when a plugin returns a value
- Integration test in pi-embedded-runner: mock a failing attempt, install a test hook that returns { action: 'retry' } and verify the runner attempts another run when autoRecover=true; and verify no auto-retry but meta.recoverySuggestion when autoRecover=false

Notes for reviewers
-------------------
- The PR intentionally keeps the default behavior unchanged (no automatic retry) to avoid surprising clients
- The `recoverySuggestion` meta field is deliberately simple: { suggestedAction, newModel?, attempt } — UI/clients can render actionable buttons around this (TUI/webchat)
- I chose "run_error" as the hook name (snake_case) to match the existing hook naming convention in this codebase. The exported helper is `runRunError()` in hooks.ts.

Follow-up work
--------------
- Add client-side UI in TUI and WebChat to surface `meta.recoverySuggestion` and allow manual retry/switch
- Add a sample `auto-recover` plugin that implements common heuristics (retry on rate-limits, fallback to smaller model, rotate provider) and ships with tests


