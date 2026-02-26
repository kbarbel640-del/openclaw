import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIELD_HELP } from "../src/config/schema.help.ts";
import { FIELD_LABELS } from "../src/config/schema.labels.ts";
import { OpenClawSchema } from "../src/config/zod-schema.ts";
import { VERSION } from "../src/version.ts";

type JsonObject = Record<string, unknown>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const docsOpenApiDir = path.join(repoRoot, "docs", "openapi");
const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";

function collectSchemaPaths(schema: unknown): string[] {
  const keys = new Set<string>();

  const walk = (node: unknown, prefix = "") => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }
    const schemaNode = node as {
      properties?: Record<string, unknown>;
      items?: unknown;
      additionalProperties?: unknown;
    };
    const properties =
      schemaNode.properties && typeof schemaNode.properties === "object"
        ? schemaNode.properties
        : null;
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        const nextPath = prefix ? `${prefix}.${key}` : key;
        keys.add(nextPath);
        walk(value, nextPath);
      }
    }
    if (
      schemaNode.items &&
      typeof schemaNode.items === "object" &&
      !Array.isArray(schemaNode.items)
    ) {
      const nextPath = prefix ? `${prefix}[]` : "[]";
      keys.add(nextPath);
      walk(schemaNode.items, nextPath);
    }
    if (
      schemaNode.additionalProperties &&
      typeof schemaNode.additionalProperties === "object" &&
      !Array.isArray(schemaNode.additionalProperties)
    ) {
      const nextPath = prefix ? `${prefix}.*` : "*";
      keys.add(nextPath);
      walk(schemaNode.additionalProperties, nextPath);
    }
  };

  walk(schema);
  return [...keys].toSorted((a, b) => a.localeCompare(b));
}

function buildConfigHttpOpenApi(params: {
  version: string;
  generatedAt: string;
  schema: unknown;
  uiHints: Record<string, unknown>;
  keys: string[];
}): JsonObject {
  const validateIssueSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string" },
      message: { type: "string" },
    },
    required: ["path", "message"],
  } as const;

  return {
    openapi: "3.0.3",
    info: {
      title: "OpenClaw Config HTTP API",
      version: params.version,
      description:
        "Full openclaw.json schema introspection and validation endpoints, including channel/plugin-aware metadata.",
      "x-generatedAt": params.generatedAt,
    },
    servers: [{ url: "http://127.0.0.1:18789" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "token",
        },
      },
      schemas: {
        ConfigSchemaEnvelope: {
          type: "object",
          additionalProperties: false,
          properties: {
            schema: params.schema,
            uiHints: {
              type: "object",
              additionalProperties: true,
            },
            version: { type: "string" },
            generatedAt: { type: "string" },
          },
          required: ["schema", "uiHints", "version", "generatedAt"],
        },
        ConfigKeysResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            keys: {
              type: "array",
              items: { type: "string" },
              example: params.keys.slice(0, 10),
            },
          },
          required: ["keys"],
        },
        ConfigValidateRequest: {
          oneOf: [
            {
              type: "object",
              description: "Raw openclaw.json config object",
              additionalProperties: true,
            },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                config: {
                  type: "object",
                  additionalProperties: true,
                },
              },
              required: ["config"],
            },
          ],
        },
        ConfigValidateResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            valid: { type: "boolean" },
            issues: { type: "array", items: validateIssueSchema },
            warnings: { type: "array", items: validateIssueSchema },
          },
          required: ["valid", "issues", "warnings"],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/v1/config/schema": {
        get: {
          operationId: "getConfigSchema",
          summary: "Get full OpenClaw config schema",
          responses: {
            200: {
              description: "Schema and metadata",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ConfigSchemaEnvelope" },
                  example: {
                    schema: params.schema,
                    uiHints: params.uiHints,
                    version: params.version,
                    generatedAt: params.generatedAt,
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/v1/config/keys": {
        get: {
          operationId: "listConfigKeys",
          summary: "List flattened config keys",
          responses: {
            200: {
              description: "Flattened config keys",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ConfigKeysResponse" },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/v1/config/validate": {
        post: {
          operationId: "validateConfig",
          summary: "Validate config object",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConfigValidateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Validation result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ConfigValidateResponse" },
                },
              },
            },
            400: { description: "Invalid request shape" },
            401: { description: "Unauthorized" },
          },
        },
      },
    },
  };
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(`wrote ${path.relative(repoRoot, filePath)}`);
}

async function main() {
  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(docsOpenApiDir, { recursive: true });

  const schema = OpenClawSchema.toJSONSchema({
    reused: "ref",
    unrepresentable: "any",
    io: "output",
    target: "draft-7",
  });
  const uiHints: Record<string, unknown> = {};
  for (const [path, label] of Object.entries(FIELD_LABELS)) {
    uiHints[path] = {
      ...(uiHints[path] as Record<string, unknown> | undefined),
      label,
    };
  }
  for (const [path, help] of Object.entries(FIELD_HELP)) {
    uiHints[path] = {
      ...(uiHints[path] as Record<string, unknown> | undefined),
      help,
    };
  }

  // Keep generated artifacts deterministic so config-spec:check can run in CI.
  const generatedAt = process.env.OPENCLAW_CONFIG_SPEC_GENERATED_AT ?? DEFAULT_GENERATED_AT;
  const keys = new Set<string>(collectSchemaPaths(schema));
  for (const key of Object.keys(uiHints)) {
    keys.add(key);
  }
  const sortedKeys = [...keys].toSorted((a, b) => a.localeCompare(b));

  const openapi = buildConfigHttpOpenApi({
    version: VERSION,
    generatedAt,
    schema,
    uiHints,
    keys: sortedKeys,
  });

  await writeJsonFile(path.join(distDir, "config.schema.json"), schema);
  await writeJsonFile(path.join(distDir, "config.uihints.json"), uiHints);
  await writeJsonFile(path.join(distDir, "config.keys.json"), { keys: sortedKeys });
  await writeJsonFile(path.join(distDir, "config-http.openapi.json"), openapi);
  await writeJsonFile(path.join(docsOpenApiDir, "config-http.openapi.json"), openapi);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
