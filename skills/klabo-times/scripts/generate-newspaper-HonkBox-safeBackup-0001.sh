#!/bin/bash
# Klabo Times Daily Newspaper Generator
# Generates front and back pages with CSS Grid layout, converts to PDF, optionally prints
#
# Design: Optimized for B&W laser printing
# - No color dependencies - all visual hierarchy through weight/size/borders
# - Minimum line weight: 0.5pt
# - Patterns instead of gray fills
# - Unicode ornaments for decoration

set -e

SKILL_DIR="$(dirname "$(dirname "$(realpath "$0")")")"
ASSETS_DIR="$SKILL_DIR/assets"
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/klabo-times}"
PRINTER="Brother_HL_L2370DW_series"
DATE=$(date +"%A, %B %-d, %Y")
DATE_SHORT=$(date +"%B %-d, %Y")
EDITION=$(date +"%j")  # Day of year as edition number
DAY_OF_YEAR=$((10#$EDITION % 365))  # For content rotation

mkdir -p "$OUTPUT_DIR"

# ==============================================================================
# CONTENT LOADING FROM JSON FILES
# ==============================================================================

# Get remarkable woman for today (rotating through 10 entries)
get_remarkable_woman() {
    local idx=$((DAY_OF_YEAR % 10))
    if [[ -f "$ASSETS_DIR/remarkable-women.json" ]]; then
        jq -r ".women[$idx] | \"\(.name)|\(.years)|\(.title)|\(.fact)\"" "$ASSETS_DIR/remarkable-women.json" 2>/dev/null || \
        echo "Marie Curie|1867-1934|Physicist & Chemist|First person to win Nobel Prizes in two different sciences."
    else
        echo "Marie Curie|1867-1934|Physicist & Chemist|First person to win Nobel Prizes in two different sciences."
    fi
}

# Get space fact for today
get_space_fact() {
    local idx=$((DAY_OF_YEAR % 10))
    if [[ -f "$ASSETS_DIR/space-facts.json" ]]; then
        jq -r ".facts[$idx] | \"\(.title)|\(.big_number)|\(.fact)\"" "$ASSETS_DIR/space-facts.json" 2>/dev/null || \
        echo "Olympus Mons|3x|This Mars volcano is 3 times taller than Mount Everest!"
    else
        echo "Olympus Mons|3x|This Mars volcano is 3 times taller than Mount Everest!"
    fi
}

# Get word scramble for today
get_word_scramble() {
    local idx=$((DAY_OF_YEAR % 5))
    if [[ -f "$ASSETS_DIR/word-scrambles.json" ]]; then
        jq -r ".scrambles[$idx] | \"\(.scrambled)|\(.answer)|\(.hint)\"" "$ASSETS_DIR/word-scrambles.json" 2>/dev/null || \
        echo "TSAR|STAR|Twinkles at night"
    else
        echo "TSAR|STAR|Twinkles at night"
    fi
}

# Get math problems for today
get_math_problems() {
    local idx=$((DAY_OF_YEAR % 5))
    if [[ -f "$ASSETS_DIR/math-problems.json" ]]; then
        jq -r ".problem_sets[$idx] | .beau1, .beau2, .poppy1, .poppy2" "$ASSETS_DIR/math-problems.json" 2>/dev/null || \
        echo -e "3 + 2\n4 + 1\n6 x 4\n7 x 3"
    else
        echo -e "3 + 2\n4 + 1\n6 x 4\n7 x 3"
    fi
}

# Calculate days until Beau's birthday (Feb 19)
calc_beau_birthday_days() {
    local today=$(date +%s)
    local year=$(date +%Y)
    local bday

    # Cross-platform date handling
    if date -d "2025-02-19" +%s &>/dev/null; then
        # GNU date (Linux)
        bday=$(date -d "$year-02-19" +%s)
        if [[ $bday -lt $today ]]; then
            year=$((year + 1))
            bday=$(date -d "$year-02-19" +%s)
        fi
    else
        # BSD date (macOS)
        bday=$(date -j -f "%Y-%m-%d" "$year-02-19" +%s 2>/dev/null || echo $today)
        if [[ $bday -lt $today ]]; then
            year=$((year + 1))
            bday=$(date -j -f "%Y-%m-%d" "$year-02-19" +%s 2>/dev/null || echo $today)
        fi
    fi

    local days=$(( (bday - today) / 86400 ))
    echo "$days"
}

# Fetch weather data
fetch_weather() {
    local weather
    weather=$(curl -s --max-time 5 "wttr.in/Petaluma?format=%c+%t" 2>/dev/null)
    if [[ -n "$weather" && "$weather" != *"Unknown"* ]]; then
        echo "$weather"
    else
        echo "Check weather app"
    fi
}

# Fetch Bitcoin data
fetch_bitcoin() {
    local price height
    price=$(curl -s --max-time 5 "https://mempool.space/api/v1/prices" 2>/dev/null | jq -r '.USD // "N/A"')
    height=$(curl -s --max-time 5 "https://mempool.space/api/blocks/tip/height" 2>/dev/null || echo "N/A")

    # Format price with comma thousands separator
    if [[ "$price" != "N/A" && "$price" =~ ^[0-9]+$ ]]; then
        price=$(printf "%'d" "$price")
    fi

    echo "$price|$height"
}

# Fetch honklab status (simplified - just check if machines respond to ping)
fetch_honklab_status() {
    local machines=("maxblack" "honkbox" "honk" "honkair" "honkpi" "honkstorage")
    local results=""
    for m in "${machines[@]}"; do
        if ping -c1 -W1 "${m}.local" &>/dev/null; then
            results+="${m}:ONLINE|"
        else
            results+="${m}:offline|"
        fi
    done
    echo "${results%|}"
}

# ==============================================================================
# HTML GENERATION - FRONT PAGE
# ==============================================================================

generate_front() {
    local weather=$(fetch_weather)
    local btc_data=$(fetch_bitcoin)
    local btc_price=$(echo "$btc_data" | cut -d'|' -f1)
    local btc_height=$(echo "$btc_data" | cut -d'|' -f2)
    local sats_per_dollar="N/A"

    # Calculate sats per dollar
    local btc_price_raw=$(echo "$btc_price" | tr -d ',')
    if [[ "$btc_price_raw" =~ ^[0-9]+$ ]]; then
        sats_per_dollar=$(echo "scale=0; 100000000 / $btc_price_raw" | bc 2>/dev/null || echo "N/A")
    fi

    local beau_days=$(calc_beau_birthday_days)

    # Get rotating content
    local woman_data=$(get_remarkable_woman)
    local woman_name=$(echo "$woman_data" | cut -d'|' -f1)
    local woman_years=$(echo "$woman_data" | cut -d'|' -f2)
    local woman_title=$(echo "$woman_data" | cut -d'|' -f3)
    local woman_fact=$(echo "$woman_data" | cut -d'|' -f4)

    local space_data=$(get_space_fact)
    local space_title=$(echo "$space_data" | cut -d'|' -f1)
    local space_number=$(echo "$space_data" | cut -d'|' -f2)
    local space_fact=$(echo "$space_data" | cut -d'|' -f3)

    local scramble_data=$(get_word_scramble)
    local scrambled=$(echo "$scramble_data" | cut -d'|' -f1)
    local scramble_hint=$(echo "$scramble_data" | cut -d'|' -f3)

    local math_probs=$(get_math_problems)
    local math1=$(echo "$math_probs" | sed -n '1p')
    local math2=$(echo "$math_probs" | sed -n '2p')
    local math3=$(echo "$math_probs" | sed -n '3p')
    local math4=$(echo "$math_probs" | sed -n '4p')

    cat > "$OUTPUT_DIR/front.html" << 'FRONTEOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        /* ==================================================================
           THE KLABO TIMES - FRONT PAGE
           Optimized for B&W Laser Printing
           ================================================================== */

        :root {
            --font-display: "Playfair", Georgia, serif;
            --font-body: Georgia, "Times New Roman", serif;
            --font-mono: "Courier New", monospace;
            --ink-black: #000;
            --ink-dark: #333;
            --ink-medium: #666;
            --ink-light: #999;
        }

        @page {
            size: letter;
            margin: 0.4in;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-body);
            font-size: 11px;
            line-height: 1.4;
            max-width: 7.5in;
            margin: 0 auto;
            padding: 12px;
            color: var(--ink-black);
        }

        /* === CSS GRID LAYOUT === */
        .page-1 {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            grid-template-rows: auto auto 1fr 1fr;
            grid-template-areas:
                "masthead   masthead   masthead"
                "hero       hero       hero"
                "poppy      calendar   beau"
                "puzzle     math       bitcoin";
            gap: 12px;
            min-height: 9.5in;
        }

        /* ==================================================================
           MASTHEAD - Vintage Newspaper Style
           ================================================================== */
        .masthead {
            grid-area: masthead;
            text-align: center;
            border-bottom: 3px double var(--ink-black);
            padding-bottom: 8px;
        }

        .masthead-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
        }

        .ear {
            font-size: 8px;
            text-align: center;
            width: 80px;
            padding: 4px;
            border: 1px solid var(--ink-black);
        }

        .ear-label {
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 7px;
            margin-bottom: 2px;
        }

        .masthead-center {
            flex: 1;
            padding: 0 16px;
        }

        .masthead h1 {
            font-family: var(--font-display);
            font-size: 36px;
            font-weight: 900;
            letter-spacing: 3px;
            margin: 0;
            text-transform: uppercase;
        }

        .tagline {
            font-family: var(--font-body);
            font-style: italic;
            font-size: 10px;
            margin-top: 2px;
        }

        .date-line {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            border-top: 1px solid var(--ink-black);
            padding-top: 6px;
            margin-top: 6px;
        }

        /* ==================================================================
           SECTION BOXES - Consistent styling
           ================================================================== */
        .section-box {
            border: 1px solid var(--ink-black);
            padding: 10px;
            overflow: hidden;
        }

        .section-header {
            font-family: var(--font-display);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            text-align: center;
            border-bottom: 1px solid var(--ink-black);
            padding-bottom: 4px;
            margin-bottom: 8px;
        }

        /* Decorative section header with ornaments */
        .section-header-ornate {
            font-family: var(--font-display);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            text-align: center;
            margin-bottom: 8px;
        }

        .section-header-ornate::before {
            content: "--- ";
            letter-spacing: -2px;
        }

        .section-header-ornate::after {
            content: " ---";
            letter-spacing: -2px;
        }

        /* ==================================================================
           HERO SECTION - Birthday Countdown
           ================================================================== */
        .hero {
            grid-area: hero;
            border: 2px solid var(--ink-black);
            padding: 16px;
            text-align: center;
            /* Diagonal stripe pattern instead of color */
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(0,0,0,0.03) 10px,
                rgba(0,0,0,0.03) 20px
            );
        }

        .countdown-number {
            font-family: var(--font-display);
            font-size: 56px;
            font-weight: 900;
            line-height: 1;
        }

        .countdown-label {
            font-size: 16px;
            font-weight: bold;
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .countdown-subtitle {
            font-size: 11px;
            font-style: italic;
            margin-top: 4px;
        }

        /* ==================================================================
           POPPY'S CORNER - Remarkable Women
           ================================================================== */
        .poppy {
            grid-area: poppy;
        }

        /* Drop cap for first letter */
        .drop-cap {
            float: left;
            font-family: var(--font-display);
            font-size: 42px;
            font-weight: 900;
            line-height: 0.8;
            margin-right: 4px;
            margin-top: 4px;
        }

        .woman-name {
            font-weight: bold;
            font-size: 12px;
        }

        .woman-years {
            font-size: 10px;
            color: var(--ink-dark);
        }

        .woman-title {
            font-style: italic;
            font-size: 10px;
            margin-bottom: 4px;
        }

        /* Drawing box - dashed, inviting for kids */
        .drawing-box {
            border: 2px dashed var(--ink-medium);
            border-radius: 8px;
            min-height: 70px;
            margin-top: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            color: var(--ink-medium);
            font-style: italic;
        }

        /* ==================================================================
           BEAU'S SPACE REPORT - Big Numbers
           ================================================================== */
        .beau {
            grid-area: beau;
        }

        .big-number {
            font-family: var(--font-display);
            font-size: 42px;
            font-weight: 900;
            text-align: center;
            line-height: 1;
            margin: 8px 0 4px;
        }

        .big-number-label {
            text-align: center;
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* ==================================================================
           FAMILY CALENDAR
           ================================================================== */
        .calendar {
            grid-area: calendar;
        }

        .calendar ul {
            margin: 0;
            padding-left: 16px;
            font-size: 10px;
        }

        .calendar li {
            margin-bottom: 4px;
        }

        .calendar li strong {
            font-weight: bold;
        }

        .family-challenge {
            margin-top: 10px;
            padding: 6px;
            border: 1px dashed var(--ink-dark);
            font-size: 10px;
            text-align: center;
        }

        /* ==================================================================
           PUZZLE SECTION - Word Scramble
           ================================================================== */
        .puzzle {
            grid-area: puzzle;
        }

        .word-scramble {
            font-family: var(--font-mono);
            font-size: 18px;
            letter-spacing: 4px;
            text-align: center;
            margin: 10px 0 4px;
            font-weight: bold;
        }

        .puzzle-hint {
            font-size: 9px;
            font-style: italic;
            text-align: center;
            color: var(--ink-dark);
        }

        /* ==================================================================
           MATH CORNER
           ================================================================== */
        .math {
            grid-area: math;
        }

        .math-problems {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 8px;
        }

        .math-problem {
            border: 1px solid var(--ink-light);
            padding: 6px;
            text-align: center;
        }

        .math-problem .problem {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: bold;
        }

        .math-problem .answer-line {
            border-bottom: 1px solid var(--ink-black);
            width: 30px;
            display: inline-block;
            margin-left: 4px;
        }

        .math-label {
            font-size: 8px;
            color: var(--ink-medium);
            margin-bottom: 2px;
        }

        /* ==================================================================
           BITCOIN CORNER
           ================================================================== */
        .bitcoin {
            grid-area: bitcoin;
            /* Dot pattern instead of color background */
            background: radial-gradient(
                circle,
                var(--ink-light) 1px,
                transparent 1px
            );
            background-size: 8px 8px;
        }

        .btc-stat {
            text-align: center;
            margin: 6px 0;
            background: white;
            padding: 4px;
        }

        .btc-stat .value {
            font-family: var(--font-display);
            font-size: 14px;
            font-weight: 700;
        }

        .btc-stat .label {
            font-size: 8px;
            color: var(--ink-dark);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* ==================================================================
           FOOTER
           ================================================================== */
        .footer {
            grid-column: 1 / -1;
            text-align: center;
            font-size: 8px;
            border-top: 1px solid var(--ink-black);
            padding-top: 6px;
            margin-top: auto;
        }

        .footer-ornament {
            letter-spacing: 4px;
        }
    </style>
</head>
<body>
    <div class="page-1">
        <!-- MASTHEAD -->
        <div class="masthead">
            <div class="masthead-top">
                <div class="ear">
                    <div class="ear-label">Weather</div>
                    <div>WEATHER_PLACEHOLDER</div>
                </div>
                <div class="masthead-center">
                    <h1>The Klabo Times</h1>
                    <div class="tagline">"All the News That's Fit to Honk"</div>
                </div>
                <div class="ear">
                    <div class="ear-label">Edition</div>
                    <div>No. EDITION_PLACEHOLDER</div>
                </div>
            </div>
            <div class="date-line">
                <span>Petaluma, California</span>
                <span>DATE_PLACEHOLDER</span>
                <span>Est. 2026</span>
            </div>
        </div>

        <!-- HERO - BIRTHDAY COUNTDOWN -->
        <div class="hero">
            <div class="countdown-number">BEAU_DAYS_PLACEHOLDER</div>
            <div class="countdown-label">Days Until Beau's 5th Birthday!</div>
            <div class="countdown-subtitle">February 19th - The big celebration awaits!</div>
        </div>

        <!-- POPPY'S CORNER -->
        <div class="section-box poppy">
            <div class="section-header">Poppy's Corner</div>
            <p><span class="drop-cap">WOMAN_INITIAL_PLACEHOLDER</span><span class="woman-name">WOMAN_NAME_REST_PLACEHOLDER</span> <span class="woman-years">(WOMAN_YEARS_PLACEHOLDER)</span></p>
            <p class="woman-title">WOMAN_TITLE_PLACEHOLDER</p>
            <p style="font-size: 10px;">WOMAN_FACT_PLACEHOLDER</p>
            <div class="drawing-box">Draw her!</div>
        </div>

        <!-- FAMILY CALENDAR -->
        <div class="section-box calendar">
            <div class="section-header">Family Calendar</div>
            <ul>
                <li><strong>Feb 19:</strong> Beau's 5th Birthday!</li>
                <li><strong>Feb 14:</strong> Valentine's Day</li>
                <li><strong>Saturdays:</strong> Farmers Market 10am</li>
                <li><strong>Tues/Thurs:</strong> Library Story Time</li>
            </ul>
            <div class="family-challenge">
                <strong>Today's Challenge:</strong><br>
                Share one thing you're grateful for at dinner!
            </div>
        </div>

        <!-- BEAU'S SPACE REPORT -->
        <div class="section-box beau">
            <div class="section-header">Beau's Space Report</div>
            <div class="big-number">SPACE_NUMBER_PLACEHOLDER</div>
            <div class="big-number-label">SPACE_TITLE_PLACEHOLDER</div>
            <p style="font-size: 10px;">SPACE_FACT_PLACEHOLDER</p>
        </div>

        <!-- PUZZLE -->
        <div class="section-box puzzle">
            <div class="section-header">Word Scramble</div>
            <p class="puzzle-hint">Unscramble this word:</p>
            <div class="word-scramble">SCRAMBLED_PLACEHOLDER</div>
            <p class="puzzle-hint">(Hint: SCRAMBLE_HINT_PLACEHOLDER)</p>
            <div class="drawing-box" style="min-height: 50px;">Draw what you unscrambled!</div>
        </div>

        <!-- MATH CORNER -->
        <div class="section-box math">
            <div class="section-header">Math Corner</div>
            <div class="math-problems">
                <div class="math-problem">
                    <div class="math-label">Beau</div>
                    <div class="problem">MATH1_PLACEHOLDER = <span class="answer-line"></span></div>
                </div>
                <div class="math-problem">
                    <div class="math-label">Beau</div>
                    <div class="problem">MATH2_PLACEHOLDER = <span class="answer-line"></span></div>
                </div>
                <div class="math-problem">
                    <div class="math-label">Poppy</div>
                    <div class="problem">MATH3_PLACEHOLDER = <span class="answer-line"></span></div>
                </div>
                <div class="math-problem">
                    <div class="math-label">Poppy</div>
                    <div class="problem">MATH4_PLACEHOLDER = <span class="answer-line"></span></div>
                </div>
            </div>
        </div>

        <!-- BITCOIN -->
        <div class="section-box bitcoin">
            <div class="section-header">Bitcoin Corner</div>
            <div class="btc-stat">
                <div class="value">$BTC_PRICE_PLACEHOLDER</div>
                <div class="label">Price (USD)</div>
            </div>
            <div class="btc-stat">
                <div class="value">BTC_HEIGHT_PLACEHOLDER</div>
                <div class="label">Block Height</div>
            </div>
            <div class="btc-stat">
                <div class="value">SATS_PLACEHOLDER sats</div>
                <div class="label">per $1 USD</div>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="footer">
            <span class="footer-ornament">***</span> Printed with love by HAUNK | honklab network | Turn over for more! <span class="footer-ornament">***</span>
        </div>
    </div>
</body>
</html>
FRONTEOF

    # Replace placeholders
    sed -i "s/DATE_PLACEHOLDER/$DATE_SHORT/g" "$OUTPUT_DIR/front.html"
    sed -i "s/EDITION_PLACEHOLDER/$EDITION/g" "$OUTPUT_DIR/front.html"
    sed -i "s|WEATHER_PLACEHOLDER|$weather|g" "$OUTPUT_DIR/front.html"
    sed -i "s/BTC_PRICE_PLACEHOLDER/$btc_price/g" "$OUTPUT_DIR/front.html"
    sed -i "s/BTC_HEIGHT_PLACEHOLDER/$btc_height/g" "$OUTPUT_DIR/front.html"
    sed -i "s/SATS_PLACEHOLDER/$sats_per_dollar/g" "$OUTPUT_DIR/front.html"
    sed -i "s/BEAU_DAYS_PLACEHOLDER/$beau_days/g" "$OUTPUT_DIR/front.html"

    # Woman content
    local woman_initial="${woman_name:0:1}"
    local woman_name_rest="${woman_name:1}"
    sed -i "s/WOMAN_INITIAL_PLACEHOLDER/$woman_initial/g" "$OUTPUT_DIR/front.html"
    sed -i "s/WOMAN_NAME_REST_PLACEHOLDER/$woman_name_rest/g" "$OUTPUT_DIR/front.html"
    sed -i "s/WOMAN_YEARS_PLACEHOLDER/$woman_years/g" "$OUTPUT_DIR/front.html"
    sed -i "s/WOMAN_TITLE_PLACEHOLDER/$woman_title/g" "$OUTPUT_DIR/front.html"
    sed -i "s/WOMAN_FACT_PLACEHOLDER/$woman_fact/g" "$OUTPUT_DIR/front.html"

    # Space content
    sed -i "s/SPACE_NUMBER_PLACEHOLDER/$space_number/g" "$OUTPUT_DIR/front.html"
    sed -i "s/SPACE_TITLE_PLACEHOLDER/$space_title/g" "$OUTPUT_DIR/front.html"
    sed -i "s/SPACE_FACT_PLACEHOLDER/$space_fact/g" "$OUTPUT_DIR/front.html"

    # Puzzle content
    sed -i "s/SCRAMBLED_PLACEHOLDER/$scrambled/g" "$OUTPUT_DIR/front.html"
    sed -i "s/SCRAMBLE_HINT_PLACEHOLDER/$scramble_hint/g" "$OUTPUT_DIR/front.html"

    # Math problems
    sed -i "s/MATH1_PLACEHOLDER/$math1/g" "$OUTPUT_DIR/front.html"
    sed -i "s/MATH2_PLACEHOLDER/$math2/g" "$OUTPUT_DIR/front.html"
    sed -i "s/MATH3_PLACEHOLDER/$math3/g" "$OUTPUT_DIR/front.html"
    sed -i "s/MATH4_PLACEHOLDER/$math4/g" "$OUTPUT_DIR/front.html"
}

# ==============================================================================
# HTML GENERATION - BACK PAGE
# ==============================================================================

generate_back() {
    # Get honklab status
    local status_data=$(fetch_honklab_status)

    cat > "$OUTPUT_DIR/back.html" << 'BACKEOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        /* ==================================================================
           THE KLABO TIMES - BACK PAGE
           Optimized for B&W Laser Printing
           ================================================================== */

        :root {
            --font-display: "Playfair", Georgia, serif;
            --font-body: Georgia, "Times New Roman", serif;
            --font-mono: "Courier New", monospace;
            --ink-black: #000;
            --ink-dark: #333;
            --ink-medium: #666;
            --ink-light: #999;
        }

        @page {
            size: letter;
            margin: 0.4in;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-body);
            font-size: 11px;
            line-height: 1.4;
            max-width: 7.5in;
            margin: 0 auto;
            padding: 12px;
            color: var(--ink-black);
        }

        /* === CSS GRID LAYOUT - BACK PAGE === */
        .page-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto auto auto auto;
            grid-template-areas:
                "kitchen   kitchen"
                "wellness  honklab"
                "puzzles   puzzles"
                "drawing   drawing"
                "footer    footer";
            gap: 12px;
            min-height: 9.5in;
        }

        /* === SECTION BOXES === */
        .section-box {
            border: 1px solid var(--ink-black);
            padding: 10px;
            overflow: hidden;
        }

        .section-header {
            font-family: var(--font-display);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            text-align: center;
            border-bottom: 1px solid var(--ink-black);
            padding-bottom: 4px;
            margin-bottom: 8px;
        }

        /* ==================================================================
           CLAIRE'S KITCHEN
           ================================================================== */
        .kitchen {
            grid-area: kitchen;
        }

        .recipe-title {
            font-family: var(--font-display);
            font-size: 14px;
            font-weight: 700;
            text-align: center;
            margin: 4px 0 8px;
        }

        .recipe-grid {
            display: grid;
            grid-template-columns: 1fr 1.5fr;
            gap: 16px;
        }

        .ingredients h4,
        .instructions h4 {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
            border-bottom: 1px dotted var(--ink-medium);
            padding-bottom: 2px;
        }

        .ingredients ul {
            margin: 0;
            padding-left: 14px;
            font-size: 10px;
        }

        .ingredients li {
            margin-bottom: 2px;
        }

        .instructions ol {
            margin: 0;
            padding-left: 16px;
            font-size: 10px;
        }

        .instructions li {
            margin-bottom: 3px;
        }

        .recipe-tip {
            font-style: italic;
            font-size: 9px;
            margin-top: 8px;
            padding: 6px;
            border-left: 2px solid var(--ink-dark);
            background: repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 4px,
                rgba(0,0,0,0.02) 4px,
                rgba(0,0,0,0.02) 8px
            );
        }

        /* ==================================================================
           WELLNESS CORNER
           ================================================================== */
        .wellness {
            grid-area: wellness;
        }

        .wellness-quote {
            font-style: italic;
            font-size: 10px;
            margin-top: 8px;
            padding: 8px;
            border-top: 1px solid var(--ink-medium);
            border-bottom: 1px solid var(--ink-medium);
            text-align: center;
        }

        .wellness-quote .attribution {
            font-size: 8px;
            margin-top: 4px;
            font-style: normal;
        }

        /* ==================================================================
           HONKLAB STATUS
           ================================================================== */
        .honklab {
            grid-area: honklab;
            font-family: var(--font-mono);
            font-size: 9px;
        }

        .status-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            margin-top: 6px;
        }

        .status-item {
            padding: 4px;
            border: 1px solid var(--ink-light);
            display: flex;
            justify-content: space-between;
        }

        .status-online {
            font-weight: bold;
        }

        .status-offline {
            color: var(--ink-medium);
        }

        /* ==================================================================
           PUZZLES SECTION
           ================================================================== */
        .puzzles {
            grid-area: puzzles;
        }

        .puzzle-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 8px;
        }

        .puzzle-item {
            border: 1px solid var(--ink-light);
            padding: 8px;
            text-align: center;
        }

        .puzzle-item h4 {
            font-family: var(--font-display);
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 6px;
            border-bottom: 1px dotted var(--ink-light);
            padding-bottom: 4px;
        }

        .riddle {
            font-size: 10px;
            line-height: 1.4;
        }

        .riddle-answer {
            font-size: 8px;
            color: var(--ink-medium);
            margin-top: 6px;
            transform: rotate(180deg);
            display: inline-block;
        }

        .mini-activity {
            border: 1px dashed var(--ink-medium);
            padding: 8px;
            min-height: 50px;
            font-size: 9px;
            color: var(--ink-medium);
        }

        /* ==================================================================
           CREATIVE DRAWING AREA
           ================================================================== */
        .drawing {
            grid-area: drawing;
        }

        .drawing-prompt {
            text-align: center;
            font-size: 11px;
            margin-bottom: 8px;
        }

        .drawing-box {
            border: 2px dashed var(--ink-medium);
            border-radius: 8px;
            min-height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: var(--ink-light);
            font-style: italic;
        }

        /* ==================================================================
           FOOTER
           ================================================================== */
        .footer {
            grid-area: footer;
            text-align: center;
            font-size: 8px;
            border-top: 1px solid var(--ink-black);
            padding-top: 6px;
        }
    </style>
