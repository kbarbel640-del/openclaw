# MassiveNet Provider Node (plugin)

This plugin turns an OpenClaw runtime into a thin MassiveNet provider-node worker.

It does not embed MassiveNet internals, scheduler policy, or economic logic.
It only:

- validates node identity (`GET /v1/nodes/me`)
- heartbeats (`POST /v1/nodes/heartbeat`)
- polls work (`POST /v1/nodes/poll`)
- fetches payload references when needed
- executes locally (`stub` or `http` executor)
- reports completion with MassiveNet HMAC callback auth (`POST /internal/jobs/complete`)

For full configuration and run instructions, see `docs/plugins/massivenet-provider-node.md`.
