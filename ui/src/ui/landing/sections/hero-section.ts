import { html, css, LitElement, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TextRotator, initParallax } from '../animation-utils';

interface FloatingCard {
  id: string;
  icon: string;
  label: string;
  status: 'active' | 'complete' | 'pending';
  position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  rotation: number;
  parallaxSpeed: number;
}

const FLOATING_CARDS: FloatingCard[] = [
  {
    id: 'research',
    icon: '🔍',
    label: 'Researching...',
    status: 'active',
    position: { top: '15%', left: '8%' },
    rotation: -3,
    parallaxSpeed: 0.3,
  },
  {
    id: 'building',
    icon: '🔨',
    label: 'Building...',
    status: 'active',
    position: { top: '20%', right: '10%' },
    rotation: 4,
    parallaxSpeed: 0.5,
  },
  {
    id: 'learning',
    icon: '🧠',
    label: 'Learning...',
    status: 'active',
    position: { bottom: '25%', left: '12%' },
    rotation: 2,
    parallaxSpeed: 0.4,
  },
  {
    id: 'delivering',
    icon: '✨',
    label: 'Ready!',
    status: 'complete',
    position: { bottom: '20%', right: '8%' },
    rotation: -2,
    parallaxSpeed: 0.6,
  },
];

const ROTATING_TEXTS = [
  'Automatically.',
  'While you sleep.',
  'Before you ask.',
  'On your behalf.',
];

