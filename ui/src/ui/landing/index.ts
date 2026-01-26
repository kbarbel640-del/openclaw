/**
 * Clawdbrain Landing Page
 *
 * Main component that composes all landing page sections together.
 * This creates a full-page scrolling experience with scroll-triggered
 * animations and parallax effects.
 */

import { html, css, LitElement, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

// Import all section components
import './sections/hero-section';
import './sections/understanding-section';
import './sections/activity-section';
import './sections/control-section';
import './sections/features-section';
import './sections/social-proof-section';
import './sections/footer-section';

@customElement('landing-page')
export class LandingPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--landing-bg-dark);
      color: var(--landing-text-primary);

      /* Landing page design tokens */
      --landing-primary: #6366f1;
      --landing-primary-light: #818cf8;
      --landing-primary-dark: #4f46e5;

      --landing-accent-warm: #f59e0b;
      --landing-accent-coral: #fb7185;
      --landing-accent-teal: #2dd4bf;
      --landing-accent-lavender: #a78bfa;

      --landing-bg-dark: #0a0a0f;
      --landing-bg-elevated: #12121a;
      --landing-bg-surface: #1a1a24;
      --landing-border: rgba(255, 255, 255, 0.08);
      --landing-border-hover: rgba(255, 255, 255, 0.15);

      --landing-text-primary: #f8fafc;
      --landing-text-secondary: #94a3b8;
      --landing-text-muted: #64748b;

      --landing-gradient-hero: linear-gradient(
        135deg,
        rgba(99, 102, 241, 0.15) 0%,
        rgba(168, 85, 247, 0.08) 50%,
        rgba(45, 212, 191, 0.05) 100%
      );

      --landing-gradient-aurora: radial-gradient(
        ellipse 80% 50% at 50% -20%,
        rgba(99, 102, 241, 0.3) 0%,
        transparent 70%
      );

      --landing-gradient-card: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.05) 0%,
        rgba(255, 255, 255, 0.02) 100%
      );

      --landing-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
      --landing-shadow-md: 0 4px 20px rgba(0, 0, 0, 0.4);
      --landing-shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.5);
      --landing-shadow-glow: 0 0 40px rgba(99, 102, 241, 0.3);

      --landing-glass-bg: rgba(255, 255, 255, 0.03);
      --landing-glass-border: rgba(255, 255, 255, 0.08);
      --landing-glass-blur: blur(20px);

      --landing-font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --landing-font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Light mode support */
    :host([data-theme="light"]) {
      --landing-bg-dark: #fafafa;
      --landing-bg-elevated: #ffffff;
      --landing-bg-surface: #f8fafc;
      --landing-border: rgba(0, 0, 0, 0.06);
      --landing-border-hover: rgba(0, 0, 0, 0.12);
      --landing-text-primary: #0f172a;
      --landing-text-secondary: #475569;
      --landing-text-muted: #64748b;
      --landing-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
      --landing-shadow-md: 0 4px 20px rgba(0, 0, 0, 0.1);
      --landing-shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.15);

      --landing-gradient-aurora: radial-gradient(
        ellipse 80% 50% at 50% -20%,
        rgba(99, 102, 241, 0.1) 0%,
        transparent 70%
      );
    }

    .landing-wrapper {
      display: flex;
      flex-direction: column;
    }

    /* Smooth scroll behavior */
    .landing-wrapper {
      scroll-behavior: smooth;
    }
  `;

  render(): TemplateResult {
    return html`
      <div class="landing-wrapper">
        <landing-hero
          @get-started=${this.handleGetStarted}
        ></landing-hero>

        <landing-understanding></landing-understanding>

        <landing-activity></landing-activity>

        <landing-control></landing-control>

        <landing-features></landing-features>

        <landing-social-proof
          @get-started=${this.handleGetStarted}
          @book-demo=${this.handleBookDemo}
        ></landing-social-proof>

        <landing-footer></landing-footer>
      </div>
    `;
  }

  private handleGetStarted(): void {
    // Navigate to signup or onboarding
    console.log('Get Started clicked');
    // window.location.href = '/signup';
  }

  private handleBookDemo(): void {
    // Open demo booking modal or navigate
    console.log('Book Demo clicked');
    // window.location.href = '/demo';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'landing-page': LandingPage;
  }
}

// Export all components for potential individual use
export { LandingPage };
export { LandingHero } from './sections/hero-section';
export { LandingUnderstanding } from './sections/understanding-section';
export { LandingActivity } from './sections/activity-section';
export { LandingControl } from './sections/control-section';
export { LandingFeatures } from './sections/features-section';
export { LandingSocialProof } from './sections/social-proof-section';
export { LandingFooter } from './sections/footer-section';
