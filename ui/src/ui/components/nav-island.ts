/**
 * Navigation Island - Interactive sidebar + topbar for Astro pages.
 *
 * Handles tab switching via full page navigation (Astro routing),
 * collapsible nav groups, connection status, and theme toggle.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { $gatewayError } from "../../services/gateway.ts";
import { gateway } from "../../services/gateway.ts";
import { $connected, $theme, $themeResolved } from "../../stores/app.ts";
import { $hello } from "../../stores/gateway.ts";
import { icons } from "../icons.ts";
import { TAB_GROUPS, iconForTab, titleForTab, pathForTab, type Tab } from "../navigation.ts";
import { loadSettings, saveSettings } from "../storage.ts";
import { resolveTheme, type ThemeMode, type ResolvedTheme } from "../theme.ts";

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

@customElement("nav-island")
export class NavIsland extends LitElement {
  @property({ type: String }) tab: string = "chat";

  // Reactive store subscriptions
  private connectedCtrl = new StoreController(this, $connected);
  private helloCtrl = new StoreController(this, $hello);
  private themeCtrl = new StoreController(this, $theme);
  private themeResolvedCtrl = new StoreController(this, $themeResolved);
  private errorCtrl = new StoreController(this, $gatewayError);

  @state() private navCollapsed = false;
  @state() private navGroupsCollapsed: Record<string, boolean> = {};

  // Light DOM - inherit page CSS
  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    const settings = loadSettings();
    this.navCollapsed = settings.navCollapsed;
    this.navGroupsCollapsed = settings.navGroupsCollapsed;

    // Apply saved theme
    const resolved = resolveTheme(settings.theme);
    $theme.set(settings.theme);
    $themeResolved.set(resolved);
    applyTheme(resolved);

    // Auto-connect to gateway
    gateway.connect();
  }

  private persistNavState() {
    const settings = loadSettings();
    saveSettings({
      ...settings,
      navCollapsed: this.navCollapsed,
      navGroupsCollapsed: this.navGroupsCollapsed,
    });
  }

  private toggleNavCollapsed() {
    this.navCollapsed = !this.navCollapsed;
    this.persistNavState();
    // Update shell class for layout
    const shell = document.getElementById("app-shell");
    if (shell) {
      shell.classList.toggle("shell--nav-collapsed", this.navCollapsed);
    }
  }

  private toggleNavGroup(label: string) {
    this.navGroupsCollapsed = {
      ...this.navGroupsCollapsed,
      [label]: !this.navGroupsCollapsed[label],
    };
    this.persistNavState();
  }

  private cycleTheme() {
    const modes: ThemeMode[] = ["system", "light", "dark"];
    const current = this.themeCtrl.value;
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    $theme.set(next);
    const resolved = resolveTheme(next);
    $themeResolved.set(resolved);
    applyTheme(resolved);
    const settings = loadSettings();
    saveSettings({ ...settings, theme: next });
  }

  private navigateToTab(tab: Tab, event: MouseEvent) {
    // Allow modifier-key clicks to open in new tab
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    const basePath =
      ((globalThis as Record<string, unknown>).__OPENCLAW_CONTROL_UI_BASE_PATH__ as string) ?? "";
    const href = pathForTab(tab, basePath);
    globalThis.location.href = href;
  }

  private renderTab(tab: Tab) {
    const basePath =
      ((globalThis as Record<string, unknown>).__OPENCLAW_CONTROL_UI_BASE_PATH__ as string) ?? "";
    const href = pathForTab(tab, basePath);
    const isActive = this.tab === tab;

    return html`
      <a
        href=${href}
        class="nav-item ${isActive ? "active" : ""}"
        aria-current=${isActive ? "page" : "false"}
        @click=${(e: MouseEvent) => this.navigateToTab(tab, e)}
        title=${titleForTab(tab)}
      >
        <span class="nav-item__icon" aria-hidden="true">${icons[iconForTab(tab)]}</span>
        <span class="nav-item__text">${titleForTab(tab)}</span>
      </a>
    `;
  }

  render() {
    const connected = this.connectedCtrl.value;
    const hello = this.helloCtrl.value;
    const lastError = this.errorCtrl.value;
    const _snapshot = hello?.snapshot as { uptimeMs?: number } | undefined;

    return html`
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="nav-collapse-toggle"
            @click=${() => this.toggleNavCollapsed()}
            title=${this.navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label=${this.navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span class="nav-collapse-toggle__icon">${icons.menu}</span>
          </button>
          <div class="brand">
            <div class="brand-logo">
              <img src="/favicon.svg" alt="OpenClaw" />
            </div>
            <div class="brand-text">
              <div class="brand-title">OPENCLAW</div>
              <div class="brand-sub">Gateway Dashboard</div>
            </div>
          </div>
        </div>
        <div class="topbar-status">
          <div class="pill">
            <span class="statusDot ${connected ? "ok" : ""}"></span>
            <span>Health</span>
            <span class="mono">${connected ? "OK" : "Offline"}</span>
          </div>
          ${
            lastError && !connected
              ? html`<div class="pill pill--danger">
                <span class="mono" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${lastError}
                </span>
              </div>`
              : nothing
          }
          <button
            class="pill pill--interactive"
            @click=${() => this.cycleTheme()}
            title="Toggle theme (${this.themeCtrl.value})"
            aria-label="Toggle theme"
          >
            <span>${this.themeResolvedCtrl.value === "dark" ? "\u263E" : "\u2600"}</span>
          </button>
        </div>
      </header>

      <aside class="nav ${this.navCollapsed ? "nav--collapsed" : ""}">
        ${TAB_GROUPS.map((group) => {
          const isGroupCollapsed = this.navGroupsCollapsed[group.label] ?? false;
          const hasActiveTab = group.tabs.some((t) => t === this.tab);

          return html`
            <div
              class="nav-group ${isGroupCollapsed && !hasActiveTab ? "nav-group--collapsed" : ""}"
            >
              <button
                class="nav-label"
                @click=${() => this.toggleNavGroup(group.label)}
                aria-expanded=${!isGroupCollapsed}
              >
                <span class="nav-label__text">${group.label}</span>
                <span class="nav-label__chevron">${isGroupCollapsed ? "+" : "\u2212"}</span>
              </button>
              <div class="nav-group__items">
                ${group.tabs.map((t) => this.renderTab(t as Tab))}
              </div>
            </div>
          `;
        })}
        <div class="nav-group nav-group--links">
          <div class="nav-label nav-label--static">
            <span class="nav-label__text">Resources</span>
          </div>
          <div class="nav-group__items">
            <a
              class="nav-item nav-item--external"
              href="https://docs.openclaw.ai"
              target="_blank"
              rel="noreferrer"
              title="Docs (opens in new tab)"
            >
              <span class="nav-item__icon" aria-hidden="true">${icons.book}</span>
              <span class="nav-item__text">Docs</span>
            </a>
          </div>
        </div>
      </aside>
    `;
  }
}
