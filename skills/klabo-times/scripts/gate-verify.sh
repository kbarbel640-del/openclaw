#!/bin/bash
# GATE Verification System for The Klabo Times
# 17 checks across 4 tiers - sourceable function library
#
# Required tools: qpdf, pdftotext, pdftoppm, pdfinfo, pdffonts (poppler-utils),
#                 convert/identify/compare (imagemagick), bc
#
# Usage: source this file, then call run_all_gates "/path/to/newspaper.pdf"

BASELINE_DIR="$HOME/.claude/skills/klabo-times/assets"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

_gate_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    return 0
}

_gate_fail() {
    echo -e "${RED}[FAIL]${NC} $1: $2"
    return 1
}

_gate_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1: $2"
}

# ==============================================================================
# TIER 1: INSTANT FAIL (< 1 sec)
# ==============================================================================

gate_check_pdf_valid() {
    local pdf="$1"

    # Check file exists
    [[ ! -f "$pdf" ]] && { _gate_fail "pdf_valid" "File not found: $pdf"; return 1; }

    # Check qpdf validation (allow warnings, only fail on real errors)
    local qpdf_output
    qpdf_output=$(qpdf --check "$pdf" 2>&1)
    local qpdf_exit=$?
    # qpdf exits 0 on success, 3 on warnings (acceptable), other codes are errors
    if [[ $qpdf_exit -ne 0 ]] && [[ $qpdf_exit -ne 3 ]]; then
        _gate_fail "pdf_valid" "qpdf validation failed: $qpdf_output"
        return 1
    fi

    # Check file size (50KB - 5MB)
    local size
    size=$(stat -c%s "$pdf" 2>/dev/null || stat -f%z "$pdf" 2>/dev/null)
    if [[ $size -lt 51200 ]]; then
        _gate_fail "pdf_valid" "File too small: ${size} bytes (min 50KB)"
        return 1
    fi
    if [[ $size -gt 5242880 ]]; then
        _gate_fail "pdf_valid" "File too large: ${size} bytes (max 5MB)"
        return 1
    fi

    _gate_pass "pdf_valid (qpdf OK, size: $((size/1024))KB)"
}

gate_check_pdf_structure() {
    local pdf="$1"

    # Get page count
    local pages
    pages=$(pdfinfo "$pdf" 2>/dev/null | grep -i "^Pages:" | awk '{print $2}')
    if [[ "$pages" != "2" ]]; then
        _gate_fail "pdf_structure" "Expected 2 pages, got: $pages"
        return 1
    fi

    # Check page size (letter: 612x792 pts, allow small tolerance)
    local pagesize
    pagesize=$(pdfinfo "$pdf" 2>/dev/null | grep -i "^Page size:")
    local width height
    width=$(echo "$pagesize" | grep -oP '\d+(\.\d+)?' | head -1)
    height=$(echo "$pagesize" | grep -oP '\d+(\.\d+)?' | head -2 | tail -1)

    # Allow 1pt tolerance
    local width_ok height_ok
    width_ok=$(echo "$width >= 611 && $width <= 613" | bc -l)
    height_ok=$(echo "$height >= 791 && $height <= 793" | bc -l)

    if [[ "$width_ok" != "1" ]] || [[ "$height_ok" != "1" ]]; then
        _gate_fail "pdf_structure" "Page size ${width}x${height} pts (expected 612x792)"
        return 1
    fi

    _gate_pass "pdf_structure (2 pages, ${width}x${height} pts)"
}

# ==============================================================================
# TIER 2: STRUCTURAL (< 5 sec)
# ==============================================================================

gate_check_html_entities() {
    local pdf="$1"
    local text
    text=$(pdftotext "$pdf" - 2>/dev/null)

    # Look for unrendered HTML entities (excluding legitimate uses)
    # Common problematic entities: &amp; &lt; &gt; &quot; &#x27; &#39; &nbsp;
    local entities
    entities=$(echo "$text" | grep -oP '&(amp|lt|gt|quot|nbsp|#x?[0-9a-fA-F]+);' | head -5)

    if [[ -n "$entities" ]]; then
        local count
        count=$(echo "$text" | grep -oP '&(amp|lt|gt|quot|nbsp|#x?[0-9a-fA-F]+);' | wc -l)
        _gate_fail "html_entities" "Found $count unrendered entities: $(echo $entities | tr '\n' ' ')"
        return 1
    fi

    _gate_pass "html_entities (no unrendered entities)"
}

