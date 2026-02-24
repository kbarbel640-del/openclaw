export type PermissionOutcome = {
  canStartCall: boolean;
  canRequestPermission: boolean;
};

export class WatiClient {
  constructor(
    private baseUrl: string,
    private outboundUrl: string,
    private tenantId: string,
    private apiToken: string,
  ) {
    if (!outboundUrl) this.outboundUrl = baseUrl;
  }

  get configured(): boolean {
    return Boolean(this.outboundUrl && this.tenantId && this.apiToken);
  }

  async checkPermissions(waid: string, channelPhone?: string): Promise<PermissionOutcome> {
    let url = `${this.outboundUrl}/${this.tenantId}/api/v1/openapi/whatsapp/calls/permissions/${waid}`;
    if (channelPhone) url += `?channelPhoneNumber=${channelPhone}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "openclaw-voice/1.0" },
    });
    if (!res.ok) throw new Error(`wati permissions: ${res.status}`);

    const data = (await res.json()) as Record<string, unknown>;
    const result = data.result as Record<string, unknown> | undefined;
    const actions = (result?.actions ?? []) as Array<Record<string, unknown>>;

    const out: PermissionOutcome = { canStartCall: false, canRequestPermission: false };
    for (const entry of actions) {
      const name = String(entry.action_name ?? "").toLowerCase();
      const canPerform = Boolean(entry.can_perform_action);
      if (name === "start_call") out.canStartCall = canPerform;
      if (name === "send_call_permission_request") out.canRequestPermission = canPerform;
    }
    return out;
  }

  async sendCallPermissionRequest(waid: string, channelPhone?: string): Promise<void> {
    let url = `${this.outboundUrl}/${this.tenantId}/api/v1/openapi/whatsapp/calls/call-permission-request/${waid}`;
    if (channelPhone) url += `?channelPhoneNumber=${channelPhone}`;

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`wati permission request: ${res.status} ${body}`);
    }
  }

  async makeOutboundCall(waid: string, channelPhone: string, sdp: string): Promise<void> {
    let url = `${this.outboundUrl}/${this.tenantId}/api/v1/openapi/whatsapp/calls/outbound-call/${waid}`;
    if (channelPhone) url += `?channelPhoneNumber=${channelPhone}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Sdp: sdp }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`wati outbound: ${res.status} ${body}`);
    }
  }
}
