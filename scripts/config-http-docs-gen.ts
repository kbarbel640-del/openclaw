import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type OpenApiExample = {
  value?: unknown;
};

type OpenApiMediaType = {
  schema?: unknown;
  example?: unknown;
  examples?: Record<string, unknown>;
};

type OpenApiRequestBody = {
  required?: boolean;
  description?: string;
  content?: Record<string, OpenApiMediaType>;
};

type OpenApiResponse = {
  description?: string;
  content?: Record<string, OpenApiMediaType>;
};

type OpenApiOperation = {
  summary?: string;
  description?: string;
  operationId?: string;
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
};

type OpenApiPathItem = Partial<
  Record<"get" | "post" | "put" | "patch" | "delete", OpenApiOperation>
>;

type OpenApiDoc = {
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
    "x-generatedAt"?: string;
  };
  paths?: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const openApiPath = path.join(repoRoot, "dist", "config-http.openapi.json");
const outPath = path.join(repoRoot, "docs", "gateway", "config-http-api.md");

const methodOrder: Record<string, number> = {
  GET: 0,
  POST: 1,
  PUT: 2,
  PATCH: 3,
  DELETE: 4,
};

function buildCurlSnippet(method: string, route: string): string {
  const upper = method.toUpperCase();
  if (upper === "GET") {
    return `curl -sS http://127.0.0.1:18789${route} \\\n  -H 'Authorization: Bearer YOUR_TOKEN'`;
  }
  return `curl -sS http://127.0.0.1:18789${route} \\\n  -X ${upper} \\\n  -H 'Authorization: Bearer YOUR_TOKEN' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n    "config": {\n      "gateway": { "mode": "local" }\n    }\n  }'`;
}

function resolveRefSchema(openapi: OpenApiDoc, schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return schema;
  }
  const ref = (schema as { $ref?: unknown }).$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/components/schemas/")) {
    return schema;
  }
  const name = ref.slice("#/components/schemas/".length);
  return openapi.components?.schemas?.[name] ?? schema;
}

function sortStatusCodes(a: string, b: string): number {
  const aInt = Number.parseInt(a, 10);
  const bInt = Number.parseInt(b, 10);
  const aIsNumeric = Number.isFinite(aInt) && String(aInt) === a;
  const bIsNumeric = Number.isFinite(bInt) && String(bInt) === b;
  if (aIsNumeric && bIsNumeric) {
    return aInt - bInt;
  }
  if (aIsNumeric) {
    return -1;
  }
  if (bIsNumeric) {
    return 1;
  }
  return a.localeCompare(b);
}

function toJsonString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toJsonBlock(value: unknown): string {
  return `\`\`\`json\n${toJsonString(value)}\n\`\`\``;
}

