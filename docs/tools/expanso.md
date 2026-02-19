---
title: Expanso Pipeline Builder & Validator
summary: "Natural language Expanso pipeline builder, cloud validation sandbox, and Crusty bot integration."
read_when:
  - Building or validating Expanso data pipelines using natural language
  - Integrating the Expanso Expert agent into Discord or Telegram via Crusty
  - Configuring the cloud validation sandbox or security model
---

# Expanso Pipeline Builder & Validator

OpenClaw ships an **Expanso Expert** agent that lets you build, validate, and fix [Expanso](https://www.expanso.io/) data-pipeline configurations using plain English.
No YAML knowledge required — just describe what you want your pipeline to do.

## Overview

The system exposes three capabilities through the unified `expanso` tool:

| Action     | What it does                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `build`    | Generate a valid Expanso pipeline YAML from a natural language description.                       |
| `validate` | Validate an existing pipeline YAML using the real `expanso` binary in an isolated Docker sandbox. |
| `fix`      | Generate a pipeline, validate it, and automatically repair errors — up to 3 rounds.               |

All three are available as:

- **Agent tool calls** (any agent with the `expanso` tool enabled).
- **Slash commands** via the Crusty bot on Discord and Telegram (see [Bot Commands](#bot-commands)).

---

## Natural Language Pipeline Builder

Describe your pipeline in plain English and the Expanso Expert generates the YAML for you.

### Example descriptions

```
Read CSV files from /data/input, filter rows where status = active,
write JSON records to stdout.
```

```
Listen on a Kafka topic called "events", deduplicate messages by the "id"
field, write unique events to a PostgreSQL table named "processed_events".
```

```
Fetch HTTP webhooks on port 8080, apply a Bloblang mapping to extract the
"payload" field, publish the result to an SNS topic.
```

### What the generator returns

The tool responds with:

- A `pipeline` object (structured JSON matching the `ExpansoPipeline` schema).
- A `yaml` string (the YAML representation ready to deploy).

```yaml
name: "csv-to-json-pipeline"
description: "Reads CSV files from /data/input, filters active rows, writes JSON to stdout"
inputs:
  - name: "csv-reader"
    type: "file"
    config:
      path: "/data/input/*.csv"
      codec: "csv"
transforms:
  - name: "filter-active"
    type: "bloblang"
    config:
      mapping: 'root = if this.status == "active" { this } else { deleted() }'
outputs:
  - name: "json-writer"
    type: "stdout"
    config:
      codec: "json"
```

### Pipeline schema

Every Expanso pipeline requires:

| Field         | Required | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| `name`        | ✅       | Unique name for this pipeline.               |
| `inputs`      | ✅       | One or more input source definitions.        |
| `outputs`     | ✅       | One or more output destination definitions.  |
| `description` | ❌       | Human-readable description.                  |
| `transforms`  | ❌       | Zero or more processing/transform steps.     |
| `metadata`    | ❌       | Arbitrary key/value pairs for documentation. |

Each **input**, **transform**, and **output** has:

- `name` — Unique identifier within the pipeline.
- `type` — Driver or plugin type (e.g. `file`, `kafka`, `http_server`, `bloblang`).
- `config` — Driver-specific key/value configuration (optional).

---

## Cloud Validation Sandbox

When you validate a pipeline, OpenClaw runs the real `expanso validate` binary inside an ephemeral Docker container. This ensures:

- **Real validation** — the same binary that Expanso uses in production.
- **Isolation** — the sandbox container is fully network-isolated, read-only root filesystem, no host mounts.
- **Security** — all Linux capabilities are dropped (`--cap-drop ALL`); no privilege escalation possible.

### Sandbox configuration

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Docker image      | `openclaw-expanso-sandbox:latest` |
| Container prefix  | `openclaw-sbx-expanso-`           |
| Working directory | `/workspace`                      |
| Pipeline path     | `/workspace/pipeline.yaml`        |
| Root filesystem   | Read-only                         |
| Network           | None (disabled)                   |
| Capabilities      | All dropped                       |

### Validation result structure

```json
{
  "success": true,
  "errors": [],
  "warnings": [{ "message": "No description set for pipeline", "location": "root" }],
  "rawOutput": "Validation passed\n",
  "rawError": "",
  "exitCode": 0
}
```

| Field       | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `success`   | `true` if the binary exited 0 with no errors.                |
| `errors`    | Validation errors (non-empty means the pipeline is invalid). |
| `warnings`  | Non-fatal warnings that should be reviewed.                  |
| `rawOutput` | Raw stdout from the `expanso validate` binary.               |
| `rawError`  | Raw stderr from the binary (useful for debugging).           |
| `exitCode`  | Numeric exit code (0 = success).                             |

---

## Crusty Bot Integration

The Expanso Expert is fully integrated into the **Crusty bot** on both Discord and Telegram.
Users can build, validate, and fix pipelines directly from their preferred chat platform.

### Bot Commands

#### `/expanso build <description>`

Generate a pipeline YAML from a plain English description.

**Examples:**

```
/expanso build Read CSV files from /data, filter rows where status=active, write JSON to stdout
/expanso build Listen on Kafka topic "events", deduplicate by id field, write to PostgreSQL
/expanso build Fetch HTTP webhooks on port 8080, apply Bloblang mapping, publish to SNS
```

**Response:** The bot replies with the generated YAML in a code block, a plain-English summary of each section, and a ✅/❌ validation status.

---

#### `/expanso validate <yaml>`

Validate an existing Expanso pipeline YAML.

**Examples:**

```
/expanso validate name: my-pipeline
inputs:
  - name: reader
    type: file
    config:
      path: /data/*.csv
outputs:
  - name: writer
    type: stdout
```

**Response:** The bot reports `✅ Pipeline is valid` or `❌ Pipeline validation failed` with a bullet-pointed list of errors and warnings. If validation fails, a **🔧 Fix** button (Discord) or inline keyboard button (Telegram) appears.

---

#### `/expanso fix <description>`

Generate a pipeline, validate it, and automatically repair any errors — up to 3 rounds.

**Examples:**

```
/expanso fix Stream Kafka events to PostgreSQL, deduplicate by id
/expanso fix Read S3 objects from my-bucket, transform with Bloblang, write to stdout
```

**Response:** The bot runs generate → validate → re-generate in a loop and reports the final validated pipeline YAML plus how many attempts were needed.

---

### Interactive Fix Button

When a validation fails, the bot attaches a **🔧 Fix** button to the failure message.
Clicking this button triggers the `fix` action automatically — you do not need to re-type your description.

| Platform | Mechanism                                                             |
| -------- | --------------------------------------------------------------------- |
| Discord  | Agent component button with custom ID `agent:componentId=expanso-fix` |
| Telegram | Inline keyboard button with `callback_data: expanso_fix`              |

The agent receives a system event and immediately calls `expanso` with `action: "fix"` using the pipeline description from the conversation context.

---

### Discord Setup

To enable the `/expanso` slash command in your Discord server:

1. Ensure the Expanso Expert agent is configured in `openclaw.json`:

```json5
{
  agents: {
    list: [
      {
        id: "expanso-expert",
        tools: { allow: ["expanso"] },
      },
    ],
  },
}
```

2. The command will appear in the Discord slash-command list as `/expanso` with three choices: **build**, **validate**, **fix**.
3. An `action` menu is shown automatically if you invoke `/expanso` without arguments.

---

### Telegram Setup

To enable `/expanso` in a Telegram chat:

1. Ensure native commands are enabled (`nativeEnabled: true`) in the Telegram bot account config.
2. The bot registers `/expanso` with `setMyCommands` on startup.
3. Use `/expanso build <description>`, `/expanso validate <yaml>`, or `/expanso fix <description>` directly.

---

## Security Model

The Expanso system is designed with defence-in-depth:

### Generator (NL → YAML)

- LLM calls are made server-side; user input is passed as a message, never interpolated into code.
- The generated pipeline is validated against the `ExpansoPipelineSchema` before being returned. Invalid generator output is rejected, not forwarded.

### Validator (YAML → binary)

- All validation runs inside a Docker container with a **read-only root filesystem**, **no network**, and **all Linux capabilities dropped**.
- The YAML is written to `/workspace/pipeline.yaml` inside the container; no host directories are mounted.
- Containers are ephemeral — destroyed after the binary exits.
- A size limit is enforced on the pipeline YAML to prevent resource exhaustion.

### Audit logging

- Every validation execution is logged via the `expanso-audit` module.
- Audit entries record: timestamp, pipeline YAML hash, user/session ID, exit code, raw output, and error summary.
- Logs are retained for compliance review.

### Bot-side controls

- Inline buttons (Fix) are only triggered via the bot's session key resolution — cross-session fix requests are rejected.
- The `inlineButtonsScope` for Telegram defaults to `allowlist`, limiting which users can trigger inline callbacks.

---

## Agent Tool Reference

For direct agent use (without the bot), call the `expanso` tool with these parameters:

```json
{
  "action": "build",
  "description": "Read CSV files from /data, write JSON to stdout"
}
```

```json
{
  "action": "validate",
  "yaml": "name: my-pipeline\ninputs:\n  - name: in\n    type: stdin\noutputs:\n  - name: out\n    type: stdout\n"
}
```

```json
{
  "action": "fix",
  "description": "Stream Kafka events to PostgreSQL",
  "yaml": "<optional starting YAML if you have one>"
}
```

| Parameter     | Required for              | Description                                                  |
| ------------- | ------------------------- | ------------------------------------------------------------ |
| `action`      | All actions               | `"build"`, `"validate"`, or `"fix"`                          |
| `description` | `build`, `fix`            | Plain English pipeline description.                          |
| `yaml`        | `validate`; opt for `fix` | Existing pipeline YAML to validate or use as starting point. |
| `apiKey`      | Never (optional)          | LLM API key override for the generator.                      |

---

## Expanso Pipeline Concepts

| Concept        | Description                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Inputs**     | Where data enters the pipeline. Examples: `stdin`, `file`, `kafka`, `http_server`, `s3`, `mqtt`.        |
| **Transforms** | Stateless processing steps applied to each message. Examples: `bloblang`, `filter`, `dedupe`, `branch`. |
| **Outputs**    | Where processed data is sent. Examples: `stdout`, `file`, `kafka`, `postgresql`, `s3`, `http_client`.   |
| **Bloblang**   | Expanso's built-in mapping language for data transformation and filtering.                              |
| **Metadata**   | Optional key/value pairs attached to the pipeline definition for documentation.                         |

Pipelines require **at least one input and one output**. Transforms are optional.

---

## Further Reading

- [Expanso documentation](https://www.expanso.io/docs/) — Full reference for input/output/transform types and Bloblang.
- [Lobster](/tools/lobster) — Deterministic workflow runtime; use with Expanso for complex multi-step automation.
- [Tools](/tools/) — Full list of agent tools available in OpenClaw.
