# Evening Planner Backend Contract

## Extension
- Plugin ID: `evening-planner`
- Main entry: `extensions/evening-planner/index.ts`
- Persistent state file: `plugins/evening-planner/sessions.json` under OpenClaw state dir.

## Tool Name
- `evening_planner`

## Tool Actions
- `start_session`
  - required: `conversationId`
  - optional: `timeoutSec`, `maxTurns`, `shubhamSenderId`, `shubhamUsername`, `shubhamDisplayName`, `sendInitialPrompt`, `initialPrompt`, `userDisplayName`
- `list_sessions`
- `status`
  - required: `sessionId`
- `cancel_session`
  - required: `sessionId`
- `ingest_reply`
  - required: `sessionId`, `text`
- `search_venues`
  - required: `query`
  - optional: `location`
- `check_slots`
  - required: `restaurantId`, `date`
- `prepare_booking`
  - required: `sessionId`, `restaurantId`, `date`, `time`
  - optional: `restaurantName`, `guests`
- `book_table`
  - required: `sessionId`
  - optional: `confirm` (must be `true` to execute)

## Gateway Methods
- `eveningplanner.list`
- `eveningplanner.status` (requires `sessionId`)

## Session State (important fields)
- `status`: `active` | `awaiting_confirmation` | `completed` | `timed_out` | `cancelled`
- `shubhamAvailability`: `unknown` | `yes` | `no` | `maybe`
- `etaMinutes`: number or absent
- `followUpsAsked`: number
- `bookingDraft`: prepared booking command + payload
- `bookingResult`: `none` | `prepared` | `booked` | `failed`

## Conversation Behavior
- Initial prompt does not consume follow-up budget.
- Follow-ups attempt to collect:
  - attendance (yes/no),
  - ETA if joining.
- If unresolved by turn limit or timeout, deterministic fallback is solo booking.

## Frontend Integration Notes
- Minimal UI loop for desktop overlay:
  1. Trigger `start_session`.
  2. Poll `eveningplanner.status`.
  3. Render timeline/status chips.
  4. After `awaiting_confirmation`, call `prepare_booking`.
  5. Show final confirmation CTA -> `book_table(confirm=true)`.
- Recommended UI states:
  - `Listening`
  - `Planning`
  - `Coordinating`
  - `Awaiting Confirmation`
  - `Booking`
  - `Done`
