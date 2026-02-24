import { html, nothing } from "lit";

export type LoginViewCallbacks = {
  onEmailLogin: (email: string, password: string) => void;
  onEmailSignup: (email: string, password: string) => void;
  onMagicLink: (email: string) => void;
  onOAuthLogin: (provider: string) => void;
  supabaseError: string | null;
  supabaseLoading: boolean;
  oauthProviders: string[];
};

const OAUTH_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  gitlab: "GitLab",
  azure: "Azure",
};

function handleSubmit(e: Event, mode: "login" | "signup" | "magic", callbacks: LoginViewCallbacks) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const data = new FormData(form);
  const email = (data.get("email") as string)?.trim() ?? "";
  if (!email) return;

  if (mode === "magic") {
    callbacks.onMagicLink(email);
    return;
  }

  const password = (data.get("password") as string) ?? "";
  if (!password) return;

  if (mode === "signup") {
    callbacks.onEmailSignup(email, password);
  } else {
    callbacks.onEmailLogin(email, password);
  }
}

export function renderLoginView(callbacks: LoginViewCallbacks) {
  const { supabaseError, supabaseLoading, oauthProviders } = callbacks;

  return html`
    <style>
      .login-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg, #0a0a0a);
        z-index: 9999;
      }
      .login-card {
        background: var(--surface, #1a1a1a);
        border: 1px solid var(--border, #333);
        border-radius: 12px;
        padding: 32px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      .login-brand {
        text-align: center;
        margin-bottom: 24px;
      }
      .login-brand h1 {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text, #e0e0e0);
        margin: 0 0 4px;
      }
      .login-brand p {
        font-size: 0.85rem;
        color: var(--text-muted, #888);
        margin: 0;
      }
      .login-field {
        margin-bottom: 12px;
      }
      .login-field label {
        display: block;
        font-size: 0.8rem;
        color: var(--text-muted, #888);
        margin-bottom: 4px;
      }
      .login-field input {
        width: 100%;
        padding: 8px 10px;
        background: var(--input-bg, #111);
        border: 1px solid var(--border, #333);
        border-radius: 6px;
        color: var(--text, #e0e0e0);
        font-size: 0.9rem;
        box-sizing: border-box;
      }
      .login-field input:focus {
        outline: none;
        border-color: var(--accent, #5b8def);
      }
      .login-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }
      .login-actions .btn {
        flex: 1;
      }
      .login-error {
        background: var(--danger-bg, rgba(255, 50, 50, 0.1));
        color: var(--danger, #ff6b6b);
        border: 1px solid var(--danger-border, rgba(255, 50, 50, 0.3));
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 0.85rem;
        margin-bottom: 12px;
      }
      .login-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 16px 0;
        color: var(--text-muted, #888);
        font-size: 0.8rem;
      }
      .login-divider::before,
      .login-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--border, #333);
      }
      .login-oauth {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .login-oauth .btn {
        width: 100%;
        justify-content: center;
      }
      .login-magic {
        text-align: center;
        margin-top: 12px;
      }
      .login-magic button {
        background: none;
        border: none;
        color: var(--accent, #5b8def);
        font-size: 0.8rem;
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
      }
      .login-magic button:hover {
        opacity: 0.8;
      }
      .login-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid var(--border, #333);
        border-top-color: var(--accent, #5b8def);
        border-radius: 50%;
        animation: login-spin 0.6s linear infinite;
        margin-right: 6px;
        vertical-align: middle;
      }
      @keyframes login-spin {
        to { transform: rotate(360deg); }
      }
    </style>
    <div class="login-overlay">
      <div class="login-card">
        <div class="login-brand">
          <h1>OpenFinClaw</h1>
          <p>Sign in to continue</p>
        </div>

        ${supabaseError ? html`<div class="login-error">${supabaseError}</div>` : nothing}

        <form @submit=${(e: Event) => handleSubmit(e, "login", callbacks)}>
          <div class="login-field">
            <label for="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autocomplete="email"
              ?disabled=${supabaseLoading}
            />
          </div>
          <div class="login-field">
            <label for="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              ?disabled=${supabaseLoading}
            />
          </div>
          <div class="login-actions">
            <button class="btn primary" type="submit" ?disabled=${supabaseLoading}>
              ${
                supabaseLoading
                  ? html`
                      <span class="login-spinner"></span>
                    `
                  : nothing
              }
              Sign In
            </button>
            <button
              class="btn"
              type="button"
              ?disabled=${supabaseLoading}
              @click=${(e: Event) => {
                const form = (e.target as HTMLElement).closest("form");
                if (form) handleSubmit(new Event("submit"), "signup", callbacks);
              }}
            >
              Sign Up
            </button>
          </div>
        </form>

        <div class="login-magic">
          <button
            type="button"
            ?disabled=${supabaseLoading}
            @click=${() => {
              const input = document.getElementById("login-email") as HTMLInputElement | null;
              const email = input?.value?.trim();
              if (email) callbacks.onMagicLink(email);
            }}
          >
            Send Magic Link
          </button>
        </div>

        ${
          oauthProviders.length > 0
            ? html`
                <div class="login-divider">or</div>
                <div class="login-oauth">
                  ${oauthProviders.map(
                    (provider) => html`
                      <button
                        class="btn"
                        type="button"
                        ?disabled=${supabaseLoading}
                        @click=${() => callbacks.onOAuthLogin(provider)}
                      >
                        Continue with ${OAUTH_LABELS[provider] ?? provider}
                      </button>
                    `,
                  )}
                </div>
              `
            : nothing
        }
      </div>
    </div>
  `;
}