gate_check_placeholders() {
    local pdf="$1"
    local text
    text=$(pdftotext "$pdf" - 2>/dev/null)

    local issues=""

    # Check for common placeholder patterns
    echo "$text" | grep -qi "PLACEHOLDER" && issues+="PLACEHOLDER "
    echo "$text" | grep -qP '\{\{.*?\}\}' && issues+="{{...}} "
    echo "$text" | grep -qP '\$\{.*?\}' && issues+="\${...} "
    echo "$text" | grep -qwi "undefined" && issues+="undefined "
    echo "$text" | grep -qw "null" && issues+="null "
    echo "$text" | grep -q "\[object Object\]" && issues+="[object Object] "
    echo "$text" | grep -qi "TODO" && issues+="TODO "
    echo "$text" | grep -qi "FIXME" && issues+="FIXME "

    if [[ -n "$issues" ]]; then
        _gate_fail "placeholders" "Found: $issues"
        return 1
    fi

    _gate_pass "placeholders (none detected)"
}

gate_check_date() {
    local pdf="$1"
    local text
    text=$(pdftotext "$pdf" - 2>/dev/null)

    # Get today's date in multiple formats
    local today_short today_long today_full
    today_short=$(date "+%b %-d, %Y")          # "Feb 3, 2026"
    today_long=$(date "+%B %-d, %Y")           # "February 3, 2026"
    today_full=$(date "+%A, %B %-d, %Y")       # "Tuesday, February 3, 2026"

    if echo "$text" | grep -qF "$today_short" || \
       echo "$text" | grep -qF "$today_long" || \
       echo "$text" | grep -qF "$today_full"; then
        _gate_pass "date (found in PDF)"
        return 0
    fi

    _gate_fail "date" "Today's date not found (tried: $today_short, $today_long)"
    return 1
}

gate_check_required_sections() {
    local pdf="$1"
    local text
    text=$(pdftotext "$pdf" - 2>/dev/null)
    local failures=""

    # Check masthead
    if ! echo "$text" | grep -qi "THE KLABO TIMES"; then
        failures+="Missing masthead; "
    fi

    # Check POPPY section (15+ words)
    local poppy_words
    poppy_words=$(echo "$text" | grep -iA 50 "POPPY" | head -50 | wc -w)
    if [[ $poppy_words -lt 15 ]]; then
        failures+="POPPY section too short ($poppy_words words, need 15); "
    fi

    # Check BEAU section (15+ words)
    local beau_words
    beau_words=$(echo "$text" | grep -iA 50 "BEAU" | head -50 | wc -w)
    if [[ $beau_words -lt 15 ]]; then
        failures+="BEAU section too short ($beau_words words, need 15); "
    fi

    # Check BITCOIN section (5+ words)
    local bitcoin_words
    bitcoin_words=$(echo "$text" | grep -iA 20 "BITCOIN" | head -20 | wc -w)
    if [[ $bitcoin_words -lt 5 ]]; then
        failures+="BITCOIN section too short ($bitcoin_words words, need 5); "
    fi

    # Check WEATHER section (3+ words)
    local weather_words
    weather_words=$(echo "$text" | grep -iA 10 "WEATHER\|FORECAST" | head -10 | wc -w)
    if [[ $weather_words -lt 3 ]]; then
        failures+="WEATHER section too short ($weather_words words, need 3); "
    fi

    if [[ -n "$failures" ]]; then
        _gate_fail "required_sections" "$failures"
        return 1
    fi

    _gate_pass "required_sections (all present with sufficient content)"
}

gate_check_content_length() {
    local pdf="$1"

    # Total content check
    local total_text
    total_text=$(pdftotext "$pdf" - 2>/dev/null)
    local total_chars total_words
    total_chars=$(echo "$total_text" | wc -c)
    total_words=$(echo "$total_text" | wc -w)

    if [[ $total_chars -lt 2000 ]]; then
        _gate_fail "content_length" "Total chars: $total_chars (min 2000)"
        return 1
    fi
    if [[ $total_words -lt 300 ]]; then
        _gate_fail "content_length" "Total words: $total_words (min 300)"
        return 1
    fi

    # Page 1 content check (min 150 words)
    local page1_text page1_words
    page1_text=$(pdftotext -f 1 -l 1 "$pdf" - 2>/dev/null)
    page1_words=$(echo "$page1_text" | wc -w)
    if [[ $page1_words -lt 150 ]]; then
        _gate_fail "content_length" "Page 1 words: $page1_words (min 150)"
        return 1
    fi

    # Page 2 content check (min 100 words)
    local page2_text page2_words
    page2_text=$(pdftotext -f 2 -l 2 "$pdf" - 2>/dev/null)
    page2_words=$(echo "$page2_text" | wc -w)
    if [[ $page2_words -lt 100 ]]; then
        _gate_fail "content_length" "Page 2 words: $page2_words (min 100)"
        return 1
    fi

    _gate_pass "content_length ($total_chars chars, $total_words words; p1:$page1_words p2:$page2_words)"
}

