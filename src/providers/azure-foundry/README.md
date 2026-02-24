# Azure Foundry Provider

This provider integrates Azure AI Foundry / Azure AI Inference models into OpenClaw.

- Auth: Authorization: Bearer <apiKey>
- Supports native Azure AI Inference (/models)
- Supports OpenAI-compatible facade (/openai/v1)
- Env aliases accepted by OpenClaw:
  - API key: `AZURE_FOUNDRY_API_KEY`, `AZURE_OPENAI_API_KEY`, `AZURE_INFERENCE_CREDENTIAL`
  - Endpoint: `AZURE_FOUNDRY_ENDPOINT`, `AZURE_OPENAI_ENDPOINT`, `AZURE_INFERENCE_ENDPOINT`

Initial implementation targets Kimi-K2.5.
