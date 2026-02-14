# Giri Demo Scope (Backend)

## Agreed Scope
- Platform: macOS desktop demo.
- UI: compact overlay only.
- Overlay should not display location explicitly.
- Primary demo remains evening planning + social coordination.
- Booking path uses Swiggy Dineout integration with fixture fallback for deterministic demos.

## Backend Strategy
- Build as OpenClaw extension: `extensions/evening-planner`.
- Keep orchestration deterministic for demo reliability:
  - multi-turn Shubham coordination in Telegram conversation,
  - timeout fallback to solo booking,
  - explicit final confirmation before booking execution.
- Expose tool actions for agent orchestration and frontend control.

## Current Limitation (Known)
- Real PSTN/phone-call automation is not yet wired in this backend pass.
- Current coordination is implemented via chat reply ingestion on Telegram events.
- We can add a call-provider bridge next (Twilio/SIM provider/macOS native) after frontend overlay and flow are stable.

## Next Phase Candidates
- Native call bridge (`call_contact`, `call_restaurant`) with live transcript feed.
- Calendar event tool (`add_calendar_event`) for post-booking action.
- Map deep-link generation per final venue.