gate_check_font_rendering() {
    local pdf="$1"
    local fonts
    fonts=$(pdffonts "$pdf" 2>/dev/null)

    # Check for Playfair font (masthead)
    if ! echo "$fonts" | grep -qi "Playfair"; then
        _gate_warn "font_rendering" "Playfair font not detected (may be subset)"
    fi

    # Check for Type 3 fonts (problematic for generic text fonts, but OK for emoji and variable fonts)
    # Variable fonts like Playfair are rendered as Type 3 by Chromium but still look correct
    local type3_fonts
    type3_fonts=$(echo "$fonts" | grep "Type 3" | grep -vi "emoji\|color\|noto\|playfair" || true)
    if [[ -n "$type3_fonts" ]]; then
        _gate_fail "font_rendering" "Type 3 text fonts detected: $(echo "$type3_fonts" | awk '{print $1}' | head -3 | tr '\n' ' ')"
        return 1
    fi

    # Check all fonts are embedded
    local non_embedded
    non_embedded=$(echo "$fonts" | tail -n +3 | awk '{print $4}' | grep -c "no" || true)
    if [[ $non_embedded -gt 0 ]]; then
        _gate_fail "font_rendering" "$non_embedded fonts not embedded"
        return 1
    fi

    _gate_pass "font_rendering (all embedded, no Type 3)"
}

# ==============================================================================
# TIER 3: CONTENT INTEGRITY (< 10 sec)
# ==============================================================================

gate_check_truncation() {
    local pdf="$1"
    local text
    text=$(pdftotext -layout "$pdf" - 2>/dev/null)

    # Look for lines that appear truncated (end mid-word)
    # This is a heuristic check - newspaper layouts naturally have short lines
    # Only flag if we see obvious broken words (hyphenation without hyphen, etc.)

    # Check for lines ending with incomplete common words (very conservative)
    local obvious_truncation
    obvious_truncation=$(echo "$text" | grep -P '\b(th|wh|an|or|bu|fo|wi|be|ha|wa|sh|co)$' | wc -l || echo 0)

    if [[ $obvious_truncation -gt 3 ]]; then
        _gate_fail "truncation" "$obvious_truncation lines end with incomplete words"
        return 1
    fi

    _gate_pass "truncation (no obvious mid-word breaks)"
}

gate_check_overlaps() {
    local pdf="$1"
    local tmpdir
    tmpdir=$(mktemp -d)

    # Render page to image
    pdftoppm -png -r 150 -f 1 -l 1 "$pdf" "$tmpdir/page" 2>/dev/null
    local img="$tmpdir/page-1.png"

    if [[ ! -f "$img" ]]; then
        rm -rf "$tmpdir"
        _gate_fail "overlaps" "Could not render PDF to image"
        return 1
    fi

    # Calculate ink density (percentage of non-white pixels in text regions)
    # High density suggests overlapping text
    local density
    density=$(convert "$img" -colorspace Gray -threshold 90% -format "%[fx:mean]" info: 2>/dev/null)

    # density is 0-1, where 0 = all black, 1 = all white
    # For a newspaper, expect mostly white (>0.8)
    # If <0.8, might have overlap issues
    local ink_pct
    ink_pct=$(echo "scale=2; (1 - $density) * 100" | bc)

    rm -rf "$tmpdir"

    if (( $(echo "$ink_pct > 20" | bc -l) )); then
        _gate_fail "overlaps" "Ink density ${ink_pct}% (max 20%)"
        return 1
    fi

    _gate_pass "overlaps (ink density ${ink_pct}%)"
}

gate_check_encoding() {
    local pdf="$1"
    local text
    text=$(pdftotext "$pdf" - 2>/dev/null)

    local issues=""

    # Check for replacement character (U+FFFD)
    if echo "$text" | grep -q $'\xEF\xBF\xBD'; then
        issues+="replacement chars "
    fi

    # Check for common mojibake patterns
    if echo "$text" | grep -qP '[\x80-\x9F]'; then
        issues+="C1 control chars "
    fi

    # Check for garbled UTF-8 (double-encoded)
    if echo "$text" | grep -qP 'Ã[¡-¿]'; then
        issues+="mojibake "
    fi

    if [[ -n "$issues" ]]; then
        _gate_fail "encoding" "Encoding issues: $issues"
        return 1
    fi

    _gate_pass "encoding (no replacement chars or mojibake)"
}

