# Navigation Patterns

Reusable bash patterns for common simulator navigation tasks.

## Wait for Element

```bash
wait_for_element() {
  local LABEL="$1"
  local UDID="$2"
  local MAX_ATTEMPTS="${3:-10}"

  for i in $(seq 1 $MAX_ATTEMPTS); do
    if axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | grep -q "\"AXLabel\":\"$LABEL\""; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# Usage
if wait_for_element "Submit" $UDID 20; then
  axe tap --label "Submit" --udid $UDID
else
  echo "Element never appeared"
fi
```

## Navigate and Verify

```bash
axe tap --label "Settings" --post-delay 0.5 --udid $UDID

if axe describe-ui --udid $UDID 2>&1 | grep -q '"AXLabel":"General"'; then
  echo "Successfully navigated to Settings"
else
  echo "Navigation failed - General not found"
fi
```

## Back Navigation

The swipe-from-left-edge gesture is unreliable. Prefer tapping the back button.

```bash
# Method 1: Tap back button in top-left safe zone
axe tap -x 40 -y 70 --udid $UDID

# Method 2: Find back button dynamically
BACK=$(axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | \
  jq '[.[] | .. | objects | select(.frame.y < 100 and .frame.x < 100 and .AXLabel != null and .type == "Button")] | .[0]')

if [ "$BACK" != "null" ]; then
  X=$(echo $BACK | jq '.frame.x + (.frame.width / 2)')
  Y=$(echo $BACK | jq '.frame.y + (.frame.height / 2)')
  axe tap -x $X -y $Y --udid $UDID
fi
```

## Scroll Until Element Visible

```bash
scroll_to_element() {
  local LABEL="$1"
  local UDID="$2"
  local MAX_SCROLLS="${3:-10}"
  local SCREEN_WIDTH="${4:-393}"
  local SCREEN_HEIGHT="${5:-852}"
  local CENTER_X=$((SCREEN_WIDTH / 2))

  for i in $(seq 1 $MAX_SCROLLS); do
    if axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | grep -q "\"AXLabel\":\"$LABEL\""; then
      return 0
    fi
    axe swipe --start-x $CENTER_X --start-y $((SCREEN_HEIGHT * 3/4)) --end-x $CENTER_X --end-y $((SCREEN_HEIGHT / 4)) --duration 0.5 --udid $UDID
    sleep 0.3
  done
  return 1
}

# Usage
if scroll_to_element "Privacy & Security" $UDID; then
  axe tap --label "Privacy & Security" --udid $UDID
fi
```

## Extract Element Coordinates

```bash
get_element_center() {
  local LABEL="$1"
  local UDID="$2"

  axe describe-ui --udid $UDID 2>&1 | grep -v "objc" | \
    jq -r --arg label "$LABEL" '
      [.[] | .. | objects | select(.AXLabel == $label)] | .[0] |
      if . then "\(.frame.x + .frame.width/2),\(.frame.y + .frame.height/2)" else "not_found" end
    '
}

# Usage
COORDS=$(get_element_center "Submit" $UDID)
if [ "$COORDS" != "not_found" ]; then
  X=$(echo $COORDS | cut -d',' -f1)
  Y=$(echo $COORDS | cut -d',' -f2)
  axe tap -x $X -y $Y --udid $UDID
fi
```