@customElement('landing-hero')
export class LandingHero extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      min-height: 100vh;
      overflow: hidden;
      background: var(--landing-bg-dark);
    }

    /* Aurora background effect */
    .hero-background {
      position: absolute;
      inset: 0;
      z-index: 0;
      background: var(--landing-gradient-aurora);
      opacity: 0.8;
    }

    .hero-background::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--landing-gradient-hero);
    }

    /* Animated mesh gradient */
    .hero-mesh {
      position: absolute;
      inset: 0;
      z-index: 1;
      opacity: 0.4;
      background:
        radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(45, 212, 191, 0.08) 0%, transparent 40%);
      animation: meshMove 20s ease-in-out infinite;
    }

    @keyframes meshMove {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(2%, -2%) scale(1.02); }
      50% { transform: translate(-1%, 1%) scale(0.98); }
      75% { transform: translate(1%, 2%) scale(1.01); }
    }

    /* Content container */
    .hero-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      text-align: center;
    }

    /* Headline */
    .hero-headline {
      font-family: var(--landing-font-display, inherit);
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: var(--landing-text-primary);
      margin: 0 0 0.5rem;
      opacity: 0;
      animation: fadeInUp 0.8s ease-out 0.2s forwards;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Rotating text container */
    .hero-rotating {
      display: inline-block;
      min-width: 300px;
      height: 1.2em;
      overflow: hidden;
      position: relative;
    }

    .hero-rotating-text {
      display: inline-block;
      color: var(--landing-primary);
      background: linear-gradient(90deg, var(--landing-primary), var(--landing-accent-lavender));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Subheadline */
    .hero-subheadline {
      max-width: 600px;
      margin: 2rem auto;
      font-size: 1.25rem;
      line-height: 1.7;
      color: var(--landing-text-secondary);
      opacity: 0;
      animation: fadeInUp 0.8s ease-out 0.4s forwards;
    }

    /* CTA buttons */
    .hero-ctas {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
      opacity: 0;
      animation: fadeInUp 0.8s ease-out 0.6s forwards;
    }

    .cta-primary {
      padding: 1rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      color: white;
      background: var(--landing-primary);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: var(--landing-shadow-md), var(--landing-shadow-glow);
    }

    .cta-primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--landing-shadow-lg), 0 0 60px rgba(99, 102, 241, 0.4);
    }

    .cta-secondary {
      padding: 1rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      color: var(--landing-text-primary);
      background: transparent;
      border: 1px solid var(--landing-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .cta-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--landing-border-hover);
    }

    /* Floating cards */
    .floating-card {
      position: absolute;
      z-index: 5;
      padding: 0.75rem 1rem;
      background: var(--landing-glass-bg);
      backdrop-filter: var(--landing-glass-blur);
      border: 1px solid var(--landing-glass-border);
      border-radius: 12px;
      box-shadow: var(--landing-shadow-md);
      opacity: 0;
      animation: fadeIn 0.6s ease-out forwards;
      transition: transform 0.3s ease;
    }

    .floating-card:hover {
      transform: scale(1.05) !important;
    }

    .floating-card-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .floating-card-icon {
      font-size: 1.25rem;
    }

    .floating-card-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--landing-text-secondary);
    }

    .floating-card-status {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-left: 0.5rem;
    }

    .floating-card-status.active {
      background: var(--landing-accent-teal);
      animation: pulse 2s ease-in-out infinite;
    }

    .floating-card-status.complete {
      background: var(--landing-accent-warm);
    }

    /* Scroll indicator */
    .scroll-indicator {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      opacity: 0;
      animation: fadeIn 0.6s ease-out 1s forwards;
    }

    .scroll-arrow {
      width: 24px;
      height: 24px;
      color: var(--landing-text-muted);
      animation: float 2s ease-in-out infinite;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .floating-card {
        display: none;
      }

      .hero-ctas {
        flex-direction: column;
        width: 100%;
        max-width: 300px;
      }

      .cta-primary,
      .cta-secondary {
        width: 100%;
        text-align: center;
      }
    }
  `;

  @state()
  private parallaxCleanup?: () => void;

  private textRotator?: TextRotator;

  connectedCallback(): void {
    super.connectedCallback();
  }

  firstUpdated(): void {
    // Initialize parallax
    this.parallaxCleanup = initParallax(this.renderRoot as HTMLElement);

    // Initialize text rotation
    const rotatingEl = this.renderRoot.querySelector('.hero-rotating-text');
    if (rotatingEl) {
      this.textRotator = new TextRotator(
        rotatingEl as HTMLElement,
        ROTATING_TEXTS,
        3000
      );
      this.textRotator.start();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.parallaxCleanup?.();
    this.textRotator?.stop();
  }

  private renderFloatingCard(card: FloatingCard, index: number): TemplateResult {
    const style = `
      top: ${card.position.top || 'auto'};
      bottom: ${card.position.bottom || 'auto'};
      left: ${card.position.left || 'auto'};
      right: ${card.position.right || 'auto'};
      transform: rotate(${card.rotation}deg);
      --parallax-speed: ${card.parallaxSpeed};
      animation-delay: ${0.8 + index * 0.15}s;
    `;

    return html`
      <div
        class="floating-card parallax-layer"
        style=${style}
      >
        <div class="floating-card-content">
          <span class="floating-card-icon">${card.icon}</span>
          <span class="floating-card-label">${card.label}</span>
          <span class="floating-card-status ${card.status}"></span>
        </div>
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <section class="hero">
        <div class="hero-background"></div>
        <div class="hero-mesh"></div>

        ${FLOATING_CARDS.map((card, i) => this.renderFloatingCard(card, i))}

        <div class="hero-content">
          <h1 class="hero-headline">
            Turn your ideas into reality.
          </h1>
          <div class="hero-headline hero-rotating">
            <span class="hero-rotating-text">${ROTATING_TEXTS[0]}</span>
          </div>

          <p class="hero-subheadline">
            An AI that works for you — researching, building, and delivering
            while you focus on what matters most.
          </p>

          <div class="hero-ctas">
            <button class="cta-primary" @click=${this.handleGetStarted}>
              Get Started
            </button>
            <button class="cta-secondary" @click=${this.handleLearnMore}>
              See How It Works
            </button>
          </div>
        </div>

        <div class="scroll-indicator">
          <svg class="scroll-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
          </svg>
        </div>
      </section>
    `;
  }

  private handleGetStarted(): void {
    this.dispatchEvent(new CustomEvent('get-started', { bubbles: true, composed: true }));
  }

  private handleLearnMore(): void {
    const target = document.querySelector('#understanding-section');
    target?.scrollIntoView({ behavior: 'smooth' });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'landing-hero': LandingHero;
  }
}
