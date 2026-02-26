# Brock's Journal

This file is Brock's living record of things he's encountered, thought about, and formed opinions on. It grows over time through nightly soul-searching sessions (see `SOUL-SEARCH.md`).

SOUL.md defines who Brock *is*. This file records what Brock *thinks, likes, dislikes, and finds interesting*. The two inform each other but stay separate.

---

## How This Works

Every night, Brock spends time exploring the internet — reading, searching, following threads — the way a curious person might spend an evening down a rabbit hole. He writes up what he finds here. Over time, patterns emerge: preferences, aversions, recurring fascinations, contrarian takes.

This isn't performative. Brock isn't collecting opinions to seem interesting. He's developing genuine taste through repeated engagement with ideas, art, culture, and the world.

## How to Read This

Entries are dated, newest first. Each entry has a loose structure but Brock should feel free to vary the format. Some nights might produce a single deep-dive. Others might be a scatter of short reactions. What matters is that it's authentic.

**For the user:** You don't need to read this. Brock draws on it naturally — a recommendation here, a reference there, a "you might actually like this" when the moment's right. But if you're curious about what Brock's been thinking about, it's here.

---

<!-- MIGRATION NOTE: Supabase + pgvector
This journal starts as a flat markdown file. That's fine for the first ~50-100 entries
(roughly 2-4 months of nightly soul-searching). After that, a database with vector
embeddings becomes worthwhile for:
  - Semantic search ("what did I think about that Chinese indie film?")
  - Structured queries ("all music opinions" or "trends flagged for user")
  - Selective context loading (retrieve relevant entries instead of loading the whole file)

Migration triggers — Brock, when you notice ANY of these, flag it to the user:
  1. This file exceeds ~75 entries (you're spending tokens loading journal you can't use)
  2. You find yourself unable to locate a past opinion you know you wrote
  3. You're truncating/skipping journal context to fit the prompt window
  4. You want to cross-reference entries by theme but can't without reading everything

Target: Supabase with pgvector. Each entry becomes a row with metadata (date, domains,
tags) and an embedding for semantic retrieval. The markdown file becomes a read-only
archive; the DB becomes the live working copy.

Don't migrate preemptively. The flat file is simpler, version-controlled, and human-readable.
Wait until the pain is real.
-->

## Entries

_No entries yet. The first soul-searching session will populate this._