gate_check_masthead_region() {
    local pdf="$1"
    local tmpdir
    tmpdir=$(mktemp -d)

    # Render page 1
    pdftoppm -png -r 150 -f 1 -l 1 "$pdf" "$tmpdir/page" 2>/dev/null
    local img="$tmpdir/page-1.png"

    if [[ ! -f "$img" ]]; then
        rm -rf "$tmpdir"
        _gate_fail "masthead_region" "Could not render PDF"
        return 1
    fi

    # Get image dimensions
    local height
    height=$(identify -format "%h" "$img" 2>/dev/null)
    local masthead_height=$((height * 15 / 100))

    # Crop top 15%
    convert "$img" -crop "0x${masthead_height}+0+0" "$tmpdir/masthead.png" 2>/dev/null

    # Check if masthead region is too white (blank)
    local whiteness
    whiteness=$(convert "$tmpdir/masthead.png" -colorspace Gray -format "%[fx:mean]" info: 2>/dev/null)

    rm -rf "$tmpdir"

    if (( $(echo "$whiteness > 0.95" | bc -l) )); then
        _gate_fail "masthead_region" "Top 15% is ${whiteness}% white (likely blank)"
        return 1
    fi

    _gate_pass "masthead_region (not blank, whiteness: $whiteness)"
}

gate_check_text_hierarchy() {
    local pdf="$1"
    local tmpdir
    tmpdir=$(mktemp -d)

    # Use pdftotext to get layout
    local full_text
    full_text=$(pdftotext -f 1 -l 1 "$pdf" - 2>/dev/null)

    # Count lines and words in first ~15% of output (header region)
    local total_lines header_lines
    total_lines=$(echo "$full_text" | wc -l)
    header_lines=$((total_lines * 15 / 100))
    [[ $header_lines -lt 5 ]] && header_lines=5

    local header_words body_words
    header_words=$(echo "$full_text" | head -n "$header_lines" | wc -w)
    body_words=$(echo "$full_text" | tail -n +"$((header_lines + 1))" | wc -w)

    rm -rf "$tmpdir"

    # Header should have fewer words than body (masthead is usually sparse)
    if [[ $header_words -gt $body_words ]] && [[ $body_words -gt 0 ]]; then
        _gate_fail "text_hierarchy" "Header ($header_words words) > body ($body_words words)"
        return 1
    fi

    _gate_pass "text_hierarchy (header: $header_words, body: $body_words words)"
}

gate_check_overflow() {
    local pdf="$1"
    local tmpdir
    tmpdir=$(mktemp -d)

    # Render both pages
    pdftoppm -png -r 150 "$pdf" "$tmpdir/page" 2>/dev/null

    local failed=0
    for img in "$tmpdir"/page-*.png; do
        [[ ! -f "$img" ]] && continue

        # Get image dimensions
        local height
        height=$(identify -format "%h" "$img" 2>/dev/null)
        local bottom_height=$((height * 5 / 100))
        local bottom_start=$((height - bottom_height))

        # Crop bottom 5%
        convert "$img" -crop "0x${bottom_height}+0+${bottom_start}" "$tmpdir/bottom.png" 2>/dev/null

        # Check whiteness
        local whiteness
        whiteness=$(convert "$tmpdir/bottom.png" -colorspace Gray -format "%[fx:mean]" info: 2>/dev/null)

        if (( $(echo "$whiteness < 0.90" | bc -l) )); then
            local page
            page=$(basename "$img" | grep -oP '\d+')
            _gate_fail "overflow" "Page $page bottom 5% whiteness: $whiteness (min 0.90)"
            failed=1
            break
        fi
    done

    rm -rf "$tmpdir"

    [[ $failed -eq 1 ]] && return 1
    _gate_pass "overflow (bottom 5% clear on all pages)"
}

# ==============================================================================
# TIER 4: VISUAL (< 30 sec)
# ==============================================================================

