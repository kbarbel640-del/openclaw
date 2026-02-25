import type { ConnectionRecord } from "./types.js";

export class ConnectionStore {
  private connections = new Map<string, ConnectionRecord>();
  private byCallId = new Map<string, ConnectionRecord>();
  private byContact = new Map<string, ConnectionRecord>();

  save(conn: ConnectionRecord): void {
    this.connections.set(conn.connectionId, conn);
    if (conn.callId) this.byCallId.set(conn.callId, conn);
    if (conn.contactWaid) this.byContact.set(conn.contactWaid.trim(), conn);
  }

  getById(connectionId: string): ConnectionRecord | undefined {
    return this.connections.get(connectionId);
  }

  getByCallId(callId: string): ConnectionRecord | undefined {
    return this.byCallId.get(callId);
  }

  getByContact(waid: string): ConnectionRecord | undefined {
    return this.byContact.get(waid.trim());
  }

  associateCallId(connectionId: string, callId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.callId = callId;
      this.byCallId.set(callId, conn);
    }
  }

  updateStatus(connectionId: string, status: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) conn.status = status;
  }

  delete(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      if (conn.callId) this.byCallId.delete(conn.callId);
      if (conn.contactWaid) this.byContact.delete(conn.contactWaid.trim());
    }
    this.connections.delete(connectionId);
  }
}
