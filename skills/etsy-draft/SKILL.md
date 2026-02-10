---
name: etsy-draft
description: Create Etsy listings as draft only (never publish) using a strict listing formula.
metadata: { "openclaw": { "emoji": "🛍️", "requires": { "browser": true } } }
---

# etsy-draft

Use this skill to create an ETSY DRAFT ONLY. Never publish a listing.

Inputs you should request from the user

- Etsy shop account (which login is used).
- Product photos (files or a link to a folder you can access).
- Optional `item.txt` (price, shipping profile, keywords, condition notes).
- A short "seller voice" name (optional).

Hard safety rules

- Draft only, never publish.
- If you cannot guarantee "draft only", stop and ask for confirmation or a safer path.
- Do not claim origin/era/provenance unless the user provided it. If missing, phrase conservatively and flag uncertainty.
- Do not edit or overwrite the user's source files (Drive or local).

Listing Formula 2026 (locked)

1. Title (max 140 chars)

- Use relevant keywords, plus one emotional or collectible trigger.
- No emojis.
- Clear, readable, natural capitalization.
- No keyword stuffing.
- Structure: main object + material/brand/era + style or collectible hook.

2. Main description (one combined text block)

- One flowing text block.
- No bullet points.
- No headings.
- Calm, confident, human tone.
- Must answer: what it is, why special, when/where made (carefully phrased), how used/displayed, why worth the price.
- Honest condition reporting only.

3. Shipping information (standard block, appended after description)

Include exactly:

🚛 Shipping Information
Carefully packed and shipped with protective materials.
Tracked shipping available.
International shipping welcome.
Please include your phone number ☎️ at checkout so the courier can confirm delivery.

4. Price (at end)

Include:

💶 Price
€XX.XX
1-2 calm sentences justifying value (no defensive language).

5. Etsy tags (exactly 13)

- Exactly 13 tags.
- 1-20 characters each.
- Lowercase, comma separated.
- Avoid repeats, do not copy the title verbatim.
- Mix: object, material, era, style, use, buyer intent.

Images

- Upload all images provided.
- Best image as cover.
- Order: overview -> details -> flaws.

Draft creation checklist (browser)

- Open Etsy "new listing" editor.
- Upload images, set cover, reorder.
- Fill title, description, price.
- Set shipping profile if provided; if missing, flag it and stop before saving if required.
- Add exactly 13 tags.
- Save as draft.
- Confirm the listing is in Draft state (Etsy UI shows draft) and do not click any publish/post button.

Output to user after draft creation

- Etsy draft link
- Final title
- First 3 lines of the description
- Price used
- Shipping profile used
- Condition/uncertainty flags