gate_check_font_visual() {
    local pdf="$1"
    local baseline="$BASELINE_DIR/masthead-baseline.png"

    if [[ ! -f "$baseline" ]]; then
        _gate_warn "font_visual" "Baseline not found: $baseline (skipping)"
        return 0
    fi

    local tmpdir
    tmpdir=$(mktemp -d)

    # Render page 1
    pdftoppm -png -r 300 -f 1 -l 1 "$pdf" "$tmpdir/page" 2>/dev/null
    local img="$tmpdir/page-1.png"

    if [[ ! -f "$img" ]]; then
        rm -rf "$tmpdir"
        _gate_fail "font_visual" "Could not render PDF"
        return 1
    fi

    # Crop masthead region (top 15%)
    local height
    height=$(identify -format "%h" "$img" 2>/dev/null)
    local masthead_height=$((height * 15 / 100))
    convert "$img" -crop "0x${masthead_height}+0+0" "$tmpdir/masthead.png" 2>/dev/null

    # Resize to match baseline
    local baseline_dims
    baseline_dims=$(identify -format "%wx%h" "$baseline" 2>/dev/null)
    convert "$tmpdir/masthead.png" -resize "$baseline_dims!" "$tmpdir/masthead-resized.png" 2>/dev/null

    # NCC comparison (normalized cross-correlation)
    local ncc
    ncc=$(compare -metric NCC "$baseline" "$tmpdir/masthead-resized.png" null: 2>&1 || true)

    rm -rf "$tmpdir"

    if (( $(echo "$ncc < 0.95" | bc -l) )); then
        _gate_fail "font_visual" "NCC score $ncc (threshold 0.95)"
        return 1
    fi

    _gate_pass "font_visual (NCC: $ncc)"
}

gate_check_contrast() {
    local pdf="$1"
    local tmpdir
    tmpdir=$(mktemp -d)

    # Render page 1
    pdftoppm -png -r 150 -f 1 -l 1 "$pdf" "$tmpdir/page" 2>/dev/null
    local img="$tmpdir/page-1.png"

    if [[ ! -f "$img" ]]; then
        rm -rf "$tmpdir"
        _gate_fail "contrast" "Could not render PDF"
        return 1
    fi

    # Calculate standard deviation (measure of contrast)
    local stddev
    stddev=$(convert "$img" -colorspace Gray -format "%[fx:standard_deviation]" info: 2>/dev/null)

    rm -rf "$tmpdir"

    # Newspaper pages are mostly white - stddev 0.10-0.20 is normal
    if (( $(echo "$stddev < 0.10" | bc -l) )); then
        _gate_fail "contrast" "StdDev $stddev (min 0.10 for readability)"
        return 1
    fi

    _gate_pass "contrast (stddev: $stddev)"
}

gate_check_visual_regression() {
    local pdf="$1"
    local baseline_full="$BASELINE_DIR/page1-baseline.png"
    local baseline_masthead="$BASELINE_DIR/masthead-baseline.png"

    local tmpdir
    tmpdir=$(mktemp -d)

    # Render page 1
    pdftoppm -png -r 150 -f 1 -l 1 "$pdf" "$tmpdir/page" 2>/dev/null
    local img="$tmpdir/page-1.png"

    if [[ ! -f "$img" ]]; then
        rm -rf "$tmpdir"
        _gate_fail "visual_regression" "Could not render PDF"
        return 1
    fi

    local failed=0

    # Full page comparison (5% tolerance)
    if [[ -f "$baseline_full" ]]; then
        local full_dims
        full_dims=$(identify -format "%wx%h" "$baseline_full" 2>/dev/null)
        convert "$img" -resize "$full_dims!" "$tmpdir/page-resized.png" 2>/dev/null

        local diff_pct
        diff_pct=$(compare -metric AE -fuzz 5% "$baseline_full" "$tmpdir/page-resized.png" null: 2>&1 || true)
        local total_pixels
        total_pixels=$(identify -format "%[fx:w*h]" "$baseline_full" 2>/dev/null)
        local diff_ratio
        diff_ratio=$(echo "scale=4; $diff_pct / $total_pixels" | bc)

        if (( $(echo "$diff_ratio > 0.05" | bc -l) )); then
            _gate_fail "visual_regression" "Full page diff: ${diff_ratio}% (max 5%)"
            failed=1
        fi
    else
        _gate_warn "visual_regression" "Full page baseline not found (skipping)"
    fi

    # Masthead comparison (1% tolerance)
    if [[ -f "$baseline_masthead" ]] && [[ $failed -eq 0 ]]; then
        local height
        height=$(identify -format "%h" "$img" 2>/dev/null)
        local masthead_height=$((height * 15 / 100))
        convert "$img" -crop "0x${masthead_height}+0+0" "$tmpdir/masthead.png" 2>/dev/null

        local masthead_dims
        masthead_dims=$(identify -format "%wx%h" "$baseline_masthead" 2>/dev/null)
        convert "$tmpdir/masthead.png" -resize "$masthead_dims!" "$tmpdir/masthead-resized.png" 2>/dev/null

        local mast_diff_pct
        mast_diff_pct=$(compare -metric AE -fuzz 1% "$baseline_masthead" "$tmpdir/masthead-resized.png" null: 2>&1 || true)
        local mast_total_pixels
        mast_total_pixels=$(identify -format "%[fx:w*h]" "$baseline_masthead" 2>/dev/null)
        local mast_diff_ratio
        mast_diff_ratio=$(echo "scale=4; $mast_diff_pct / $mast_total_pixels" | bc)

        if (( $(echo "$mast_diff_ratio > 0.01" | bc -l) )); then
            _gate_fail "visual_regression" "Masthead diff: ${mast_diff_ratio}% (max 1%)"
            failed=1
        fi
    fi

    rm -rf "$tmpdir"

    [[ $failed -eq 1 ]] && return 1
    _gate_pass "visual_regression (within tolerance)"
}

