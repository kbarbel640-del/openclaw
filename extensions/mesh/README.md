# Mesh Plugin for OpenClaw

Mesh is a workflow orchestration plugin for OpenClaw.

It adds deterministic multi-step execution on top of existing OpenClaw agents:
- explicit workflow plans (DAG)
- step dependencies
- run status tracking
- targeted retries

## Features

Gateway methods:
- `mesh.plan`
- `mesh.plan.auto`
- `mesh.run`
- `mesh.status`
- `mesh.retry`

Chat command:
- `/mesh <goal>`
- `/mesh plan <goal>`
- `/mesh run <goal|mesh-plan-id>`
- `/mesh status <runId>`
- `/mesh retry <runId> [step1,step2,...]`

## Install

### From a local OpenClaw checkout

```bash
openclaw plugins install ./extensions/mesh
openclaw plugins enable mesh
```

### From a linked local path

```bash
openclaw plugins install --link ./extensions/mesh
openclaw plugins enable mesh
```

If this plugin is bundled in your build, you still need to enable it:

```bash
openclaw plugins enable mesh
```

## Config

Current plugin config schema is empty (no required settings):

```json5
{
  plugins: {
    entries: {
      mesh: {
        enabled: true
      }
    }
  }
}
```

Restart the gateway after install/enable/config changes.

## Usage

In chat:

```text
/mesh Build a landing page animation, test mobile, then write release notes
```

Or step-by-step:

```text
/mesh plan Build a landing page animation, test mobile, then write release notes
/mesh run mesh-plan-<id>
/mesh status mesh-run-<id>
/mesh retry mesh-run-<id> test-mobile
```

## Notes

- run state is in-memory today (not persisted across gateway restarts)
- plan cache for `/mesh run <mesh-plan-id>` is in-memory and scoped to chat sender/channel
