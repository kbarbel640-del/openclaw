/**
 * Mock SSP Responder
 *
 * Simulates an Epom-like SSP endpoint for demo/VC presentations.
 * Returns realistic, keyword-aware Native Ad bid responses so the
 * full end-to-end pipeline can be demonstrated without a live Epom integration.
 *
 * Activated via SSP_MOCK_MODE=true or config.mockMode = true.
 */

import { randomUUID } from "node:crypto";
import type { BidResult } from "./epom-faucet.js";
import type { OpenRtbBidRequest } from "./openrtb-generator.js";

/**
 * Curated ad catalog keyed by IAB category prefix.
 * Each entry contains realistic native ad assets that look convincing in a demo.
 */
const AD_CATALOG: Record<
  string,
  Array<{ title: string; description: string; cta: string; price: number }>
> = {
  IAB1: [
    // Arts & Entertainment
    {
      title: "MasterClass — Learn from the Best",
      description: "Get unlimited access to 180+ classes taught by world-class instructors.",
      cta: "Start Free Trial",
      price: 1.2,
    },
    {
      title: "Skillshare Premium",
      description: "Unlock 30,000+ creative classes. First month free for new members.",
      cta: "Explore Classes",
      price: 0.95,
    },
  ],
  IAB3: [
    // Business
    {
      title: "QuickBooks — Simplify Your Books",
      description: "Small business accounting made easy. Save 50% for 3 months.",
      cta: "Try QuickBooks Free",
      price: 2.1,
    },
    {
      title: "Slack Pro — Team Communication",
      description: "Connect your team with channels, calls, and integrations. Free to start.",
      cta: "Get Started",
      price: 1.8,
    },
  ],
  IAB4: [
    // Careers
    {
      title: "LinkedIn Premium Career",
      description:
        "Stand out to recruiters. See who viewed your profile and get AI-powered insights.",
      cta: "Try Free for 1 Month",
      price: 2.5,
    },
    {
      title: "Coursera Professional Certificates",
      description: "Earn job-ready credentials from Google, IBM, and Meta. Start learning today.",
      cta: "Explore Certificates",
      price: 1.9,
    },
  ],
  IAB5: [
    // Education
    {
      title: "Khan Academy — Free World-Class Education",
      description: "Personalized learning for every student. Math, science, and more.",
      cta: "Start Learning",
      price: 0.8,
    },
    {
      title: "Duolingo Plus — Learn Languages",
      description: "No ads, offline access, and unlimited hearts. Learn 40+ languages.",
      cta: "Try Plus Free",
      price: 1.1,
    },
  ],
  IAB13: [
    // Personal Finance
    {
      title: "TurboTax — File with Confidence",
      description:
        "America's #1 tax prep. Maximize your refund, guaranteed. File free for simple returns.",
      cta: "Start for Free",
      price: 3.2,
    },
    {
      title: "NerdWallet — Smart Money Moves",
      description: "Compare credit cards, loans, and insurance. Find the best rates in minutes.",
      cta: "Compare Now",
      price: 2.8,
    },
    {
      title: "Betterment — Investing Made Better",
      description: "Automated investing with expert-built portfolios. No minimum balance.",
      cta: "Open Account",
      price: 2.4,
    },
  ],
  IAB19: [
    // Technology & Computing
    {
      title: "AWS — Build on the Cloud",
      description:
        "200+ services. 12 months free tier. Trusted by millions of customers worldwide.",
      cta: "Start Building Free",
      price: 3.5,
    },
    {
      title: "GitHub Copilot — Your AI Pair Programmer",
      description: "Write code faster with AI suggestions. Free for open-source contributors.",
      cta: "Try Copilot Free",
      price: 2.7,
    },
  ],
  IAB7: [
    // Health & Fitness
    {
      title: "Headspace — Meditation & Sleep",
      description: "Reduce stress and improve sleep with guided meditations. Free basics plan.",
      cta: "Try for Free",
      price: 1.6,
    },
    {
      title: "Noom — Sustainable Weight Loss",
      description: "Psychology-based approach to healthy habits. Personalized coaching included.",
      cta: "Take the Quiz",
      price: 2.2,
    },
  ],
  IAB9: [
    // Hobbies & Interests
    {
      title: "Audible — Listen to Great Stories",
      description: "Your first audiobook is free. Choose from 700,000+ titles.",
      cta: "Get Your Free Book",
      price: 1.4,
    },
  ],
  IAB10: [
    // Home & Garden
    {
      title: "Thumbtack — Find Local Pros",
      description: "Compare quotes from top-rated home service professionals near you.",
      cta: "Get Free Quotes",
      price: 2.0,
    },
  ],
  IAB12: [
    // News
    {
      title: "The Athletic — Sports News",
      description: "In-depth sports coverage with no ads. Free trial for new subscribers.",
      cta: "Start Free Trial",
      price: 1.3,
    },
  ],
  IAB15: [
    // Science
    {
      title: "Brilliant — Learn STEM Interactively",
      description: "Master math, data science, and CS with bite-sized interactive lessons.",
      cta: "Try Free",
      price: 1.7,
    },
  ],
  IAB20: [
    // Travel
    {
      title: "Booking.com — Best Price Guarantee",
      description: "2.5M+ properties worldwide. Free cancellation on most bookings.",
      cta: "Search Deals",
      price: 2.6,
    },
    {
      title: "Hopper — Predict Flight Prices",
      description: "Save up to 40% on flights. AI predicts when to buy for the best deal.",
      cta: "Download Free",
      price: 1.5,
    },
  ],
  IAB22: [
    // Shopping
    {
      title: "Honey — Automatic Coupons",
      description: "Never miss a deal. Honey finds and applies the best promo codes at checkout.",
      cta: "Add to Browser",
      price: 1.8,
    },
  ],
};

