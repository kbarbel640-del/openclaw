#!/bin/bash
# Calendar helper — wraps icalBuddy for clean structured output
# Usage: cal.sh <command> [args]
#   today              — today's events
#   upcoming [N]       — next N days (default 7)
#   next               — next upcoming event
#   free               — free time blocks today
#   week               — week overview

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Try ICS feed first (work calendar), fall back to icalBuddy
try_ics() {
    local cmd="$1"
    shift
    if python3 "$SCRIPT_DIR/parse_ics.py" "$cmd" "$@" 2>/dev/null; then
        return 0
    fi
    return 1
}

ICAL="/opt/homebrew/bin/icalBuddy"
CALENDARS="Wrk,Work,Private - google,Home,Holiday,P&T,Calendaraar"
WORK_HOURS_START=9
WORK_HOURS_END=17

# Regex patterns (stored in variables to avoid bash parsing issues)
RE_CAL_SUFFIX='^(.*)[[:space:]]+\(([^)]+)\)[[:space:]]*$'

# Parse icalBuddy output (with -b '' -nrd, no -nc so calendar names show)
# Title lines: not indented, may have " (CalName)" suffix
# Property lines: indented with 4 spaces
parse_events() {
    local title="" loc="" time_str="" cal=""
    local first=true

    while IFS= read -r line; do
        # Indented line = property of current event
        if [[ "$line" =~ ^[[:space:]]{4}(.*) ]]; then
            local prop="${BASH_REMATCH[1]}"
            if [[ "$prop" =~ ^location:[[:space:]]*(.*) ]]; then
                loc="${BASH_REMATCH[1]}"
            elif [[ "$prop" =~ ^([0-9]{2}:[0-9]{2})[[:space:]]+-[[:space:]]+([0-9]{2}:[0-9]{2}) ]]; then
                time_str="${BASH_REMATCH[1]} - ${BASH_REMATCH[2]}"
            fi
        # Non-indented non-empty line = new event title
        elif [[ -n "$line" && ! "$line" =~ ^[[:space:]] ]]; then
            # Output previous event
            if [[ -n "$title" ]]; then
                emit_event "$title" "$time_str" "$loc" "$cal"
            fi
            # Parse calendar name from end: "Title (CalName)"
            if [[ "$line" =~ $RE_CAL_SUFFIX ]]; then
                title="${BASH_REMATCH[1]}"
                cal="${BASH_REMATCH[2]}"
            else
                title="$line"
                cal="?"
            fi
            loc=""
            time_str=""
        fi
    done
    # Output last event
    if [[ -n "$title" ]]; then
        emit_event "$title" "$time_str" "$loc" "$cal"
    fi
}