</head>
<body>
    <div class="page-2">
        <!-- CLAIRE'S KITCHEN -->
        <div class="section-box kitchen">
            <div class="section-header">Claire's Kitchen</div>
            <div class="recipe-title">Quick Weeknight Garlic Pasta</div>
            <div class="recipe-grid">
                <div class="ingredients">
                    <h4>Ingredients</h4>
                    <ul>
                        <li>1 lb pasta</li>
                        <li>4 cloves garlic, minced</li>
                        <li>1/4 cup olive oil</li>
                        <li>Red pepper flakes</li>
                        <li>Parmesan cheese</li>
                        <li>Fresh parsley</li>
                    </ul>
                </div>
                <div class="instructions">
                    <h4>Instructions</h4>
                    <ol>
                        <li>Cook pasta (save 1 cup pasta water)</li>
                        <li>Saute garlic in olive oil until golden</li>
                        <li>Add red pepper flakes to taste</li>
                        <li>Toss with drained pasta</li>
                        <li>Add pasta water as needed</li>
                        <li>Top with parmesan and parsley</li>
                    </ol>
                </div>
            </div>
            <div class="recipe-tip">
                <strong>Kid Helper Tip:</strong> Kids can measure ingredients and sprinkle the cheese!
            </div>
        </div>

        <!-- WELLNESS CORNER -->
        <div class="section-box wellness">
            <div class="section-header">Wellness Corner</div>
            <p><strong>Today's Focus: Mindful Breathing</strong></p>
            <p style="margin-top: 4px; font-size: 10px;">Try the 4-7-8 technique:</p>
            <ul style="margin: 4px 0; padding-left: 16px; font-size: 10px;">
                <li>Breathe in for 4 seconds</li>
                <li>Hold for 7 seconds</li>
                <li>Exhale for 8 seconds</li>
            </ul>
            <div class="wellness-quote">
                "Almost everything will work again if you unplug it for a few minutes, including you."
                <div class="attribution">- Anne Lamott</div>
            </div>
        </div>

        <!-- HONKLAB STATUS -->
        <div class="section-box honklab">
            <div class="section-header">Honklab Status</div>
            <div class="status-grid">
                <div class="status-item">
                    <span>maxblack:</span>
                    <span class="status-online">ONLINE</span>
                </div>
                <div class="status-item">
                    <span>honkbox:</span>
                    <span class="status-online">ONLINE</span>
                </div>
                <div class="status-item">
                    <span>honk:</span>
                    <span class="status-online">ONLINE</span>
                </div>
                <div class="status-item">
                    <span>honkair:</span>
                    <span class="status-online">ONLINE</span>
                </div>
                <div class="status-item">
                    <span>honkpi:</span>
                    <span class="status-online">ONLINE</span>
                </div>
                <div class="status-item">
                    <span>honkstorage:</span>
                    <span class="status-online">ONLINE</span>
                </div>
            </div>
            <p style="margin-top: 8px; font-size: 8px;">
                Bitcoin Node: Syncing... | Printer: Ready
            </p>
        </div>

        <!-- PUZZLES -->
        <div class="section-box puzzles">
            <div class="section-header">Fun and Games</div>
            <div class="puzzle-grid">
                <div class="puzzle-item">
                    <h4>Today's Riddle</h4>
                    <div class="riddle">
                        I have cities, but no houses.<br>
                        I have mountains, but no trees.<br>
                        I have water, but no fish.<br>
                        What am I?
                    </div>
                    <div class="riddle-answer">(A map!)</div>
                </div>
                <div class="puzzle-item">
                    <h4>Counting Challenge</h4>
                    <div class="mini-activity">
                        Count how many windows<br>
                        are in our house!<br><br>
                        Answer: _____
                    </div>
                </div>
                <div class="puzzle-item">
                    <h4>Observation Game</h4>
                    <div class="mini-activity">
                        Find 3 things that<br>
                        are BLUE today!<br><br>
                        1. _____________<br>
                        2. _____________<br>
                        3. _____________
                    </div>
                </div>
            </div>
        </div>

        <!-- CREATIVE DRAWING AREA -->
        <div class="section-box drawing">
            <div class="section-header">Creative Corner</div>
            <div class="drawing-prompt">
                <strong>Today's Drawing Prompt:</strong> Draw your favorite thing about today!
            </div>
            <div class="drawing-box">Your masterpiece here!</div>
        </div>

        <!-- FOOTER -->
        <div class="footer">
            THE KLABO TIMES | Est. 2026 | Printed on recycled electrons | honklab.local
        </div>
    </div>
