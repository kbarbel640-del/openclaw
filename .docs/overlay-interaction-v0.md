# Overlay Interaction V0 (Compact Desktop)

## Compact Card (default)
- Top row: `Giri` + state pill (`Listening`, `Thinking`, `Calling`, `Booking`, `Done`)
- Middle: one-line current step text
- Bottom: tiny timeline dots (`prefs` -> `venue` -> `shubham` -> `booking`)

## Expand Card (on click)
- Section: current plan steps with status
- Section: latest transcript snippets (local + tool/call)
- Section: final action cards (map link, calendar add)
- Optional toggle: `Show Internal State`

## Interaction Rules
- Overlay never blocks active app input.
- Voice trigger or shortcut opens compact card.
- Auto-collapse after inactivity when flow reaches `Done`.
- Manual pin keeps expanded state.

## Required Backend Signals
- Session status (`active`, `awaiting_confirmation`, `completed`, `timed_out`)
- Current step text
- Latest summary line
- Booking result payload (venue, time, grace period)