emit_event() {
    local title="$1" time_str="$2" loc="$3" cal="$4"

    # Skip cancelled
    if [[ "$title" =~ ^[Cc]ancel ]]; then
        return
    fi

    # Map calendar name
    local cal_label="Personal"
    case "$cal" in
        Wrk|Work) cal_label="Work" ;;
        "P&T") cal_label="Personal" ;;
        "Private - google") cal_label="Personal" ;;
        Home) cal_label="Home" ;;
        Holiday|"UK Holidays") cal_label="Holiday" ;;
        Calendaraar) cal_label="Personal" ;;
    esac

    # Extract meeting link
    local link=""
    if [[ "$loc" =~ (https://[^[:space:]]*zoom\.us/j/[^[:space:]]*) ]]; then
        link="${BASH_REMATCH[1]}"
    elif [[ "$loc" =~ (https://teams\.microsoft\.com/[^[:space:]]*) ]]; then
        link="${BASH_REMATCH[1]}"
    elif [[ "$loc" =~ (https://meet\.google\.com/[^[:space:]]*) ]]; then
        link="${BASH_REMATCH[1]}"
    fi

    local t="${time_str:-all-day}"

    if [[ -n "$link" ]]; then
        echo "${t} | ${cal_label} | ${title} | ${link}"
    else
        echo "${t} | ${cal_label} | ${title}"
    fi
}

get_events() {
    $ICAL -nrd -b '' -ic "$CALENDARS" "$@" 2>/dev/null
}

cmd_today() {
    local raw
    raw=$(get_events eventsToday)
    if [[ -z "$raw" ]]; then
        echo "No events today."
        return
    fi
    echo "📅 Today's Events"
    echo "---"
    echo "$raw" | parse_events
}

cmd_upcoming() {
    local days="${1:-7}"
    local raw
    raw=$($ICAL -nrd -b '' -sd -ic "$CALENDARS" "eventsToday+${days}" 2>/dev/null)
    if [[ -z "$raw" ]]; then
        echo "No events in the next ${days} days."
        return
    fi
    echo "📅 Next ${days} Days"
    echo "---"
    # Process line by line, handling date headers and separator lines
    local title="" loc="" time_str="" cal=""
    while IFS= read -r line; do
        # Date header (e.g. "16 Feb 2026:")
        if [[ "$line" =~ ^[0-9]+[[:space:]].*:$ ]]; then
            # Output previous event
            if [[ -n "$title" ]]; then
                emit_event "$title" "$time_str" "$loc" "$cal"
                title="" loc="" time_str="" cal=""
            fi
            echo ""
            echo "### ${line%:}"
            continue
        fi
        # Separator line
        [[ "$line" =~ ^---+ ]] && continue
        # Indented = property
        if [[ "$line" =~ ^[[:space:]]{4}(.*) ]]; then
            local prop="${BASH_REMATCH[1]}"
            if [[ "$prop" =~ ^location:[[:space:]]*(.*) ]]; then
                loc="${BASH_REMATCH[1]}"
            elif [[ "$prop" =~ ^([0-9]{2}:[0-9]{2})[[:space:]]+-[[:space:]]+([0-9]{2}:[0-9]{2}) ]]; then
                time_str="${BASH_REMATCH[1]} - ${BASH_REMATCH[2]}"
            fi
        # Non-indented non-empty = event title
        elif [[ -n "$line" && ! "$line" =~ ^[[:space:]] ]]; then
            if [[ -n "$title" ]]; then
                emit_event "$title" "$time_str" "$loc" "$cal"
            fi
            if [[ "$line" =~ $RE_CAL_SUFFIX ]]; then
                title="${BASH_REMATCH[1]}"
                cal="${BASH_REMATCH[2]}"
            else
                title="$line"
                cal="?"
            fi
            loc="" time_str=""
        fi
    done <<< "$raw"
    if [[ -n "$title" ]]; then
        emit_event "$title" "$time_str" "$loc" "$cal"
    fi
}

cmd_next() {
    local now_h now_m now_minutes
    now_h=$(date +%H); now_m=$(date +%M)
    now_minutes=$(( 10#$now_h * 60 + 10#$now_m ))

    local raw
    raw=$(get_events eventsToday)
    if [[ -z "$raw" ]]; then
        echo "No more events today."
        return
    fi

    # Find first event starting after now
    local title="" loc="" time_str="" cal="" found=false

    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]{4}(.*) ]]; then
            local prop="${BASH_REMATCH[1]}"
            if [[ "$prop" =~ ^location:[[:space:]]*(.*) ]]; then
                loc="${BASH_REMATCH[1]}"
            elif [[ "$prop" =~ ^([0-9]{2}):([0-9]{2})[[:space:]]+-[[:space:]]+([0-9]{2}:[0-9]{2}) ]]; then
                time_str="${BASH_REMATCH[1]}:${BASH_REMATCH[2]} - ${BASH_REMATCH[3]}"
                local evt_min=$(( 10#${BASH_REMATCH[1]} * 60 + 10#${BASH_REMATCH[2]} ))
                if (( evt_min > now_minutes )) && [[ "$found" != true ]]; then
                    found=true
                fi
            fi
        elif [[ -n "$line" && ! "$line" =~ ^[[:space:]] ]]; then
            if [[ "$found" == true ]]; then
                # We already found the next event, output it
                emit_event "$title" "$time_str" "$loc" "$cal"
                return
            fi
            if [[ "$line" =~ $RE_CAL_SUFFIX ]]; then
                title="${BASH_REMATCH[1]}"
                cal="${BASH_REMATCH[2]}"
            else
                title="$line"
                cal="?"
            fi
            loc=""
            time_str=""
        fi
    done <<< "$raw"

    # Check last event
    if [[ "$found" == true ]]; then
        emit_event "$title" "$time_str" "$loc" "$cal"
    else
        echo "No more events today."
    fi
}

cmd_free() {
    local raw
    raw=$(get_events eventsToday)

    echo "🕐 Free Time Blocks Today (${WORK_HOURS_START}:00-${WORK_HOURS_END}:00)"
    echo "---"

    if [[ -z "$raw" ]]; then
        printf "%02d:00 - %02d:00 (all day free)\n" $WORK_HOURS_START $WORK_HOURS_END
        return
    fi

    # Collect busy intervals
    local -a starts=() ends=()
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]+([0-9]{2}):([0-9]{2})[[:space:]]+-[[:space:]]+([0-9]{2}):([0-9]{2}) ]]; then
            starts+=("$(( 10#${BASH_REMATCH[1]} * 60 + 10#${BASH_REMATCH[2]} ))")
            ends+=("$(( 10#${BASH_REMATCH[3]} * 60 + 10#${BASH_REMATCH[4]} ))")
        fi
    done <<< "$raw"

    local n=${#starts[@]}
    if (( n == 0 )); then
        printf "%02d:00 - %02d:00 (all day free)\n" $WORK_HOURS_START $WORK_HOURS_END
        return
    fi

    # Sort by start
    for (( i=0; i<n-1; i++ )); do
        for (( j=0; j<n-i-1; j++ )); do
            if (( starts[j] > starts[j+1] )); then
                local tmp=${starts[j]}; starts[j]=${starts[j+1]}; starts[j+1]=$tmp
                tmp=${ends[j]}; ends[j]=${ends[j+1]}; ends[j+1]=$tmp
            fi
        done
    done

    local cursor=$(( WORK_HOURS_START * 60 ))
    local end_of_day=$(( WORK_HOURS_END * 60 ))
    local has_free=false

    for (( i=0; i<n; i++ )); do
        local s=${starts[i]} e=${ends[i]}
        (( s < WORK_HOURS_START * 60 )) && s=$((WORK_HOURS_START * 60))
        (( e > end_of_day )) && e=$end_of_day
        (( s < cursor )) && s=$cursor

        if (( s > cursor )); then
            local dur=$(( s - cursor ))
            printf "%02d:%02d - %02d:%02d (%d min)\n" $((cursor/60)) $((cursor%60)) $((s/60)) $((s%60)) $dur
            has_free=true
        fi
        (( e > cursor )) && cursor=$e
    done

    if (( cursor < end_of_day )); then
        local dur=$(( end_of_day - cursor ))
        printf "%02d:%02d - %02d:%02d (%d min)\n" $((cursor/60)) $((cursor%60)) $((end_of_day/60)) $((end_of_day%60)) $dur
        has_free=true
    fi

    if [[ "$has_free" != true ]]; then
        echo "No free blocks during work hours."
    fi
}

cmd_week() {
    echo "📅 Week Overview"
    echo "---"
    local raw
    raw=$($ICAL -nrd -b '• ' -sd -ic "$CALENDARS" 'eventsToday+6' 2>/dev/null || true)
    
    if [[ -z "$raw" ]]; then
        echo "No events this week."
        return
    fi
    
    local current_date="" count=0
    while IFS= read -r line; do
        # Date header: "16 Feb 2026:" or similar
        if [[ "$line" =~ ^[0-9]+[[:space:]] ]] && [[ "$line" =~ :$ ]]; then
            if [[ -n "$current_date" ]]; then
                echo "${current_date} ${count} events"
            fi
            current_date="${line%:}"
            count=0
        # Separator line
        elif [[ "$line" =~ ^---+ ]]; then
            continue
        # Event line (starts with •)
        elif [[ "$line" =~ ^"• " ]]; then
            # Skip cancelled
            if [[ ! "$line" =~ [Cc]ancel ]]; then
                (( count++ ))
            fi
        fi
    done <<< "$raw"
    # Last day
    if [[ -n "$current_date" ]]; then
        echo "${current_date} ${count} events"
    fi
}

case "${1:-today}" in
    today)    try_ics today    || cmd_today ;;
    upcoming) try_ics upcoming "${2:-7}" || cmd_upcoming "${2:-7}" ;;
    next)     try_ics next     || cmd_next ;;
    free)     try_ics free     || cmd_free ;;
    week)     try_ics week     || cmd_week ;;
    *)        echo "Usage: cal.sh {today|upcoming [N]|next|free|week}" ;;
esac