function renderContent(openapi: OpenApiDoc, content?: Record<string, OpenApiMediaType>): string {
  if (!content || Object.keys(content).length === 0) {
    return "None.";
  }

  const sections: string[] = [];
  for (const [contentType, mediaType] of Object.entries(content).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    sections.push(`Content type: \`${contentType}\``);

    if (mediaType.schema !== undefined) {
      const resolvedSchema = resolveRefSchema(openapi, mediaType.schema);
      sections.push("");
      sections.push("Schema:");
      sections.push("");
      sections.push(toJsonBlock(resolvedSchema));
    }

    if (mediaType.example !== undefined) {
      sections.push("");
      sections.push("Example:");
      sections.push("");
      sections.push(toJsonBlock(mediaType.example));
    }

    if (mediaType.examples && Object.keys(mediaType.examples).length > 0) {
      for (const [name, example] of Object.entries(mediaType.examples).toSorted(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const value =
          example && typeof example === "object" && !Array.isArray(example) && "value" in example
            ? (example as OpenApiExample).value
            : example;
        if (value === undefined) {
          continue;
        }
        sections.push("");
        sections.push(`Example (\`${name}\`):`);
        sections.push("");
        sections.push(toJsonBlock(value));
      }
    }

    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

function buildDoc(openapi: OpenApiDoc): string {
  const title = openapi.info?.title ?? "OpenClaw Config HTTP API";
  const version = openapi.info?.version ?? "unknown";
  const specVersion = openapi.openapi ?? "3.0.0";
  const generatedAt = openapi.info?.["x-generatedAt"] ?? "unknown";

  const paths = openapi.paths ?? {};
  const endpoints: Array<{
    method: string;
    route: string;
    summary: string;
    operation: OpenApiOperation;
  }> = [];

  for (const [route, pathItem] of Object.entries(paths)) {
    const item = pathItem ?? {};
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const operation = item[method];
      if (!operation) {
        continue;
      }
      endpoints.push({
        method: method.toUpperCase(),
        route,
        summary: operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${route}`,
        operation,
      });
    }
  }

  endpoints.sort((a, b) => {
    if (a.route !== b.route) {
      return a.route.localeCompare(b.route);
    }
    return (methodOrder[a.method] ?? 99) - (methodOrder[b.method] ?? 99);
  });

  const endpointBullets = endpoints
    .map((endpoint) => `- \`${endpoint.method} ${endpoint.route}\` - ${endpoint.summary}`)
    .join("\n");

  const endpointSections = endpoints
    .map((endpoint) => {
      const operation = endpoint.operation;
      const operationDescription = operation.description ?? "_No description provided._";

      const requestBody = operation.requestBody;
      const requestDescription = requestBody?.description ?? "_No description provided._";
      const requestRequired = requestBody?.required ? "yes" : "no";
      const requestContent = renderContent(openapi, requestBody?.content);

      const responseEntries = Object.entries(operation.responses ?? {}).toSorted(([a], [b]) =>
        sortStatusCodes(a, b),
      );
      const responsesText =
        responseEntries.length === 0
          ? "None."
          : responseEntries
              .map(([status, response]) => {
                const lines = [
                  `Status: \`${status}\``,
                  `Description: ${response.description ?? "_No description provided._"}`,
                ];
                const content = renderContent(openapi, response.content);
                if (content !== "None.") {
                  lines.push("");
                  lines.push(content);
                }
                return lines.join("\n");
              })
              .join("\n\n");

      return `### \`${endpoint.method} ${endpoint.route}\`

Summary: ${endpoint.summary}
Operation ID: \`${operation.operationId ?? "unknown"}\`
Description: ${operationDescription}

**cURL**

\`\`\`bash
${buildCurlSnippet(endpoint.method, endpoint.route)}
\`\`\`

**Request body**

Required: ${requestRequired}
Description: ${requestDescription}

${requestContent}

**Responses**

${responsesText}`;
    })
    .join("\n\n");

  const components = openapi.components?.schemas ?? {};
  const componentSections = Object.entries(components)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, schema]) => {
      const resolvedSchema = resolveRefSchema(openapi, schema);
      return `### \`${name}\`

${toJsonBlock(resolvedSchema)}`;
    })
    .join("\n\n");

  const componentsBlock = componentSections || "_No component schemas defined._";

  const doc = `---
summary: "Generated full API reference from the config OpenAPI spec"
read_when:
  - You need complete endpoint request/response schema details from config spec
  - You want generated API docs that stay in sync with dist/config-http.openapi.json
title: "Config HTTP API Reference"
---

# Config HTTP API Reference

This page is generated from \`dist/config-http.openapi.json\`.

OpenAPI: \`${specVersion}\`
Title: ${title}
Version: \`${version}\`
Generated at: \`${generatedAt}\`

## Auth

- Header: \`Authorization: Bearer <gateway-token>\`

## Endpoints

${endpointBullets}

${endpointSections}

## Components

${componentsBlock}

## Mintlify Integration

This same OpenAPI artifact is wired into Mintlify via \`docs/docs.json\`:

- \`api.openapi.source\`: \`openapi/config-http.openapi.json\`
- \`api.openapi.directory\`: \`gateway/config-http-api-reference\`

## Generation

Regenerate spec + docs:

\`\`\`bash
pnpm config-spec:gen
\`\`\`
`;

  return `${doc.replace(/(?:[ \t]*\n){3,}/g, "\n\n").trimEnd()}\n`;
}

async function main() {
  const source = await fs.readFile(openApiPath, "utf8");
  const openapi = JSON.parse(source) as OpenApiDoc;
  const markdown = buildDoc(openapi);
  await fs.writeFile(outPath, markdown, "utf8");
  console.log(`wrote ${path.relative(repoRoot, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