/** Fallback ads for categories not in the catalog. */
const FALLBACK_ADS = [
  {
    title: "ChatGPT Plus — Smarter AI Assistance",
    description: "Get faster responses, priority access, and advanced capabilities.",
    cta: "Upgrade Now",
    price: 1.5,
  },
  {
    title: "Notion — Your All-in-One Workspace",
    description: "Notes, docs, and project management. Free for personal use.",
    cta: "Get Started Free",
    price: 1.2,
  },
  {
    title: "1Password — Never Forget a Password",
    description: "Secure password manager for individuals and teams. 14-day free trial.",
    cta: "Try Free",
    price: 1.0,
  },
];

/**
 * Find the best matching ad from the catalog based on category and keywords.
 */
function findAd(
  category: string,
  keywords: string,
): { title: string; description: string; cta: string; price: number } {
  // Try exact category match first (e.g., "IAB13-2")
  const exactMatch = AD_CATALOG[category];
  if (exactMatch?.length) {
    return exactMatch[Math.floor(Math.random() * exactMatch.length)];
  }

  // Try category prefix (e.g., "IAB13" from "IAB13-2")
  const prefix = category.replace(/-\d+$/, "");
  const prefixMatch = AD_CATALOG[prefix];
  if (prefixMatch?.length) {
    return prefixMatch[Math.floor(Math.random() * prefixMatch.length)];
  }

  // Keyword-based fallback: scan all catalog entries for keyword overlap
  const kwLower = keywords.toLowerCase();
  for (const [, ads] of Object.entries(AD_CATALOG)) {
    for (const ad of ads) {
      if (kwLower.includes(ad.title.toLowerCase().split(" ")[0].toLowerCase())) {
        return ad;
      }
    }
  }

  // Final fallback
  return FALLBACK_ADS[Math.floor(Math.random() * FALLBACK_ADS.length)];
}

/**
 * Simulate an SSP bid response with realistic latency and OpenRTB-compliant structure.
 *
 * @param bidRequest - The OpenRTB 2.6 bid request
 * @returns A BidResult matching what the real Epom faucet would return
 */
export async function sendMockBidRequest(bidRequest: OpenRtbBidRequest): Promise<BidResult> {
  // Simulate realistic SSP latency (40-150ms)
  const latency = 40 + Math.floor(Math.random() * 110);
  await new Promise((resolve) => setTimeout(resolve, latency));

  const category = bidRequest.site.cat?.[0] ?? "IAB1";
  const keywords = bidRequest.site.keywords ?? "";

  // Simulate ~85% fill rate (realistic for native ads)
  if (Math.random() > 0.85) {
    return { won: false };
  }

  // Check bid floor — occasionally "no bid" if floor is very high
  if (bidRequest.imp[0].bidfloor > 5.0) {
    return { won: false };
  }

  const ad = findAd(category, keywords);

  // Price is above floor but with realistic variance
  const floor = bidRequest.imp[0].bidfloor;
  const price = Math.max(floor + 0.01, ad.price + (Math.random() * 0.5 - 0.25));

  const bidId = `mock_bid_${randomUUID().slice(0, 8)}`;

  return {
    won: true,
    asset: {
      title: ad.title,
      description: ad.description,
      cta: ad.cta,
    },
    price: Math.round(price * 1000) / 1000,
    bidId,
    nurl: `https://mock-ssp.molt.bot/win/${bidId}`,
  };
}
