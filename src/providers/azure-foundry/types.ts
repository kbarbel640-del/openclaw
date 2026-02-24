export type AzureFoundryEndpointStyle = "native" | "openai-compat";

export interface AzureFoundryModelConfig {
  id: string;
  endpoint: string; // https://<resource>.services.ai.azure.com
  apiKey: string;
  apiStyle: AzureFoundryEndpointStyle;
  maxTokens?: number;
}
