---
name: tiktok-script
description: Generate TikTok Shop affiliate video scripts with voiceover audio. Use when Eli sends a TikTok Shop product link, product name, or asks for a script. Also handles voiceover generation via ElevenLabs. Triggers on TikTok URLs, "write a script", "script for", product pitches, or voiceover requests.
---

# TikTok Script Generator

Generate compliant, high-converting TikTok Shop affiliate scripts for a 90% male audience. UGC style: faceless, product-in-hand, or unboxing videos.

## Workflow

1. **Product link received** → Scrape product details (name, price, features, reviews) via `web_fetch`
2. **Generate 3 script variants** using the framework below, each with a different hook angle
3. **User picks one** (or requests mix/tweaks)
4. **Generate voiceover** via ElevenLabs API if requested
5. **Deliver audio** via email to eli@lvhcapital.com

## Script Framework

Every script follows: **Hook → Problem → Solution → Proof → Urgency → CTA**

| Section  | Timing | Rules                                                                                                                      |
| -------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Hook     | 0-2s   | Tie to primal desire (status, pain relief, comfort, attraction, dominance, protection, enjoyment). Never "Stop scrolling." |
| Problem  | 2-6s   | One sentence max. Make viewer nod.                                                                                         |
| Solution | 6-20s  | Show product as answer. 3 punchy benefits back-to-back. Benefits > features.                                               |
| Proof    | 20-25s | Social proof, demo proof, or authority proof. One is enough.                                                               |
| Urgency  | 25-35s | Real reasons to act now. Price-based or demand-based. No fake scarcity.                                                    |
| CTA      | 35-40s | Direct, friendly, actionable. "Link's right here" / "Hit the link"                                                         |

## Hook Angles (rotate across variants)

**TOP PERFORMERS (ranked by real @letstokshop data, 60-day window):**

1. **Genuine endorsement** (2.8M, 940K, 275K, 245K, 165K, 157K — most consistent):
   "These are actually perfect" / "Gotta get you some of these" / "Exceeded my expectations"
   "Comfortable and actually love these" / "Look good and feel even better"
   → Natural, honest, "I tried it" energy. Not aggressive. This is the #1 pattern.

2. **Identity** (770K):
   "Everyone asks what [item] I wear. It's these."
   → Works best for standout/unique items.

3. **Deal/Value** (656K, 250K):
   "Best [item] you can't get for this deal" / "Sale is going on right now"
   → Works for multi-packs and price-competitive products.

4. **Utility/Novelty** (258K):
   "These are great to have and come in handy"
   → For non-fashion products (tools, gadgets, survival gear).

**SECONDARY (lower but still viable):**

- **Curiosity**: "I didn't believe this would work until I tried it"
- **Social proof**: "There's a reason this has [X] sold"
- **Cultural moment**: "It's [item] season" (seasonal timing)

**KEY RULES from analytics:**

- 8 of top 10 posts are men's fashion — lean into this
- Endorsement hooks > aggressive selling hooks
- Mention brand names when possible (audience trusts specific brands)
- Best upload time: Sunday 12pm-1pm MST (peak viewer window)
- Viewers are 92% male — write for men exclusively

## Voice & Tone

- FaceTime vibe — natural, conversational, not "ad voice"
- Contractions always (you're, don't, can't, it's)
- Short sentences. Punchy.
- Written for voiceover: include natural pauses (…), emphasis words
- One big idea per script — don't overload

## Compliance (CRITICAL — enforced on every script)

See [references/compliance.md](references/compliance.md) for full rules. Summary:

- **NO** medical claims (cures, treats, heals, doctor-approved)
- **NO** false guarantees (guaranteed results, works 100%)
- **NO** exaggerated claims without "results may vary"
- **NO** redirecting off TikTok Shop
- **NO** targeting minors
- **ALWAYS** soften borderline claims (use "people are loving this" not "built for [condition]")
- **ALWAYS** default to the safer version — account safety > script punch
- Product must be shown or verbally mentioned (not just text overlay)

## Voiceover Generation

Three voices available (ElevenLabs, model: `eleven_v3`):

| Name     | Voice ID             | Style            |
| -------- | -------------------- | ---------------- |
| tech.ai  | UgmIiVWYO7wVE8fPd3PY | Tech/gadget vibe |
| NEW.AI   | HsWbDmVqChyN82OJhK6T | —                |
| Bunny.AI | K8bSibZzuuySMeyimm6i | —                |

Generate via ElevenLabs API:

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}" \
  -H "xi-api-key: {KEY from config talk.apiKey}" \
  -H "Content-Type: application/json" \
  -d '{"text": "{SCRIPT}", "model_id": "eleven_v3", "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}' \
  --output /tmp/tiktok-script.mp3
```

Deliver audio via: `gog gmail send --to eli@lvhcapital.com --subject "{product name} voiceover" --attach /tmp/tiktok-script.mp3`

## Output Format (iMessage delivery)

When sending scripts via iMessage, format as:

```
SCRIPT [N] — "[Hook Style]" Hook

🪝 HOOK (0-2s):
"[hook text]"

⚡ PROBLEM (2-6s):
"[problem text]"

💡 SOLUTION (6-20s):
"[solution text]"

✅ PROOF (20-25s):
"[proof text]"

⏳ URGENCY (25-35s):
"[urgency text]"

👉 CTA (35-40s):
"[cta text]"
```

After user picks a script, send clean voiceover-ready version (no labels, no emojis, just the spoken text with natural pauses).
