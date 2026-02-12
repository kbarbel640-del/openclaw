---
summary: "Use Azure OpenAI models in OpenClaw"
read_when:
  - You want to use Azure OpenAI deployments in OpenClaw
  - You need to configure a custom endpoint and deployment name
title: "Azure OpenAI"
---

# Azure OpenAI

OpenClaw supports Azure OpenAI via the `azure-openai-responses` API adapter powered by the
[Azure OpenAI SDK](https://learn.microsoft.com/en-us/azure/ai-services/openai/).

## Configuration

### Environment variables

Set the following environment variables (or add them to the `env` section of your config):

| Variable                           | Required               | Description                                                                  |
| ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `AZURE_OPENAI_API_KEY`             | Yes                    | Your Azure API key                                                           |
| `AZURE_OPENAI_RESOURCE_NAME`       | Yes (or use `baseUrl`) | Your Azure resource name (the `{resource}` in `{resource}.openai.azure.com`) |
| `AZURE_OPENAI_API_VERSION`         | No                     | API version (e.g. `2025-04-01-preview`). Defaults to `v1` if unset.          |
| `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` | No                     | Comma-separated `model=deployment` pairs (e.g. `gpt-4=my-gpt4-deploy`)       |

### Config file

Add the following to your `openclaw.json` (or `config.json`):

```json5
{
  models: {
    providers: {
      azure: {
        // Base URL for your Azure OpenAI resource.
        // The adapter uses the Azure OpenAI SDK which handles
        // deployment routing and api-version parameters internally.
        baseUrl: "https://YOUR_RESOURCE_NAME.openai.azure.com/openai/v1",

        // Use the specialized Azure adapter (uses OpenAI Responses API)
        api: "azure-openai-responses",

        // Your Azure API Key
        apiKey: "YOUR_AZURE_API_KEY",

        // Define the models available on this resource.
        // The model id is used as the deployment name by default,
        // or configure AZURE_OPENAI_DEPLOYMENT_NAME_MAP for custom mapping.
        models: [
          {
            id: "gpt-4o",
            name: "gpt-4o",
          },
        ],
      },
    },
  },
  // Set the API version via env if needed
  env: {
    AZURE_OPENAI_API_VERSION: "2025-04-01-preview",
  },
}
```

### Alternative: environment-only setup

If you prefer environment variables over config file entries:

```bash
export AZURE_OPENAI_API_KEY="your-key"
export AZURE_OPENAI_RESOURCE_NAME="your-resource"
export AZURE_OPENAI_API_VERSION="2025-04-01-preview"
```

Then in your config, just reference the provider and model:

```json5
{
  models: {
    providers: {
      azure: {
        api: "azure-openai-responses",
        models: [{ id: "gpt-4o", name: "gpt-4o" }],
      },
    },
  },
}
```

## Deployment name mapping

By default, the model `id` is used as the Azure deployment name. If your deployment
names differ from model IDs, set the mapping via environment variable:

```bash
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP="gpt-4o=my-gpt4o-deployment,gpt-4=prod-gpt4"
```

## Usage

Once configured, reference your model as `azure/model-id`:

```bash
openclaw chat --model azure/gpt-4o
```
