import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("premium-panel")
export class PremiumPanel extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: Boolean, reflect: true }) hoverLift = true;
  @property({ type: String, reflect: true }) variant: "default" | "glass" | "hero" = "default";

  static styles = css`
    :host {
      display: block;
    }
    .panel {
      background: var(--panel-bg, rgba(255, 255, 255, 0.03));
      backdrop-filter: var(--panel-blur, blur(24px));
      -webkit-backdrop-filter: var(--panel-blur, blur(24px));
      border: 1px solid var(--panel-border, rgba(255, 255, 255, 0.08));
      box-shadow: var(--panel-shadow, 0 8px 32px 0 rgba(0, 0, 0, 0.37));
      border-radius: var(--panel-radius, 20px);
      padding: 1.5rem;
      transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .panel--hero {
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.9) 0%, rgba(88, 28, 135, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 0;
    }

    .panel--glass {
      background: rgba(255, 255, 255, 0.01);
      border-color: rgba(255, 255, 255, 0.05);
      box-shadow: none;
    }

    :host([hoverLift]) .panel:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.5);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .panel-header {
      margin-bottom: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .panel-title {
      font-size: 0.9rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--foreground);
      opacity: 0.8;
    }

    .panel-content {
      position: relative;
      z-index: 1;
    }

    .panel::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    }
  `;

  render() {
    return html`
      <div class="panel panel--${this.variant} ripple">
        ${this.title ? html`
          <div class="panel-header">
            <span class="panel-title">${this.title}</span>
            <slot name="header-action"></slot>
          </div>
        ` : ""}
        <div class="panel-content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}
