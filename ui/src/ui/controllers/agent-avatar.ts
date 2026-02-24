import type { GatewayBrowserClient } from "../gateway.ts";

export type AvatarUploadState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  uploading: boolean;
  error: string | null;
  previewUrl: string | null;
};

/**
 * Trigger file picker for avatar upload.
 * Returns the selected File or null if cancelled.
 */
export function triggerAvatarPicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    });
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Read a File as a data URL for preview.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload avatar image to the agent's identity.
 * Uses the agent.identity.set gateway method.
 */
export async function uploadAgentAvatar(
  state: AvatarUploadState,
  agentId: string,
  file: File,
): Promise<boolean> {
  if (!state.client || !state.connected || state.uploading) {
    return false;
  }
  state.uploading = true;
  state.error = null;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    state.previewUrl = dataUrl;
    await state.client.request("agent.identity.set", {
      agentId,
      avatar: dataUrl,
    });
    return true;
  } catch (err) {
    state.error = String(err);
    return false;
  } finally {
    state.uploading = false;
  }
}
