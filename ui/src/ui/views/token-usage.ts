import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('openclaw-token-usage-view')
export class TokenUsageView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 24px;
      color: var(--sl-color-neutral-900);
    }
    .header { margin-bottom: 24px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--sl-panel-background-color);
      border: 1px solid var(--sl-panel-border-color);
      border-radius: var(--sl-border-radius-medium);
      padding: 20px;
    }
    h2 { margin: 0 0 16px 0; font-size: 1.2rem; }
    .stats { font-size: 2rem; font-weight: bold; color: var(--sl-color-primary-600); }
    iframe {
      width: 100%;
      height: 600px;
      border: none;
      border-radius: var(--sl-border-radius-medium);
    }
  `;

  render() {
    return html`
      <div class="header">
        <h1>Token 优化仪表盘</h1>
        <p>实时监控并优化你的 Token 消耗与成本。</p>
      </div>
      <div class=\"grid\">
        <div class=\"card\">
          <h2>预估节省</h2>
          <div class=\"stats\">45%</div>
          <p>基于当前优化策略</p>
        </div>
        <div class=\"card\">
          <h2>缓存命中率</h2>
          <div class=\"stats\">90%</div>
          <p>Anthropic 提示词缓存</p>
        </div>
      </div>
      <div class=\"card\" style=\"margin-top: 24px;\">
        <h2>详细分析</h2>
        <!-- 暂时内嵌我们已经做好的可视化页面作为展示原型 -->
        <iframe src=\"http://127.0.0.1:8086/\"></iframe>
      </div>
    `;
  }
}
