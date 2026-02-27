#!/usr/bin/env python3
"""
Layout engine for Klabo Times.
Generates front/back HTML using a fixed newspaper grid.
"""

import argparse
import html
import json
import random
import re
from datetime import date
from pathlib import Path

BIG_NUMBERS = [
    "3X",
    "2X",
    "99%",
    "1B",
    "24H",
    "500K",
    "5TH",
    "12X",
    "7M",
    "1.6X",
    "50%",
    "3.7M",
]

WOULD_YOU_RATHER = [
    "Would you rather explore the ocean or outer space?",
    "Would you rather build a treehouse or a robot?",
    "Would you rather ride a unicorn or have a pet dragon?",
    "Would you rather fly like a bird or swim like a dolphin?",
    "Would you rather visit the Moon or Mars?",
    "Would you rather be super fast or super strong?",
    "Would you rather invent a new game or star in a movie?",
    "Would you rather paint a giant mural or build a giant Lego tower?",
]

JOKES = [
    "Why did the kid bring a ladder to the library? Because the books were on the top shelf.",
    "What do you call a bear with no teeth? A gummy bear.",
    "Why did the bicycle fall over? It was two-tired.",
    "What do you call cheese that isn’t yours? Nacho cheese.",
    "Why don’t eggs tell jokes? They’d crack each other up.",
    "What do you call a sleeping dinosaur? A dino-snore.",
    "Why did the math book look sad? It had too many problems.",
    "How do you make a tissue dance? Put a little boogie in it.",
]

TRIVIA = [
    "Honey never spoils. Archaeologists have found edible honey in ancient tombs.",
    "Octopuses have three hearts and blue blood.",
    "A group of flamingos is called a flamboyance.",
    "Bananas are berries, but strawberries are not.",
    "The tallest tree in the world is over 350 feet tall.",
    "Butterflies taste with their feet.",
    "Some turtles can breathe through their butts.",
    "A bolt of lightning is hotter than the surface of the sun.",
]

PUZZLE_BONUS = [
    "Bonus: Draw a tiny rocket next to the word.",
    "Bonus: Write a silly sentence with the scramble word.",
    "Bonus: Count five round things in the house.",
    "Bonus: Find something that starts with the same letter.",
    "Bonus: Draw your favorite planet.",
    "Bonus: Make up a secret space code.",
]

FOCUS_PROMPTS = [
    "One thing you're excited about:",
    "One kind thing you can do:",
    "One thing to remember:",
    "One thing to learn:",
    "One thing to laugh about:",
    "One thing to try:",
    "One thing to help with:",
    "One thing to share:",
]

GAME_CHECKS = [
    "Kind thing done",
    "Outside play time",
    "Read together",
    "Helped at home",
    "Tried something new",
    "Said thank you",
    "Cleaned up toys",
    "Shared a smile",
]


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def clean_text(value):
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def escape_text(value):
    return html.escape(clean_text(value))


def truncate_text(value, max_len):
    text = clean_text(value)
    if len(text) <= max_len:
        return text
    if max_len <= 3:
        return text[:max_len]
    return f"{text[: max_len - 3].rstrip()}..."


def split_summary(summary):
    text = clean_text(summary)
    if not text:
        return "", ""
    parts = [part.strip() for part in text.split(". ") if part.strip()]
    if len(parts) <= 1:
        deck = text if text.endswith(".") else f"{text}."
        return deck, deck
    deck = parts[0]
    if not deck.endswith("."):
        deck = f"{deck}."
    body = ". ".join(parts[1:])
    if not body.endswith("."):
        body = f"{body}."
    return deck, body


def render_fill_line(value, line_class="write-line"):
    text = clean_text(value)
    if not text:
        return ""
    parts = re.split(r"_+", text)
    if len(parts) == 1:
        return escape_text(text)
    rendered = [escape_text(parts[0])]
    for part in parts[1:]:
        rendered.append(f"<span class='{line_class}'></span>")
        rendered.append(escape_text(part))
    return "".join(rendered)


def pick_one(items, index):
    if not items:
        return {}
    return items[index % len(items)]


def pick_many(items, index, count):
    if not items:
        return []
    return [items[(index + i) % len(items)] for i in range(count)]


def ensure_max(label, value, max_len):
    value = clean_text(value)
    if len(value) > max_len:
        raise ValueError(f"{label} too long ({len(value)} > {max_len} chars)")
    return value


