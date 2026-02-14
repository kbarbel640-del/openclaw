# Dispatch API

`dispatch-api` is the enforcement service for all dispatch mutations.

## Runtime entrypoint

- `dispatch/api/src/server.mjs`

Start locally:

```bash
node dispatch/api/src/server.mjs
```

## Implemented command endpoints

- `POST /tickets`
- `POST /tickets/{ticketId}/triage`
- `POST /tickets/{ticketId}/schedule/confirm`
- `POST /tickets/{ticketId}/assignment/dispatch`
- `POST /tickets/{ticketId}/evidence`
- `POST /tickets/{ticketId}/tech/complete`

## Implemented read endpoints

- `GET /tickets/{ticketId}/timeline`
- `GET /tickets/{ticketId}/evidence`
- `GET /metrics`

Each command endpoint currently requires deterministic dev headers:

- `Idempotency-Key` (UUID, required)
- `X-Actor-Id` (required)
- `X-Actor-Role` (required)
- `X-Tool-Name` (optional; default is endpoint tool mapping)

## Guarantees

- fail-closed request validation
- idempotency replay (`actor_id + endpoint + request_id`)
- payload mismatch conflict (`409`)
- ticket mutation + audit event + state transition row on success
- structured request logs for success/error paths with `request_id`, `correlation_id`, and `trace_id`
- in-memory metrics snapshot export for requests/errors/transitions (`GET /metrics`)

## Current gaps

- production authn/authz claims middleware
- remaining command/read endpoints from full v0 OpenAPI
