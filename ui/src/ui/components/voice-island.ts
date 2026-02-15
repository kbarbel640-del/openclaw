import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { renderVoice, type VoiceProps } from "../views/voice.ts";

type VoiceStatusResult = {
  ttsEnabled: boolean;
  ttsProvider: string | null;
  ttsProviders: string[];
  wakeWord: string | null;
  talkMode: string | null;
};

@customElement("voice-island")
export class VoiceIsland extends LitElement {
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private ttsEnabled = false;
  @state() private ttsProvider: string | null = null;
  @state() private ttsProviders: string[] = [];
  @state() private wakeWord: string | null = null;
  @state() private talkMode: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = null;
    try {
      const result = await gateway.call<VoiceStatusResult>("voice.status");
      this.ttsEnabled = result.ttsEnabled;
      this.ttsProvider = result.ttsProvider;
      this.ttsProviders = result.ttsProviders ?? [];
      this.wakeWord = result.wakeWord;
      this.talkMode = result.talkMode;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async handleTtsToggle() {
    try {
      await gateway.call("voice.toggleTts");
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleTtsProviderChange(provider: string) {
    try {
      await gateway.call("voice.setTtsProvider", { provider });
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleWakeWordChange(word: string) {
    try {
      await gateway.call("voice.setWakeWord", { word });
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleTalkModeToggle() {
    try {
      await gateway.call("voice.toggleTalkMode");
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleRefresh() {
    await this.loadData();
  }

  render() {
    const props: VoiceProps = {
      loading: this.loading,
      error: this.error,
      ttsEnabled: this.ttsEnabled,
      ttsProvider: this.ttsProvider,
      ttsProviders: this.ttsProviders,
      wakeWord: this.wakeWord,
      talkMode: this.talkMode,
      onRefresh: () => void this.handleRefresh(),
      onTtsToggle: () => void this.handleTtsToggle(),
      onTtsProviderChange: (p) => void this.handleTtsProviderChange(p),
      onWakeWordChange: (w) => void this.handleWakeWordChange(w),
      onTalkModeToggle: () => void this.handleTalkModeToggle(),
    };

    return html`${renderVoice(props)}`;
  }
}