def ensure_list(label, items, max_count, max_item_len):
    if len(items) > max_count:
        raise ValueError(f"{label} has too many items ({len(items)} > {max_count})")
    for item in items:
        ensure_max(f"{label} item", item, max_item_len)
    return items


def ensure_briefs(label, briefs, max_count, max_title_len, max_body_len):
    if len(briefs) > max_count:
        raise ValueError(f"{label} has too many items ({len(briefs)} > {max_count})")
    for item in briefs:
        ensure_max(f"{label} title", item.get("title", ""), max_title_len)
        ensure_max(f"{label} body", item.get("body", ""), max_body_len)
    return briefs


def format_number(value):
    text = clean_text(value)
    if not text:
        return "N/A"
    try:
        num = float(text.replace(",", ""))
    except ValueError:
        return text
    if num.is_integer():
        return f"{int(num):,}"
    return f"{num:,.2f}"


def format_price(value):
    text = clean_text(value)
    if not text or text.upper() == "N/A":
        return "N/A"
    try:
        num = float(text.replace(",", ""))
    except ValueError:
        return text
    return f"${num:,.0f}"


def days_until(month, day, today=None):
    today = today or date.today()
    target = date(today.year, month, day)
    if target < today:
        target = date(today.year + 1, month, day)
    return (target - today).days


def scramble_word(word, seed):
    tokens = [t for t in clean_text(word).upper().split() if t.isalpha()]
    candidate = ""
    for token in tokens:
        if 4 <= len(token) <= 10:
            candidate = token
            break
    if not candidate and tokens:
        candidate = tokens[0][:10]
    if not candidate:
        candidate = "STAR"

    letters = [c for c in candidate if c.isalpha()]
    if len(letters) < 4:
        letters = list("STAR")
    rng = random.Random(seed)
    scrambled = letters[:]
    for _ in range(10):
        rng.shuffle(scrambled)
        if scrambled != letters:
            break
    return "".join(scrambled)


def generate_math(day_index):
    a1 = (day_index % 5) + 1
    b1 = ((day_index * 2) % 5) + 1
    a2 = ((day_index + 3) % 5) + 1
    b2 = ((day_index * 3) % 5) + 1
    c1 = (day_index % 8) + 2
    d1 = ((day_index * 2) % 8) + 2
    c2 = ((day_index + 4) % 8) + 2
    d2 = ((day_index * 3) % 8) + 2
    return [
        f"{a1} + {b1}",
        f"{a2} + {b2}",
        f"{c1} x {d1}",
        f"{c2} x {d2}",
    ]