</body>
</html>
BACKEOF
}

# ==============================================================================
# PDF CONVERSION
# ==============================================================================

convert_to_pdf() {
    echo "Converting to PDF..."

    # Use Chromium headless to convert HTML to PDF
    chromium --headless --disable-gpu --no-pdf-header-footer \
        --print-to-pdf="$OUTPUT_DIR/front.pdf" \
        "$OUTPUT_DIR/front.html" 2>/dev/null

    chromium --headless --disable-gpu --no-pdf-header-footer \
        --print-to-pdf="$OUTPUT_DIR/back.pdf" \
        "$OUTPUT_DIR/back.html" 2>/dev/null

    # Combine into single PDF for double-sided printing
    local final_pdf="$OUTPUT_DIR/klabo-times-$(date +%Y%m%d).pdf"

    if command -v pdfunite &> /dev/null; then
        pdfunite "$OUTPUT_DIR/front.pdf" "$OUTPUT_DIR/back.pdf" "$final_pdf"
        echo "Combined PDF: $final_pdf"
    else
        cp "$OUTPUT_DIR/front.pdf" "$final_pdf"
        echo "Warning: pdfunite not found. Front page only."
        echo "Install poppler-utils for combined PDF."
    fi
}

# ==============================================================================
# PRINTING
# ==============================================================================

