/**
 * Command Palette - Quick navigation via Cmd+K / Ctrl+K
 *
 * A modal command palette for navigating to different dashboard tabs.
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 * Supports keyboard navigation and fuzzy search.
 */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icons } from "../icons.ts";
import { TAB_GROUPS, iconForTab, titleForTab, pathForTab, type Tab } from "../navigation.ts";

interface Command {
  tab: Tab;
  title: string;
  group: string;
}

@customElement("command-palette")
export class CommandPalette extends LitElement {
  @state() private isOpen = false;
  @state() private searchQuery = "";
  @state() private selectedIndex = 0;
  @state() private filteredCommands: Command[] = [];

  private allCommands: Command[] = [];
  private inputElement: HTMLInputElement | null = null;
  private resultsContainer: HTMLElement | null = null;
  private boundHandleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);

  // Light DOM - inherit page CSS
  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeCommands();
    this.addEventListener("keydown", this.handleKeyDown.bind(this));
    globalThis.addEventListener("keydown", this.boundHandleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    globalThis.removeEventListener("keydown", this.boundHandleGlobalKeyDown);
  }

  private initializeCommands(): void {
    this.allCommands = [];
    TAB_GROUPS.forEach((group) => {
      group.tabs.forEach((tab) => {
        this.allCommands.push({
          tab: tab as Tab,
          title: titleForTab(tab as Tab),
          group: group.label,
        });
      });
    });
    this.filteredCommands = [...this.allCommands];
  }

  private handleGlobalKeyDown(event: KeyboardEvent): void {
    // Cmd+K on Mac or Ctrl+K on Windows/Linux
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault();
      this.togglePalette();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        this.closePalette();
        break;
      case "ArrowDown":
        event.preventDefault();
        this.selectNext();
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectPrevious();
        break;
      case "Enter":
        event.preventDefault();
        this.selectCommand(this.selectedIndex);
        break;
    }
  }

  private togglePalette(): void {
    if (this.isOpen) {
      this.closePalette();
    } else {
      this.openPalette();
    }
  }

  private openPalette(): void {
    this.isOpen = true;
    this.searchQuery = "";
    this.selectedIndex = 0;
    this.filteredCommands = [...this.allCommands];
    this.requestUpdate();

    // Focus input after render
    setTimeout(() => {
      const input = this.querySelector(".command-palette__input") as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  }

  private closePalette(): void {
    this.isOpen = false;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }

  private filterCommands(query: string): void {
    this.searchQuery = query;

    if (query.trim() === "") {
      this.filteredCommands = [...this.allCommands];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredCommands = this.allCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(lowerQuery) ||
          cmd.group.toLowerCase().includes(lowerQuery),
      );
    }

    // Reset selection to first result
    this.selectedIndex = 0;
  }

  private selectNext(): void {
    if (this.filteredCommands.length === 0) {
      return;
    }
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
    this.scrollToSelected();
  }

  private selectPrevious(): void {
    if (this.filteredCommands.length === 0) {
      return;
    }
    this.selectedIndex =
      (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
    this.scrollToSelected();
  }

  private scrollToSelected(): void {
    setTimeout(() => {
      const items = this.querySelectorAll(".command-palette__item");
      if (items[this.selectedIndex]) {
        items[this.selectedIndex].scrollIntoView({ block: "nearest" });
      }
    }, 0);
  }

  private selectCommand(index: number): void {
    if (index < 0 || index >= this.filteredCommands.length) {
      return;
    }

    const command = this.filteredCommands[index];
    const basePath =
      ((globalThis as Record<string, unknown>).__OPENCLAW_CONTROL_UI_BASE_PATH__ as string) ?? "";
    const href = pathForTab(command.tab, basePath);

    this.closePalette();
    globalThis.location.href = href;
  }

  private handleCommandClick(index: number): void {
    this.selectedIndex = index;
    this.selectCommand(index);
  }

  private handleOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePalette();
    }
  }

  private highlightMatch(text: string, query: string): string {
    if (!query) {
      return text;
    }

    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }

  private renderCommandItem(command: Command, index: number) {
    const isSelected = index === this.selectedIndex;
    const icon = icons[iconForTab(command.tab)];

    return html`
      <button
        class="command-palette__item ${isSelected ? "command-palette__item--selected" : ""}"
        @click=${() => this.handleCommandClick(index)}
        @mouseenter=${() => (this.selectedIndex = index)}
        role="option"
        aria-selected=${isSelected}
      >
        <span class="command-palette__item-icon" aria-hidden="true">${icon}</span>
        <span class="command-palette__item-content">
          <span class="command-palette__item-title">${command.title}</span>
          <span class="command-palette__item-group">${command.group}</span>
        </span>
        <span class="command-palette__item-shortcut" aria-hidden="true">⏎</span>
      </button>
    `;
  }

  render() {
    if (!this.isOpen) {
      return nothing;
    }

    return html`
      <style>
        .command-palette {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 20vh 24px;
          z-index: 500;
        }

        .command-palette__dialog {
          width: min(520px, 100%);
          background: var(--glass-bg, rgba(22, 24, 31, 0.72));
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
          border-radius: var(--radius-lg, 14px);
          box-shadow:
            0 25px 50px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 60vh;
          animation: command-palette-scale 0.2s var(--ease-out);
        }

        @keyframes command-palette-scale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-40px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .command-palette__header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .command-palette__input-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          color: var(--text-dim, #a1a1aa);
        }

        .command-palette__input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-strong, #fafafa);
          font-size: 15px;
          font-family: var(--font-body, "Inter", sans-serif);
          outline: none;
          caret-color: var(--accent, #6366f1);
        }

        .command-palette__input::placeholder {
          color: var(--text-dim, #a1a1aa);
        }

        .command-palette__results {
          flex: 1;
          overflow-y: auto;
          min-height: 200px;
          max-height: 400px;
        }

        .command-palette__results::-webkit-scrollbar {
          width: 8px;
        }

        .command-palette__results::-webkit-scrollbar-track {
          background: transparent;
        }

        .command-palette__results::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .command-palette__results::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .command-palette__item {
          width: 100%;
          padding: 12px 16px;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition:
            background-color var(--duration-fast, 150ms) var(--ease-in-out);
          color: var(--text, #e4e4e7);
          font-size: 14px;
          font-family: var(--font-body, "Inter", sans-serif);
        }

        .command-palette__item:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .command-palette__item--selected {
          background-color: rgba(99, 102, 241, 0.15);
          color: var(--accent, #6366f1);
        }

        .command-palette__item--selected mark {
          background: transparent;
          color: var(--accent-hover, #818cf8);
          font-weight: 600;
        }

        .command-palette__item-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
        }

        .command-palette__item-icon svg {
          width: 100%;
          height: 100%;
          stroke: currentColor;
          stroke-width: 2;
          fill: none;
        }

        .command-palette__item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .command-palette__item-title {
          font-weight: 500;
          color: inherit;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .command-palette__item-group {
          font-size: 12px;
          color: var(--text-dim, #a1a1aa);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .command-palette__item-shortcut {
          font-size: 12px;
          color: var(--text-dim, #a1a1aa);
          opacity: 0;
          transition: opacity var(--duration-fast, 150ms) var(--ease-in-out);
        }

        .command-palette__item:hover .command-palette__item-shortcut,
        .command-palette__item--selected .command-palette__item-shortcut {
          opacity: 1;
        }

        .command-palette__empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-dim, #a1a1aa);
          font-size: 14px;
        }

        .command-palette__footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          font-size: 12px;
          color: var(--text-dim, #a1a1aa);
        }

        .command-palette__hint {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .command-palette__hint-key {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--mono, "JetBrains Mono", monospace);
          color: var(--text, #e4e4e7);
        }

        /* Mark styling for search highlights */
        mark {
          background: transparent;
          color: var(--accent, #6366f1);
          font-weight: 600;
        }
      </style>

      <div class="command-palette" @click=${this.handleOverlayClick.bind(this)}>
        <div class="command-palette__dialog">
          <div class="command-palette__header">
            <span class="command-palette__input-icon" aria-hidden="true">${icons.search}</span>
            <input
              type="text"
              class="command-palette__input"
              placeholder="Type to search commands..."
              .value=${this.searchQuery}
              @input=${(e: Event) => this.filterCommands((e.target as HTMLInputElement).value)}
              aria-label="Search commands"
              aria-autocomplete="list"
              aria-controls="command-palette-results"
              role="combobox"
              aria-expanded="true"
            />
          </div>

          <div class="command-palette__results" id="command-palette-results" role="listbox">
            ${
              this.filteredCommands.length > 0
                ? this.filteredCommands.map((cmd, index) => this.renderCommandItem(cmd, index))
                : html`
                    <div class="command-palette__empty">No commands found. Try a different search.</div>
                  `
            }
          </div>

          <div class="command-palette__footer">
            <span class="command-palette__hint">
              <span class="command-palette__hint-key">↑↓</span>
              <span>Navigate</span>
            </span>
            <span class="command-palette__hint">
              <span class="command-palette__hint-key">Enter</span>
              <span>Select</span>
            </span>
            <span class="command-palette__hint">
              <span class="command-palette__hint-key">Esc</span>
              <span>Close</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "command-palette": CommandPalette;
  }
}