def build_context(data, library):
    edition = int(data.get("edition", 1))
    day_index = max(0, edition - 1)
    front_layouts = ["a", "b", "c"]
    back_layouts = ["a", "b", "c"]
    theme_variants = ["classic", "bold", "lined"]
    hero_styles = ["stripe", "dots", "plain"]
    style_sets = ["classic", "tabloid"]

    layout_front = front_layouts[day_index % len(front_layouts)]
    layout_back = back_layouts[(day_index + 1) % len(back_layouts)]
    theme_variant = theme_variants[(day_index // 2) % len(theme_variants)]
    hero_style = hero_styles[(day_index + 2) % len(hero_styles)]
    requested_style = clean_text(data.get("style", "")) or style_sets[day_index % len(style_sets)]
    if requested_style not in style_sets:
        requested_style = "classic"

    remarkable = pick_one(library.get("remarkable_women", []), day_index)
    space_fact = pick_one(library.get("space_facts", []), day_index)
    recipe = pick_one(library.get("recipes", []), day_index)
    wellness = pick_one(library.get("wellness", []), day_index)
    riddle = pick_one(library.get("riddles", []), day_index)
    challenge = pick_one(library.get("challenges", []), day_index)
    prompt_front = pick_one(library.get("poppy_prompts", []), day_index)
    prompt_back = pick_one(library.get("poppy_prompts", []), day_index + 3)

    calendar_items = pick_many(library.get("calendar_items", []), day_index, 4)
    local_events = pick_many(library.get("local_events", []), day_index, 2)
    combined_calendar = calendar_items + local_events

    briefs_front = pick_many(library.get("briefs", []), day_index, 5)
    briefs_back = pick_many(library.get("briefs", []), day_index + 7, 5)
    focus_prompts = pick_many(FOCUS_PROMPTS, day_index, 3)
    game_checks = pick_many(GAME_CHECKS, day_index, 4)

    hero_days = days_until(2, 19)
    big_number = BIG_NUMBERS[day_index % len(BIG_NUMBERS)]
    scramble = scramble_word(space_fact.get("title", "Space"), day_index)

    math_problems = generate_math(day_index)

    weather = data.get("weather", {})
    bitcoin = data.get("bitcoin", {})

    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    mission_letter = letters[day_index % len(letters)]
    number_of_day = (day_index % 20) + 1

    base_summary = clean_text(remarkable.get("summary", ""))
    if not base_summary:
        base_summary = "A life of curiosity, persistence, and courage worth revisiting."

    lead_dek, lead_body = split_summary(base_summary)
    if not lead_dek:
        lead_dek = "A life of curiosity, persistence, and courage worth revisiting."
    if not lead_body:
        lead_body = lead_dek

    if len(lead_body) < 420:
        lead_body = (
            f"{lead_body} Her story is a reminder that small choices can build a lasting legacy. "
            "Today we celebrate the moments that shaped her path, the mentors who helped, and the grit she carried. "
            "When the odds looked long, she kept showing up, practicing, and believing in the work. "
            "Friends described her as steady and curious, always learning and always helping. "
            "She turned everyday routines into training and made time for the people who mattered most."
        )

    lead_body = f"{lead_body} Ask: What would you ask her?"

    lead_headline = clean_text(remarkable.get("name", "")) or "Family Spotlight"
    lead_kicker = "Local Legend"
    lead_byline = "By The Klabo Desk"
    lead_fact = "Curiosity and courage can change the world."
    lead_jump = "Continued on Page 2"
    lead_years = clean_text(remarkable.get("years", ""))
    quick_facts = [
        ("Years", clean_text(remarkable.get("years", ""))),
        ("Known for", truncate_text(lead_dek, 42)),
        ("Legacy", truncate_text(lead_fact, 42)),
    ]
    lead_caption = (
        f"Portrait of {lead_headline}." if lead_headline != "Family Spotlight" else "Portrait of today's spotlight."
    )
    recipe_meta = clean_text(recipe.get("meta", "")) or "Prep 10 min | Cook 15 min | Serves 4"

    skybox_front_items = [
        ("Countdown", truncate_text(f"{hero_days} days to Beau's Birthday", 32)),
        ("Recipe", truncate_text(recipe.get("title", ""), 28)),
        ("Calendar", truncate_text(combined_calendar[0] if combined_calendar else "", 32)),
        ("Bitcoin", format_price(bitcoin.get("price", "N/A"))),
    ]

    skybox_back_items = [
        ("Wellness", truncate_text(wellness.get("title", ""), 24)),
        ("Status", "Node: Syncing"),
        ("Games", "Family Challenge"),
        ("Creative", "Art prompt"),
    ]

    beau_title = clean_text(space_fact.get("title", ""))
    beau_body = clean_text(space_fact.get("body", ""))
    beau_question = f"Kid Question: What would you bring to {beau_title}?" if beau_title else "Kid Question: What would you pack for space?"
    weather_summary = truncate_text(weather.get("summary", "Partly cloudy"), 20)
    if not weather_summary or "check weather" in weather_summary.lower():
        weather_summary = "Partly cloudy"
    weather_humidity = clean_text(weather.get("humidity", ""))
    if not weather_humidity or weather_humidity == "--":
        weather_humidity = "45%"
    weather_wind = clean_text(weather.get("wind", ""))
    if not weather_wind or weather_wind == "--":
        weather_wind = "8 mph"

    ctx = {
        "layout_front": layout_front,
        "layout_back": layout_back,
        "theme_variant": theme_variant,
        "hero_style": hero_style,
        "style_set": requested_style,
        "date_line": clean_text(data.get("date", "")),
        "location": clean_text(data.get("location", "")),
        "edition": str(edition).zfill(3),
        "date_short": date.today().strftime("%b %-d"),
        "weather_summary": weather_summary,
        "weather_humidity": weather_humidity,
        "weather_wind": weather_wind,
        "bitcoin_price": format_price(bitcoin.get("price", "N/A")),
        "bitcoin_height": format_number(bitcoin.get("height", "N/A")),
        "bitcoin_sats": format_number(bitcoin.get("sats", "N/A")),
        "hero_days": hero_days,
        "lead_kicker": lead_kicker,
        "lead_headline": lead_headline,
        "lead_sub": clean_text(remarkable.get("years", "")),
        "lead_years": lead_years,
        "lead_dek": lead_dek,
        "lead_body": lead_body,
        "lead_byline": lead_byline,
        "lead_fact": lead_fact,
        "lead_caption": lead_caption,
        "lead_jump": lead_jump,
        "quick_facts": quick_facts,
        "poppy_name": clean_text(remarkable.get("name", "")),
        "poppy_years": clean_text(remarkable.get("years", "")),
        "poppy_summary": base_summary,
        "poppy_prompt": clean_text(prompt_front),
        "beau_title": beau_title,
        "beau_body": beau_body,
        "beau_big": big_number,
        "beau_question": beau_question,
        "skybox_front_items": skybox_front_items,
        "skybox_back_items": skybox_back_items,
        "calendar_items": combined_calendar,
        "focus_prompts": focus_prompts,
        "briefs_front": briefs_front,
        "lead_related": [
            (
                clean_text(item.get("title", "")),
                truncate_text(item.get("body", ""), 80),
            )
            for item in briefs_front[:2]
        ],
        "briefs_back": briefs_back,
        "scramble": scramble,
        "scramble_hint": "Space word",
        "puzzle_bonus": PUZZLE_BONUS[day_index % len(PUZZLE_BONUS)],
        "math_problems": math_problems,
        "math_bonus": f"Bonus: {number_of_day} + 10 =",
        "recipe": recipe,
        "recipe_meta": recipe_meta,
        "wellness": wellness,
        "riddle": riddle,
        "challenge": clean_text(challenge),
        "game_mission": f"Find 3 things that start with {mission_letter}.",
        "game_checks": game_checks,
        "would_you_rather": pick_one(WOULD_YOU_RATHER, day_index) or "",
        "joke": JOKES[day_index % len(JOKES)],
        "trivia": TRIVIA[day_index % len(TRIVIA)],
        "bitcoin_fact": "1 Bitcoin = 100,000,000 sats.",
        "honklab": data.get(
            "honklab",
            [
                "Bitcoin Node: Syncing",
                "Machines Online: 6/6",
                "Skills Synced: OK",
                "Printer: Ready",
            ],
        ),
        "drawing_prompt": clean_text(prompt_back),
    }

    validate_contracts(ctx)
    return ctx


def validate_contracts(ctx):
    ensure_max("layout front", ctx["layout_front"], 1)
    ensure_max("layout back", ctx["layout_back"], 1)
    ensure_max("theme variant", ctx["theme_variant"], 10)
    ensure_max("hero style", ctx["hero_style"], 10)
    ensure_max("style set", ctx["style_set"], 10)
    ensure_max("date", ctx["date_line"], 28)
    ensure_max("location", ctx["location"], 30)
    ensure_max("weather summary", ctx["weather_summary"], 20)
    ensure_max("weather humidity", ctx["weather_humidity"], 8)
    ensure_max("weather wind", ctx["weather_wind"], 12)

    ensure_max("lead kicker", ctx["lead_kicker"], 20)
    ensure_max("lead headline", ctx["lead_headline"], 36)
    ensure_max("lead sub", ctx["lead_sub"], 18)
    ensure_max("lead dek", ctx["lead_dek"], 160)
    ensure_max("lead body", ctx["lead_body"], 600)
    ensure_max("lead byline", ctx["lead_byline"], 40)
    ensure_max("lead fact", ctx["lead_fact"], 120)
    ensure_max("lead caption", ctx["lead_caption"], 80)
    ensure_max("lead jump", ctx["lead_jump"], 40)
    for label, value in ctx["quick_facts"]:
        ensure_max("quick fact label", label, 12)
        ensure_max("quick fact value", value, 80)
    for label, value in ctx["skybox_front_items"]:
        ensure_max("skybox label", label, 12)
        ensure_max("skybox value", value, 60)
    for label, value in ctx["skybox_back_items"]:
        ensure_max("skybox label", label, 12)
        ensure_max("skybox value", value, 60)

    ensure_max("poppy name", ctx["poppy_name"], 24)
    ensure_max("poppy years", ctx["poppy_years"], 15)
    ensure_max("poppy summary", ctx["poppy_summary"], 240)
    ensure_max("poppy prompt", ctx["poppy_prompt"], 90)

    ensure_max("beau title", ctx["beau_title"], 24)
    ensure_max("beau body", ctx["beau_body"], 170)
    ensure_max("beau question", ctx["beau_question"], 90)

    ensure_list("calendar items", ctx["calendar_items"], 6, 60)
    ensure_list("focus prompts", ctx["focus_prompts"], 3, 60)
    ensure_briefs("front briefs", ctx["briefs_front"], 5, 20, 90)
    ensure_briefs("back briefs", ctx["briefs_back"], 5, 20, 90)

    ensure_max("scramble", ctx["scramble"], 10)
    ensure_max("scramble hint", ctx["scramble_hint"], 30)
    ensure_max("puzzle bonus", ctx["puzzle_bonus"], 90)

    for item in ctx["math_problems"]:
        ensure_max("math problem", item, 10)
    ensure_max("math bonus", ctx["math_bonus"], 40)

    recipe = ctx["recipe"]
    ensure_max("recipe title", recipe.get("title", ""), 30)
    ensure_list("recipe ingredients", recipe.get("ingredients", []), 7, 24)
    ensure_list("recipe steps", recipe.get("steps", []), 5, 60)
    ensure_max("recipe tip", recipe.get("tip", ""), 90)

    wellness = ctx["wellness"]
    ensure_max("wellness title", wellness.get("title", ""), 30)
    ensure_max("wellness body", wellness.get("body", ""), 160)
    ensure_max("wellness quote", wellness.get("quote", ""), 120)
    ensure_max("wellness author", wellness.get("author", ""), 40)

    riddle = ctx["riddle"]
    ensure_max("riddle question", riddle.get("question", ""), 90)
    ensure_max("riddle answer", riddle.get("answer", ""), 20)
    ensure_max("challenge", ctx["challenge"], 90)
    ensure_max("game mission", ctx["game_mission"], 90)
    ensure_list("game checks", ctx["game_checks"], 4, 24)
    ensure_max("would you rather", ctx["would_you_rather"], 120)
    ensure_max("joke", ctx["joke"], 140)
    ensure_max("trivia", ctx["trivia"], 140)

    ensure_list("honklab status", ctx["honklab"], 6, 40)
    ensure_max("drawing prompt", ctx["drawing_prompt"], 90)


def render_front_page(css, ctx):
    calendar_list = "".join([f"<li>{escape_text(item)}</li>" for item in ctx["calendar_items"]])
    focus_list = "".join([f"<li>{escape_text(item)} <span class='focus-line'></span></li>" for item in ctx["focus_prompts"]])
    math_cells = "".join(
        [
            "<div class='math-cell'>"
            f"{escape_text(item)} = <span class='write-line write-line--short write-line--medium'></span>"
            "</div>"
            for item in ctx["math_problems"]
        ]
    )
    brief_items = "".join(
        [
            f"<div class='brief'><span class='brief-title'>{escape_text(item.get('title', ''))}</span>"
            f"<span class='brief-body'>{escape_text(item.get('body', ''))}</span></div>"
            for item in ctx["briefs_front"]
        ]
    )
    skybox_items = "".join(
        [
            "<div class='skybox-item skybox-item--"
            + re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
            + "'>"
            f"<div class='skybox-label'>{escape_text(label)}</div>"
            f"<div class='skybox-value'>{escape_text(value)}</div>"
            "</div>"
            for label, value in ctx["skybox_front_items"]
            if value
        ]
    )

    lead_body = ctx["lead_body"]
    dateline = ctx["location"].upper() if ctx["location"] else ""
    paragraphs = []
    if lead_body:
        sentences = re.split(r"(?<=[.!?])\s+", lead_body)
        first_sentences = " ".join(sentences[:2]).strip()
        rest_sentences = " ".join(sentences[2:]).strip()
        paragraphs = [first_sentences] if first_sentences else []
        if rest_sentences:
            paragraphs.append(rest_sentences)

    lead_body_html = ""
    if lead_body:
        first_para = paragraphs[0] if paragraphs else lead_body
        first_initial = first_para[:1]
        first_rest = first_para[1:].lstrip()
        lead_body_html = (
            f"<p><span class='dateline'>{escape_text(dateline)}</span> -- "
            f"<span class='drop-cap'>{escape_text(first_initial)}</span>{escape_text(first_rest)}</p>"
        )
        if len(paragraphs) > 1:
            lead_body_html += f"<p>{escape_text(paragraphs[1])}</p>"
    lead_sub_html = f"<div class='lead-sub'>{escape_text(ctx['lead_sub'])}</div>" if ctx["lead_sub"] else ""
    lead_dek_html = f"<div class='lead-dek'>{escape_text(ctx['lead_dek'])}</div>" if ctx["lead_dek"] else ""
    lead_card_html = (
        "<div class='lead-card'>"
        "<div class='lead-card-label'>Years</div>"
        f"<div class='lead-card-value'>{escape_text(ctx.get('lead_years', '—') or '—')}</div>"
        "<div class='lead-card-label'>Known for</div>"
        f"<div class='lead-card-text'>{escape_text(truncate_text(ctx.get('lead_dek', ''), 70))}</div>"
        "</div>"
    )
    lead_related = "".join(
        [
            f"<li><strong>{escape_text(title)}</strong> {escape_text(body)}</li>"
            for title, body in ctx.get("lead_related", [])
            if title and body
        ]
    )

    return f"""<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <title>Klabo Times Front</title>
  <style>
{css}
  </style>
</head>
<body>
  <div class='page page--front layout-{escape_text(ctx["layout_front"])} theme-{escape_text(ctx["theme_variant"])} style-{escape_text(ctx["style_set"])}'>
    <header class='masthead'>
      <div class='masthead-top'>
        <div class='ear ear--left'>
          <div class='ear-label'>Weather</div>
          <div class='ear-value'>{escape_text(ctx['weather_summary'])}</div>
          <div class='ear-sub'>Hum {escape_text(ctx['weather_humidity'])} Wind {escape_text(ctx['weather_wind'])}</div>
        </div>
        <div class='masthead-center'>
          <h1 class='paper-name'>The Klabo Times</h1>
          <div class='tagline'>All the News That's Fit to Honk</div>
        </div>
        <div class='ear ear--right'>
          <div class='ear-label'>Edition</div>
          <div class='ear-value'>#{escape_text(ctx['edition'])}</div>
          <div class='ear-sub'>{escape_text(ctx['date_short'])}</div>
        </div>
      </div>
      <div class='date-line'>
        <span>{escape_text(ctx['location'])}</span>
        <span>{escape_text(ctx['date_line'])}</span>
        <span>Family Edition</span>
      </div>
    </header>

    <section class='skybox'>
      {skybox_items}
    </section>

    <section class='lead-story'>
      <div class='lead-main'>
        <div class='lead-kicker'>{escape_text(ctx['lead_kicker'])}</div>
        <div class='lead-hed'>{escape_text(ctx['lead_headline'])}</div>
        {lead_sub_html}
        {lead_dek_html}
        <div class='lead-byline'>{escape_text(ctx['lead_byline'])}</div>
        <div class='lead-body'>
          {lead_body_html}
        </div>
        <div class='lead-related'>
          <div class='lead-related-label'>Also in Brief</div>
          <ul>
            {lead_related}
          </ul>
        </div>
        <div class='lead-pull'>"{escape_text(ctx['lead_fact'])}"</div>
      </div>
      <aside class='lead-rail'>
        {lead_card_html}
        <div class='quick-facts'>
          {''.join([f"<div class='quick-fact'><strong>{escape_text(label)}</strong><span>{escape_text(value)}</span></div>" for label, value in ctx['quick_facts'] if value])}
        </div>
        <div class='fact-box'>
          <div class='fact-label'>Why it matters</div>
          <div class='fact-text'>{escape_text(ctx['lead_fact'])}</div>
        </div>
        <div class='lead-jump'>{escape_text(ctx['lead_jump'])}</div>
      </aside>
    </section>

    <section class='briefs strip strip--bottom-only briefs--sidebar'>
      <div class='section-header section-header--column'>Daily Briefs</div>
      <div class='briefs-grid'>
        {brief_items}
      </div>
    </section>

    <div class='mid-row'>
      <section class='calendar col'>
        <div class='section-header section-header--section'>Family Calendar</div>
        <ul class='calendar-list list-dash'>
          {calendar_list}
        </ul>
        <div class='calendar-focus'>
          <div class='focus-label'>Today's Focus</div>
          <ul class='focus-list'>
            {focus_list}
          </ul>
        </div>
      </section>

      <section class='beau col'>
        <div class='section-header section-header--section'>Beau's Space Report</div>
        <div class='big-number'>{escape_text(ctx['beau_big'])}</div>
        <div class='beau-title'>{escape_text(ctx['beau_title'])}</div>
        <div class='beau-body'>{escape_text(ctx['beau_body'])}</div>
        <div class='beau-question'>{escape_text(ctx['beau_question'])}</div>
      </section>

      <section class='activity col'>
        <div class='section-header section-header--section'>Poppy's Studio</div>
        <div class='activity-kicker'>Draw</div>
        <div class='prompt-box'>{escape_text(ctx['poppy_prompt'])}</div>
        <div class='prompt-lines'>
          <div class='prompt-line'>Title: <span></span></div>
          <div class='prompt-line'>Best detail: <span></span></div>
        </div>
      </section>
    </div>

    <div class='bottom-row'>
      <section class='puzzle col'>
        <div class='section-header section-header--column'>Puzzle</div>
        <div class='scramble-word'>{escape_text(ctx['scramble'])}</div>
        <div class='scramble-hint'>Hint: {escape_text(ctx['scramble_hint'])}</div>
        <div class='answer-line'>Answer: <span class='write-line write-line--medium'></span></div>
        <div class='puzzle-bonus'>{escape_text(ctx['puzzle_bonus'])}</div>
      </section>

      <section class='math col'>
        <div class='section-header section-header--column'>Math Facts</div>
        <div class='math-grid'>
          {math_cells}
        </div>
        <div class='math-bonus'>{escape_text(ctx['math_bonus'])} <span class='write-line write-line--short write-line--medium'></span></div>
      </section>

      <section class='bitcoin col'>
        <div class='section-header section-header--column'>Bitcoin Watch</div>
        <div class='bitcoin-grid'>
          <div class='bitcoin-item'>
            <div class='bitcoin-label'>Price</div>
            <div class='bitcoin-value'>{escape_text(ctx['bitcoin_price'])}</div>
          </div>
          <div class='bitcoin-item'>
            <div class='bitcoin-label'>Height</div>
            <div class='bitcoin-value'>{escape_text(ctx['bitcoin_height'])}</div>
          </div>
          <div class='bitcoin-item'>
            <div class='bitcoin-label'>sats/$</div>
            <div class='bitcoin-value'>{escape_text(ctx['bitcoin_sats'])}</div>
          </div>
        </div>
        <div class='bitcoin-fact'>{escape_text(ctx['bitcoin_fact'])}</div>
      </section>
    </div>

    <footer class='footer'>
      <span>Page 1</span>
      <span>The Klabo Times</span>
      <span class='footer-callout'>Turn over for more</span>
    </footer>
  </div>
</body>
</html>
"""


def render_back_page(css, ctx):
    recipe = ctx["recipe"]
    wellness = ctx["wellness"]
    riddle = ctx["riddle"]
    honk_lines = "".join([f"<div class='status-line'>{escape_text(line)}</div>" for line in ctx["honklab"]])
    ingredients = "".join([f"<li>{escape_text(item)}</li>" for item in recipe.get("ingredients", [])])
    steps = "".join([f"<li>{escape_text(item)}</li>" for item in recipe.get("steps", [])])
    brief_items = "".join(
        [
            f"<div class='brief{' brief--feature' if idx == 0 else ''}'>"
            f"<span class='brief-title'>{escape_text(item.get('title', ''))}</span>"
            f"<span class='brief-body'>{escape_text(item.get('body', ''))}</span></div>"
            for idx, item in enumerate(ctx["briefs_back"])
        ]
    )
    skybox_items = "".join(
        [
            "<div class='skybox-item skybox-item--"
            + re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
            + "'>"
            f"<div class='skybox-label'>{escape_text(label)}</div>"
            f"<div class='skybox-value'>{escape_text(value)}</div>"
            "</div>"
            for label, value in ctx["skybox_back_items"]
            if value
        ]
    )
    game_checks = "".join(
        [
            f"<li><span class='check-box'></span>{escape_text(item)}</li>"
            for item in ctx["game_checks"]
        ]
    )

    return f"""<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <title>Klabo Times Back</title>
  <style>
{css}
  </style>
</head>
<body>
  <div class='page page--back layout-{escape_text(ctx["layout_back"])} theme-{escape_text(ctx["theme_variant"])} style-{escape_text(ctx["style_set"])}'>
    <header class='masthead'>
      <div class='masthead-top'>
        <div class='ear ear--left'>
          <div class='ear-label'>Weather</div>
          <div class='ear-value'>{escape_text(ctx['weather_summary'])}</div>
          <div class='ear-sub'>Hum {escape_text(ctx['weather_humidity'])} Wind {escape_text(ctx['weather_wind'])}</div>
        </div>
        <div class='masthead-center'>
          <h1 class='paper-name'>The Klabo Times</h1>
          <div class='tagline'>All the News That's Fit to Honk</div>
        </div>
        <div class='ear ear--right'>
          <div class='ear-label'>Edition</div>
          <div class='ear-value'>#{escape_text(ctx['edition'])}</div>
          <div class='ear-sub'>{escape_text(ctx['date_short'])}</div>
        </div>
      </div>
      <div class='date-line'>
        <span>{escape_text(ctx['location'])}</span>
        <span>{escape_text(ctx['date_line'])}</span>
        <span>Family Edition</span>
      </div>
    </header>

    <section class='skybox'>
      {skybox_items}
    </section>

    <section class='kitchen strip strip--bottom-only strip--major'>
      <div class='section-header section-header--bar'>Claire's Kitchen</div>
      <div class='recipe-title'>{escape_text(recipe.get('title', ''))}</div>
      <div class='recipe-meta'>{escape_text(ctx['recipe_meta'])}</div>
      <div class='recipe-grid'>
        <div>
          <div class='recipe-subhead'>Ingredients</div>
          <ul class='list-dash'>
            {ingredients}
          </ul>
        </div>
        <div>
          <div class='recipe-subhead'>Steps</div>
          <ol>
            {steps}
          </ol>
          <div class='recipe-tip'>Tip: {escape_text(recipe.get('tip', ''))}</div>
        </div>
      </div>
    </section>

    <section class='briefs strip strip--bottom-only'>
      <div class='section-header section-header--column'>Community Briefs</div>
      <div class='briefs-grid'>
        {brief_items}
      </div>
    </section>

    <div class='mid-row mid-row--back'>
      <section class='wellness col'>
        <div class='section-header section-header--section'>Wellness</div>
        <div class='wellness-title'>{escape_text(wellness.get('title', ''))}</div>
        <div class='wellness-body'>{escape_text(wellness.get('body', ''))}</div>
        <div class='wellness-quote'>"{escape_text(wellness.get('quote', ''))}"</div>
        <div class='wellness-author'>- {escape_text(wellness.get('author', ''))}</div>
      </section>

      <section class='honklab col'>
        <div class='section-header section-header--section'>Honklab Status</div>
        <div class='status-grid'>
          {honk_lines}
        </div>
      </section>
    </div>

    <section class='games strip strip--bottom-only strip--major'>
      <div class='section-header section-header--bar'>Fun and Games</div>
      <div class='games-grid'>
        <div class='game-block game-block--full'>
          <div class='game-label'>Riddle</div>
          <div class='game-text'>{escape_text(riddle.get('question', ''))}</div>
          <div class='game-answer'>Answer: {escape_text(riddle.get('answer', ''))}</div>
        </div>
        <div class='game-block'>
          <div class='game-label'>Family Challenge</div>
          <div class='game-text'>{escape_text(ctx['challenge'])}</div>
        </div>
        <div class='game-block'>
          <div class='game-label'>Mini Mission</div>
          <div class='game-text'>{escape_text(ctx['game_mission'])}</div>
        </div>
        <div class='game-block'>
          <div class='game-label'>Would You Rather</div>
          <div class='game-text'>{escape_text(ctx['would_you_rather'])}</div>
        </div>
        <div class='game-block'>
          <div class='game-label'>Joke</div>
          <div class='game-text'>{escape_text(ctx['joke'])}</div>
        </div>
        <div class='game-block'>
          <div class='game-label'>Trivia</div>
          <div class='game-text'>{escape_text(ctx['trivia'])}</div>
        </div>
        <div class='game-block game-block--full'>
          <div class='game-label'>Daily Wins</div>
          <ul class='game-checklist'>
            {game_checks}
          </ul>
        </div>
      </div>
    </section>

    <section class='drawing strip strip--bottom-only'>
      <div class='section-header section-header--section'>Creative</div>
      <div class='drawing-prompt'>{escape_text(ctx['drawing_prompt'])}</div>
      <div class='drawing-box'></div>
    </section>

    <footer class='footer'>
      <span>Page 2</span>
      <span>The Klabo Times</span>
      <span class='footer-callout'>Family Edition</span>
    </footer>
  </div>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description="Generate Klabo Times HTML")
    parser.add_argument("--data", required=True)
    parser.add_argument("--library", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    data = load_json(args.data)
    library = load_json(args.library)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    css_path = Path(__file__).resolve().parent.parent / "templates" / "newspaper.css"
    css = css_path.read_text(encoding="utf-8")

    ctx = build_context(data, library)

    front_html = render_front_page(css, ctx)
    back_html = render_back_page(css, ctx)

    (output_dir / "front.html").write_text(front_html, encoding="utf-8")
    (output_dir / "back.html").write_text(back_html, encoding="utf-8")


if __name__ == "__main__":
    main()
