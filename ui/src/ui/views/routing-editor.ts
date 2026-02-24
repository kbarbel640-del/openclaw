import { html, nothing } from "lit";

export type AgentBinding = {
  agentId: string;
  comment?: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: { kind: string; id: string };
    guildId?: string;
    teamId?: string;
    roles?: string[];
  };
};

export type RoutingEditorProps = {
  bindings: AgentBinding[];
  agents: string[];
  disabled?: boolean;
  onPatch: (bindings: AgentBinding[]) => void;
};

const icons = {
  plus: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="width: 16px; height: 16px;"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `,
  trash: html`
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="width: 16px; height: 16px;"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  `,
};

export function renderRoutingEditor(props: RoutingEditorProps) {
  const { bindings, agents, disabled = false, onPatch } = props;

  const handleAddBinding = () => {
    const newBinding: AgentBinding = {
      agentId: agents[0] ?? "default",
      match: {
        channel: "",
      },
    };
    onPatch([...bindings, newBinding]);
  };

  const handleRemoveBinding = (index: number) => {
    onPatch(bindings.filter((_, i) => i !== index));
  };

  const handleUpdateBinding = (index: number, updated: AgentBinding) => {
    onPatch(bindings.map((binding, i) => (i === index ? updated : binding)));
  };

  return html`
    <div class="routing-editor">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div>
          <div class="label">Routing Rules</div>
          <div class="muted" style="font-size: 0.875rem; margin-top: 4px;">
            Configure which agents handle specific channels, accounts, or contexts.
          </div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${disabled}
          @click=${handleAddBinding}
          title="Add routing rule"
        >
          ${icons.plus}
          <span style="margin-left: 4px;">Add Rule</span>
        </button>
      </div>

      ${
        bindings.length === 0
          ? html`
              <div class="muted" style="padding: 16px; text-align: center;">
                No routing rules configured. Add a rule to get started.
              </div>
            `
          : html`
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${bindings.map((binding, index) =>
                  renderBindingRow({
                    binding,
                    index,
                    agents,
                    disabled,
                    onUpdate: (updated) => handleUpdateBinding(index, updated),
                    onRemove: () => handleRemoveBinding(index),
                  }),
                )}
              </div>
            `
      }
    </div>
  `;
}

type BindingRowProps = {
  binding: AgentBinding;
  index: number;
  agents: string[];
  disabled: boolean;
  onUpdate: (binding: AgentBinding) => void;
  onRemove: () => void;
};

function renderBindingRow(props: BindingRowProps) {
  const { binding, index, agents, disabled, onUpdate, onRemove } = props;

  const updateField = <K extends keyof AgentBinding>(field: K, value: AgentBinding[K]) => {
    onUpdate({ ...binding, [field]: value });
  };

  const updateMatchField = <K extends keyof AgentBinding["match"]>(
    field: K,
    value: AgentBinding["match"][K],
  ) => {
    onUpdate({
      ...binding,
      match: { ...binding.match, [field]: value },
    });
  };

  return html`
    <div
      class="routing-binding-row"
      style="padding: 12px; background: var(--bg-subtle); border-radius: 4px; display: flex; flex-direction: column; gap: 12px;"
    >
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div class="label" style="font-weight: 500;">Rule #${index + 1}</div>
        <button
          class="btn btn--sm btn--danger"
          ?disabled=${disabled}
          @click=${onRemove}
          title="Remove rule"
          style="padding: 4px 8px;"
        >
          ${icons.trash}
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-field">
          <label class="label" style="font-size: 0.875rem; margin-bottom: 4px; display: block;">
            Agent ID
          </label>
          <select
            class="input"
            ?disabled=${disabled}
            .value=${binding.agentId}
            @change=${(e: Event) => {
              const target = e.target as HTMLSelectElement;
              updateField("agentId", target.value);
            }}
          >
            ${agents.map(
              (agentId) => html`
                <option value=${agentId} ?selected=${agentId === binding.agentId}>
                  ${agentId}
                </option>
              `,
            )}
          </select>
        </div>

        <div class="form-field">
          <label class="label" style="font-size: 0.875rem; margin-bottom: 4px; display: block;">
            Channel
          </label>
          <input
            class="input"
            type="text"
            placeholder="telegram, discord, slack, etc."
            ?disabled=${disabled}
            .value=${binding.match.channel || ""}
            @input=${(e: Event) => {
              const target = e.target as HTMLInputElement;
              updateMatchField("channel", target.value);
            }}
          />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-field">
          <label class="label" style="font-size: 0.875rem; margin-bottom: 4px; display: block;">
            Account ID (optional)
          </label>
          <input
            class="input"
            type="text"
            placeholder="Account identifier"
            ?disabled=${disabled}
            .value=${binding.match.accountId || ""}
            @input=${(e: Event) => {
              const target = e.target as HTMLInputElement;
              updateMatchField("accountId", target.value || undefined);
            }}
          />
        </div>

        <div class="form-field">
          <label class="label" style="font-size: 0.875rem; margin-bottom: 4px; display: block;">
            Guild ID (optional)
          </label>
          <input
            class="input"
            type="text"
            placeholder="Discord guild/server ID"
            ?disabled=${disabled}
            .value=${binding.match.guildId || ""}
            @input=${(e: Event) => {
              const target = e.target as HTMLInputElement;
              updateMatchField("guildId", target.value || undefined);
            }}
          />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-field">
          <label class="label" style="font-size: 0.875rem; margin-bottom: 4px; display: block;">
            Team ID (optional)
          </label>
          <input
            class="input"
            type="text"
            placeholder="Slack team ID"
            ?disabled=${disabled}
            .value=${binding.match.teamId || ""}
            @input=${(e: Event) => {
              const target = e.target as HTMLInputElement;
              updateMatchField("teamId", target.value || undefined);
            }}
          />
        </div>

        <div class="form-field">
          <label class="label" style="font-size: 0.875rem; margin-bottom: 4px; display: block;">
            Comment (optional)
          </label>
          <input
            class="input"
            type="text"
            placeholder="Description of this rule"
            ?disabled=${disabled}
            .value=${binding.comment || ""}
            @input=${(e: Event) => {
              const target = e.target as HTMLInputElement;
              updateField("comment", target.value || undefined);
            }}
          />
        </div>
      </div>

      ${
        binding.match.peer
          ? html`
              <div class="form-field">
                <label
                  class="label"
                  style="font-size: 0.875rem; margin-bottom: 4px; display: block;"
                >
                  Peer
                </label>
                <div class="muted" style="font-size: 0.875rem;">
                  ${binding.match.peer.kind}: ${binding.match.peer.id}
                </div>
              </div>
            `
          : nothing
      }

      ${
        binding.match.roles && binding.match.roles.length > 0
          ? html`
              <div class="form-field">
                <label
                  class="label"
                  style="font-size: 0.875rem; margin-bottom: 4px; display: block;"
                >
                  Roles
                </label>
                <div class="muted" style="font-size: 0.875rem;">
                  ${binding.match.roles.join(", ")}
                </div>
              </div>
            `
          : nothing
      }
    </div>
  `;
}
