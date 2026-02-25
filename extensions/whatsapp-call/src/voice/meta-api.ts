const GRAPH_API_VERSION = "v22.0";

export type PermissionOutcome = {
  canStartCall: boolean;
  canRequestPermission: boolean;
};

export class MetaClient {
  private graphBaseUrl: string;

  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    graphBaseUrl?: string,
  ) {
    this.graphBaseUrl = graphBaseUrl || "https://graph.facebook.com";
  }

  get configured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  async checkPermissions(waid: string): Promise<PermissionOutcome> {
    const url = `${this.graphBaseUrl}/${GRAPH_API_VERSION}/${this.phoneNumberId}/call_permissions?user_wa_id=${waid}&access_token=${this.accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`meta call_permissions: ${res.status} ${body}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const entries = ((data.data ?? []) as Array<Record<string, unknown>>)[0];
    const actions = (entries?.actions ?? []) as Array<Record<string, unknown>>;

    const out: PermissionOutcome = { canStartCall: false, canRequestPermission: false };
    for (const a of actions) {
      if (a.action_name === "start_call") out.canStartCall = Boolean(a.can_perform_action);
      if (a.action_name === "send_call_permission_request")
        out.canRequestPermission = Boolean(a.can_perform_action);
    }
    return out;
  }

  async makeOutboundCall(waid: string, sdp: string): Promise<string> {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: waid,
      action: "connect",
    };
    if (sdp) {
      payload.session = { sdp_type: "offer", sdp };
    }
    return this.callsEndpoint(payload);
  }

  async terminateCall(callId: string): Promise<void> {
    await this.callsEndpoint({
      messaging_product: "whatsapp",
      call_id: callId,
      action: "terminate",
    });
  }

  private async callsEndpoint(payload: Record<string, unknown>): Promise<string> {
    const url = `${this.graphBaseUrl}/${GRAPH_API_VERSION}/${this.phoneNumberId}/calls?access_token=${this.accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`meta calls API: ${res.status} ${body}`);

    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      return String(data.call_id ?? "");
    } catch {
      return "";
    }
  }
}