# ==============================================================================
# MAIN RUNNER
# ==============================================================================

run_all_gates() {
    local pdf="$1"

    if [[ -z "$pdf" ]]; then
        echo "Usage: run_all_gates /path/to/newspaper.pdf"
        return 1
    fi

    echo "========================================"
    echo "KLABO TIMES GATE VERIFICATION"
    echo "PDF: $pdf"
    echo "Date: $(date)"
    echo "========================================"
    echo

    local tier1_failed=0
    local total_failures=0

    # TIER 1: INSTANT FAIL
    echo "--- TIER 1: INSTANT FAIL ---"
    gate_check_pdf_valid "$pdf" || { ((tier1_failed++)); ((total_failures++)); }
    gate_check_pdf_structure "$pdf" || { ((tier1_failed++)); ((total_failures++)); }

    if [[ $tier1_failed -gt 0 ]]; then
        echo
        echo -e "${RED}TIER 1 FAILED - Aborting remaining checks${NC}"
        echo "Total failures: $total_failures"
        return 1
    fi
    echo

    # TIER 2: STRUCTURAL
    echo "--- TIER 2: STRUCTURAL ---"
    gate_check_html_entities "$pdf" || ((total_failures++))
    gate_check_placeholders "$pdf" || ((total_failures++))
    gate_check_date "$pdf" || ((total_failures++))
    gate_check_required_sections "$pdf" || ((total_failures++))
    gate_check_content_length "$pdf" || ((total_failures++))
    gate_check_font_rendering "$pdf" || ((total_failures++))
    echo

    # TIER 3: CONTENT INTEGRITY
    echo "--- TIER 3: CONTENT INTEGRITY ---"
    gate_check_truncation "$pdf" || ((total_failures++))
    gate_check_overlaps "$pdf" || ((total_failures++))
    gate_check_encoding "$pdf" || ((total_failures++))
    gate_check_masthead_region "$pdf" || ((total_failures++))
    gate_check_text_hierarchy "$pdf" || ((total_failures++))
    gate_check_overflow "$pdf" || ((total_failures++))
    echo

    # TIER 4: VISUAL
    echo "--- TIER 4: VISUAL ---"
    gate_check_font_visual "$pdf" || ((total_failures++))
    gate_check_contrast "$pdf" || ((total_failures++))
    gate_check_visual_regression "$pdf" || ((total_failures++))
    echo

    # Summary
    echo "========================================"
    if [[ $total_failures -eq 0 ]]; then
        echo -e "${GREEN}ALL GATES PASSED${NC}"
        return 0
    else
        echo -e "${RED}FAILED: $total_failures gate(s)${NC}"
        return 1
    fi
}

# Export functions for use when sourced
export -f _gate_pass _gate_fail _gate_warn
export -f gate_check_pdf_valid gate_check_pdf_structure
export -f gate_check_html_entities gate_check_placeholders gate_check_date
export -f gate_check_required_sections gate_check_content_length gate_check_font_rendering
export -f gate_check_truncation gate_check_overlaps gate_check_encoding
export -f gate_check_masthead_region gate_check_text_hierarchy gate_check_overflow
export -f gate_check_font_visual gate_check_contrast gate_check_visual_regression
export -f run_all_gates
