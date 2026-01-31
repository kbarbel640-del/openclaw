---
name: pomodoro
description: Pomodoro technique timers for focused work sessions.
metadata: { "openclaw": { "emoji": "🍅" } }
---

# Pomodoro Timer

Time management using the Pomodoro Technique.

## Quick Start

Start a focus session:

```bash
# macOS: 25-minute focus timer with notification
( sleep 1500 && osascript -e 'display notification "Focus session complete! Time for a break." with title "🍅 Pomodoro"' ) &
echo "Started 25-minute pomodoro. Focus!"

# Linux: same with notify-send
( sleep 1500 && notify-send "🍅 Pomodoro" "Focus session complete! Time for a break." ) &
echo "Started 25-minute pomodoro. Focus!"
```

## Commands

### Focus Session (25 min default)

```bash
# macOS
MINUTES=${1:-25}
( sleep $((MINUTES * 60)) && osascript -e "display notification \"$MINUTES-minute session complete!\" with title \"🍅 Pomodoro\"" ) &
echo "Started $MINUTES-minute focus session."

# Linux
MINUTES=${1:-25}
( sleep $((MINUTES * 60)) && notify-send "🍅 Pomodoro" "$MINUTES-minute session complete!" ) &
echo "Started $MINUTES-minute focus session."
```

### Short Break (5 min)

```bash
# macOS
( sleep 300 && osascript -e 'display notification "Break over! Ready to focus?" with title "☕ Break Complete"' ) &
echo "Short break started. Relax for 5 minutes."

# Linux
( sleep 300 && notify-send "☕ Break Complete" "Break over! Ready to focus?" ) &
echo "Short break started. Relax for 5 minutes."
```

### Long Break (15-30 min)

```bash
# macOS (15 min)
( sleep 900 && osascript -e 'display notification "Long break over! Start a new cycle?" with title "🌴 Long Break"' ) &
echo "Long break started. Enjoy 15 minutes of rest."

# Linux (15 min)
( sleep 900 && notify-send "🌴 Long Break" "Long break over! Start a new cycle?" ) &
echo "Long break started. Enjoy 15 minutes of rest."
```

## The Pomodoro Cycle

1. 🍅 **Focus**: Work for 25 minutes
2. ☕ **Short Break**: Rest for 5 minutes
3. Repeat steps 1-2 four times
4. 🌴 **Long Break**: Rest for 15-30 minutes
5. Start a new cycle

## Tips

- Remove distractions during focus sessions
- Use breaks to stretch, hydrate, or rest your eyes
- Track completed pomodoros to measure productivity
- Adjust times to fit your rhythm (some prefer 50/10 or 90/20)

## Advanced: Using cron

For recurring reminders, use OpenClaw's cron:

```
/cron set pomodoro-reminder "0 9 * * 1-5" "Remind me to start a pomodoro session"
```

## Notes

- Notifications work on macOS (osascript) and Linux (notify-send)
- Background processes (`&`) allow the timer to run while you work
- For Windows, use `powershell` with `New-BurntToastNotification` or similar