print_newspaper() {
    local pdf="$OUTPUT_DIR/klabo-times-$(date +%Y%m%d).pdf"

    if [[ ! -f "$pdf" ]]; then
        echo "Error: PDF not found: $pdf"
        exit 1
    fi

    echo "Printing to $PRINTER..."
    lp -d "$PRINTER" -o sides=two-sided-long-edge "$pdf"
    echo "Print job submitted."
}

# ==============================================================================
# MAIN
# ==============================================================================

# Source GATE verification if available
if [[ -f "$SKILL_DIR/scripts/gate-verify.sh" ]]; then
    source "$SKILL_DIR/scripts/gate-verify.sh"
fi

case "${1:-print}" in
    preview)
        echo "Generating preview..."
        generate_front
        generate_back
        convert_to_pdf
        local_pdf="$OUTPUT_DIR/klabo-times-$(date +%Y%m%d).pdf"
        echo ""
        echo "Preview generated: $local_pdf"
        echo ""
        if type run_all_gates &>/dev/null; then
            echo "Running GATE verification..."
            run_all_gates "$local_pdf"
        fi
        ;;
    print)
        echo "Generating and printing..."
        generate_front
        generate_back
        convert_to_pdf
        local_pdf="$OUTPUT_DIR/klabo-times-$(date +%Y%m%d).pdf"
        echo ""
        if type run_all_gates &>/dev/null; then
            echo "Running GATE verification..."
            if run_all_gates "$local_pdf"; then
                print_newspaper
            else
                echo "GATE verification failed. Not printing."
                exit 1
            fi
        else
            print_newspaper
        fi
        ;;
    gate)
        # Just run GATE on existing PDF
        local_pdf="${2:-$OUTPUT_DIR/klabo-times-$(date +%Y%m%d).pdf}"
        if type run_all_gates &>/dev/null; then
            run_all_gates "$local_pdf"
        else
            echo "GATE verification not available"
            exit 1
        fi
        ;;
    schedule)
        echo "To schedule daily printing, add to crontab:"
        echo "  0 6 * * * $0 print"
        echo ""
        echo "Edit with: crontab -e"
        ;;
    *)
        echo "Usage: $0 [preview|print|gate [pdf]|schedule]"
        echo ""
        echo "Commands:"
        echo "  preview  - Generate PDF without printing"
        echo "  print    - Generate PDF, verify with GATE, then print"
        echo "  gate     - Run GATE verification on existing PDF"
        echo "  schedule - Show cron scheduling instructions"
        exit 1
        ;;
esac
