import { html } from "lit";
import type { SessionsListResult } from "../types";
import { formatAgo } from "../format";

export type UsageLifetimeResult = {
  ok: boolean;
  agentId: string;
  stats: {
    totalTokens: number;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    messageCount: number;
    sessionCount: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    byModel: Record<string, { tokens: number; cost: number; messages: number }>;
    byDate: Record<string, { tokens: number; cost: number; messages: number }>;
  };
  projections: {
    avgPerDay: { tokens: number; cost: number };
    monthlyProjection: { tokens: number; cost: number };
    last7Days: { tokens: number; cost: number; avgPerDay: number };
  };
};

export type UsageProps = {
  sessions: SessionsListResult | null;
  lifetimeStats: UsageLifetimeResult | null;
  onRefresh: () => void;
};

type UsageStats = {
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
  sessionCount: number;
  byModel: Map<string, {
    tokens: number;
    cost: number;
    messages: number;
  }>;
};

function calculateUsageStats(sessions: SessionsListResult | null): UsageStats {
  const stats: UsageStats = {
    totalTokens: 0,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    messageCount: 0,
    sessionCount: 0,
    byModel: new Map(),
  };

  if (!sessions?.sessions) return stats;

  stats.sessionCount = sessions.count;

  for (const session of sessions.sessions) {
    // Use session-level totalTokens (cumulative for entire session)
    stats.totalTokens += session.totalTokens || 0;
    
    // Get detailed breakdowns from available messages
    if (session.messages) {
      for (const msg of session.messages) {
        if (msg.role === 'assistant' && msg.usage) {
          stats.inputTokens += msg.usage.input || 0;
          stats.outputTokens += msg.usage.output || 0;
          stats.cacheReadTokens += msg.usage.cacheRead || 0;
          stats.cacheWriteTokens += msg.usage.cacheWrite || 0;
          stats.messageCount++;

          if (msg.usage.cost) {
            stats.totalCost += msg.usage.cost.total || 0;
          }

          // Track by model
          const model = msg.model || 'unknown';
          const existing = stats.byModel.get(model) || { tokens: 0, cost: 0, messages: 0 };
          existing.tokens += msg.usage.totalTokens || 0;
          existing.cost += msg.usage.cost?.total || 0;
          existing.messages++;
          stats.byModel.set(model, existing);
        }
      }
    }
  }

  return stats;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

export function renderUsage(props: UsageProps) {
  const lifetime = props.lifetimeStats;

  if (!lifetime) {
    return html`
      <div class="view-container">
        <div class="view-header">
          <div>
            <h1 class="view-title">Usage & Costs</h1>
            <p class="view-subtitle">Loading usage data...</p>
          </div>
          <button class="btn btn-secondary" @click=${props.onRefresh}>Refresh</button>
        </div>
      </div>
    `;
  }

  const stats = lifetime.stats;
  const proj = lifetime.projections;

  // Calculate days of usage
  const dayCount = stats.oldestTimestamp && stats.newestTimestamp
    ? Math.max(1, Math.ceil((stats.newestTimestamp - stats.oldestTimestamp) / (1000 * 60 * 60 * 24)))
    : 0;

  const modelRows = Object.entries(stats.byModel)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([model, data]) => {
      const shortModel = model.replace('anthropic/', '').replace('claude-', '');
      return html`
        <tr>
          <td class="mono" style="font-size: 13px;">${shortModel}</td>
          <td class="text-right">${data.messages}</td>
          <td class="text-right mono">${formatTokens(data.tokens)}</td>
          <td class="text-right mono">${formatCost(data.cost)}</td>
        </tr>
      `;
    });

  const last7DaysRows = Object.entries(stats.byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([date, data]) => html`
      <tr>
        <td class="mono" style="font-size: 13px;">${date}</td>
        <td class="text-right mono">${formatTokens(data.tokens)}</td>
        <td class="text-right mono">${formatCost(data.cost)}</td>
        <td class="text-right">${data.messages} msgs</td>
      </tr>
    `);

  return html`
    <div class="view-container">
      <div class="view-header">
        <div>
          <h1 class="view-title">Usage & Costs</h1>
          <p class="view-subtitle">
            Lifetime usage · ${stats.sessionCount} sessions · ${dayCount} days
            ${stats.oldestTimestamp ? ` · Since ${new Date(stats.oldestTimestamp).toLocaleDateString()}` : ''}
          </p>
        </div>
        <button class="btn btn-secondary" @click=${props.onRefresh}>Refresh</button>
      </div>

      <div class="card-grid">
        <!-- Total Cost (Lifetime) -->
        <div class="card">
          <div class="card-label">Total Cost (Lifetime)</div>
          <div class="card-value" style="color: var(--accent-primary);">
            ${formatCost(stats.totalCost)}
          </div>
          <div class="card-meta">${stats.messageCount} messages</div>
        </div>

        <!-- Total Tokens -->
        <div class="card">
          <div class="card-label">Total Tokens</div>
          <div class="card-value">${formatTokens(stats.totalTokens)}</div>
          <div class="card-meta">
            ${formatTokens(stats.cacheReadTokens)} cache reads
          </div>
        </div>

        <!-- Monthly Projection -->
        <div class="card">
          <div class="card-label">Monthly Projection</div>
          <div class="card-value" style="color: var(--accent-warning);">
            ${formatCost(proj.monthlyProjection.cost)}
          </div>
          <div class="card-meta">${formatTokens(proj.monthlyProjection.tokens)} tokens/mo</div>
        </div>

        <!-- Daily Average -->
        <div class="card">
          <div class="card-label">Daily Average</div>
          <div class="card-value">${formatCost(proj.avgPerDay.cost)}</div>
          <div class="card-meta">${formatTokens(proj.avgPerDay.tokens)} tokens/day</div>
        </div>
      </div>

      <!-- Breakdown -->
      <div class="panel" style="margin-top: 24px;">
        <div class="panel-header">
          <h2 class="panel-title">Token Breakdown</h2>
        </div>
        <div class="panel-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <div class="muted" style="font-size: 13px;">Input</div>
              <div class="mono" style="font-size: 18px; margin-top: 4px;">${formatTokens(stats.inputTokens)}</div>
            </div>
            <div>
              <div class="muted" style="font-size: 13px;">Output</div>
              <div class="mono" style="font-size: 18px; margin-top: 4px;">${formatTokens(stats.outputTokens)}</div>
            </div>
            <div>
              <div class="muted" style="font-size: 13px;">Cache Reads</div>
              <div class="mono" style="font-size: 18px; margin-top: 4px;">${formatTokens(stats.cacheReadTokens)}</div>
            </div>
            <div>
              <div class="muted" style="font-size: 13px;">Cache Writes</div>
              <div class="mono" style="font-size: 18px; margin-top: 4px;">${formatTokens(stats.cacheWriteTokens)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage by Model -->
      ${Object.keys(stats.byModel).length > 0 ? html`
        <div class="panel" style="margin-top: 16px;">
          <div class="panel-header">
            <h2 class="panel-title">Usage by Model</h2>
          </div>
          <div class="panel-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th class="text-right">Messages</th>
                  <th class="text-right">Tokens</th>
                  <th class="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                ${modelRows}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Last 7 Days -->
      ${last7DaysRows.length > 0 ? html`
        <div class="panel" style="margin-top: 16px;">
          <div class="panel-header">
            <h2 class="panel-title">Last 7 Days</h2>
            <div class="muted" style="font-size: 13px;">
              ${formatCost(proj.last7Days.cost)} total · ${formatCost(proj.last7Days.avgPerDay)}/day avg
            </div>
          </div>
          <div class="panel-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-right">Tokens</th>
                  <th class="text-right">Cost</th>
                  <th class="text-right">Messages</th>
                </tr>
              </thead>
              <tbody>
                ${last7DaysRows}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="panel" style="margin-top: 16px;">
        <div class="panel-body muted" style="font-size: 13px;">
          <strong>Note:</strong> Costs are estimates based on published API pricing. 
          Projections assume current usage patterns continue.
          ${proj.monthlyProjection.cost > 0 ? html`
            <br><strong>If you were paying:</strong> ~${formatCost(proj.monthlyProjection.cost)}/month at current rate.
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
