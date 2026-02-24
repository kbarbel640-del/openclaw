import type { ICEServer } from "./types.js";

const CACHE_MARGIN = 0.8;

export class TwilioTurnProvider {
  private cached: ICEServer[] = [];
  private expiry = 0;

  constructor(
    private accountSid: string,
    private authToken: string,
  ) {}

  get configured(): boolean {
    return Boolean(this.accountSid && this.authToken);
  }

  async getICEServers(): Promise<ICEServer[]> {
    if (this.cached.length > 0 && Date.now() < this.expiry) {
      return this.cached;
    }
    return this.refresh();
  }

  private async refresh(): Promise<ICEServer[]> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Tokens.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`twilio TURN: ${res.status} ${body}`);

    const data = JSON.parse(body) as {
      ice_servers?: Array<{
        url?: string;
        urls?: string;
        username?: string;
        credential?: string;
      }>;
      ttl?: string;
    };

    const servers: ICEServer[] = [];
    for (const is of data.ice_servers ?? []) {
      const entry: ICEServer = { urls: [is.urls ?? is.url ?? ""] };
      if (is.username) {
        entry.username = is.username;
        entry.credential = is.credential;
      }
      servers.push(entry);
    }

    const ttl = parseInt(data.ttl ?? "86400", 10);
    this.cached = servers;
    this.expiry = Date.now() + ttl * CACHE_MARGIN * 1000;

    return servers;
  }
}
