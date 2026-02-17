import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { gateway } from "../../services/gateway.ts";
import type { TwitterData } from "../controllers/twitter.ts";
import { renderTwitterView } from "../views/twitter.ts";

@customElement("twitter-island")
export class TwitterIsland extends LitElement {
  @state() private loading = false;
  @state() private data: TwitterData | null = null;
  @state() private activeTab: "dashboard" | "relationships" = "dashboard";

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    this.loading = true;
    try {
      const result = await gateway.call<TwitterData>("twitter.data");
      this.data = result;
    } catch (err) {
      console.error("Failed to load Twitter data:", err);
      this.data = null;
    } finally {
      this.loading = false;
    }
  }

  render() {
    const html_string = renderTwitterView(this.data, this.loading, this.activeTab);
    return html`${unsafeHTML(html_string)}`;
  }
}
