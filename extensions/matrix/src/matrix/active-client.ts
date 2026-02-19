import type { MatrixClient } from "@vector-im/matrix-bot-sdk";

const activeClients = new Map<string, MatrixClient>();

export function setActiveMatrixClient(accountId: string, client: MatrixClient | null): void {
  if (client) {
    activeClients.set(accountId, client);
    return;
  }

  activeClients.delete(accountId);
}

export function getActiveMatrixClient(accountId: string): MatrixClient | null {
  return activeClients.get(accountId) ?? null;
}

export function clearActiveMatrixClient(accountId: string): void {
  activeClients.delete(accountId);
}
