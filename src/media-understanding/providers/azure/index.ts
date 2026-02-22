import type { MediaUnderstandingProvider } from "../../types.js";
import { transcribeAzureAudio } from "./audio.js";

export const azureProvider: MediaUnderstandingProvider = {
  id: "azure-ai",
  capabilities: ["audio"],
  transcribeAudio: transcribeAzureAudio,
};
