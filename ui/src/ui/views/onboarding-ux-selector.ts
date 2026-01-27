/**
 * Onboarding UX Selector Dialog
 *
 * Presented when onboarding starts, allowing users to choose between:
 * - New UX: Simplified step-by-step wizard with cards
 * - Legacy UX: Original multi-pane wizard with all options
 *
 * Default to New UX.
 */

import { html, nothing, type TemplateResult } from "lit";

import { icon } from "../icons";

// ============================================================================
// Types
// ============================================================================

export type OnboardingUxMode = "new" | "legacy";

export type UxSelectorState = {
  open: boolean;
  selectedMode: OnboardingUxMode | null;
  showLegacyInfo: boolean;
};

export type UxSelectorProps = {
  state: UxSelectorState;
  onSelect: (mode: OnboardingUxMode) => void;
  onClose: () => void;
};

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render the UX selector dialog
 */
export function renderUxSelector(params: UxSelectorProps): TemplateResult | typeof nothing {
  const { state, onSelect, onClose } = params;

  if (!state.open) return nothing;

  return html`
    <div class="ux-selector-backdrop" @click=${onClose}></div>
    <div class="ux-selector">
      <div class="ux-selector__header">
        <div class="ux-selector__title-row">
          <div class="ux-selector__icon">${icon("sparkles", { size: 28 })}</div>
          <div>
            <h2 class="ux-selector__title">Choose your setup experience</h2>
            <p class="ux-selector__subtitle">We've redesigned the setup wizard to be faster and simpler</p>
          </div>
        </div>
      </div>

      <div class="ux-selector__body">
        <div class="ux-selector__options">
          <!-- New UX Option (Default) -->
          <button
            type="button"
            class="ux-selector__option ux-selector__option--selected"
            @click=${() => onSelect("new")}
          >
            <div class="ux-selector__option-header">
              <div class="ux-selector__option-icon">${icon("zap", { size: 24 })}</div>
              <div class="ux-selector__option-content">
                <div class="ux-selector__option-title">New Setup Experience ⭐</div>
                <div class="ux-selector__option-desc">Recommended • 60 seconds</div>
              </div>
              <div class="ux-selector__option-badge">Default</div>
            </div>
            <div class="ux-selector__option-details">
              <ul class="ux-selector__option-features">
                <li>${icon("check", { size: 14 })} Just 3 questions to start</li>
                <li>${icon("check", { size: 14 })} Card-based channel setup</li>
                <li>${icon("check", { size: 14 })} Skip anything optional</li>
              </ul>
            </div>
          </button>

          <!-- Legacy UX Option -->
          <button
            type="button"
            class="ux-selector__option"
            @click=${() => onSelect("legacy")}
          >
            <div class="ux-selector__option-header">
              <div class="ux-selector__option-icon ux-selector__option-icon--legacy">
                ${icon("settings", { size: 24 })}
              </div>
              <div class="ux-selector__option-content">
                <div class="ux-selector__option-title">Classic Setup</div>
                <div class="ux-selector__option-desc">Advanced • Full control</div>
              </div>
            </div>
            <div class="ux-selector__option-details">
              <ul class="ux-selector__option-features">
                <li>${icon("list", { size: 14 })} All configuration options</li>
                <li>${icon("list", { size: 14 })} Multi-pane wizard interface</li>
                <li>${icon("list", { size: 14 })} Section-by-section navigation</li>
              </ul>
            </div>
          </button>
        </div>

        ${state.showLegacyInfo
          ? html`
              <div class="ux-selector__legacy-info">
                <div class="ux-selector__legacy-header">
                  ${icon("info", { size: 16 })} Why choose Classic?
                </div>
                <p class="us-selector__legacy-text">
                  Choose Classic if you want access to every configuration option upfront,
                  or if you're familiar with the previous onboarding flow.
                </p>
                <button
                  type="button"
                  class="btn btn--sm ux-selector__legacy-close"
                  @click=${() => {
                    state.showLegacyInfo = false;
                  }}
                >
                  Got it
                </button>
              </div>
            `
          : html`
              <button
                type="button"
                class="ux-selector__legacy-toggle"
                @click=${() => {
                  state.showLegacyInfo = true;
                }}
              >
                Why would I choose Classic?
              </button>
            `}
      </div>

      <div class="ux-selector__footer">
        <button type="button" class="btn btn--sm" @click=${onClose}>
          Cancel
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// State Management Helpers
// ============================================================================

/**
 * Create initial UX selector state
 */
export function createUxSelectorState(): UxSelectorState {
  return {
    open: false,
    selectedMode: null,
    showLegacyInfo: false,
  };
}

/**
 * Open UX selector
 */
export function openUxSelector(state: UxSelectorState): UxSelectorState {
  return {
    ...state,
    open: true,
    selectedMode: "new", // Default
    showLegacyInfo: false,
  };
}

/**
 * Close UX selector
 */
export function closeUxSelector(state: UxSelectorState): UxSelectorState {
  return {
    ...state,
    open: false,
  };
}

/**
 * Select UX mode
 */
export function selectUxMode(state: UxSelectorState, mode: OnboardingUxMode): UxSelectorState {
  return {
    ...state,
    selectedMode: mode,
    open: false,
  };
}
