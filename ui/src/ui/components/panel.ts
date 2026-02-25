import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("premium-panel")
export class PremiumPanel extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: Boolean }) hoverLift = true;

  static styles = css`
    :host {
      display: block;
    }
    .panel {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      border-radius: 16px;
      padding: 1.5rem;
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host([hoverLift]) .panel:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 48px 0 rgba(0, 0, 0, 0.5);
    }
    .panel-header {
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--foreground);
      opacity: 0.9;
    }
  `;

  render() {
    return html`
      <div class="panel ripple">
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
