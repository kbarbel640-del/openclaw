import { html, nothing } from "lit";
import { icons } from "../icons.ts";

/**
 * Render a collapsible accordion section for the agent detail panel.
 */
export function renderAgentSection(params: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: string) => void;
  content: unknown;
  badge?: string | number | null;
}) {
  const { id, title, subtitle, open, onToggle, content, badge } = params;

  return html`
    <div class="agent-section ${open ? "agent-section--open" : ""}">
      <button
        class="agent-section__toggle"
        type="button"
        @click=${() => onToggle(id)}
      >
        <div>
          <span>${title}</span>
          ${badge != null ? html`<span class="agent-tab-count" style="margin-left:8px">${badge}</span>` : nothing}
          ${subtitle ? html`<div style="font-weight:400;font-size:0.75rem;color:var(--muted);margin-top:2px">${subtitle}</div>` : nothing}
        </div>
        <span class="agent-section__chevron">${icons.chevronRight}</span>
      </button>
      <div class="agent-section__body">
        ${content}
      </div>
    </div>
  `;
}
