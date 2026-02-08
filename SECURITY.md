# Security Policy

Real Dispatch handles operational service data (customer details, technician updates, onsite evidence, and billing artifacts).
Security defaults are restrictive by design.

## Reporting

If you discover a security issue, report it privately through this repository’s GitHub Security Advisories flow:

- [https://github.com/bankszach/real-dispatch/security/advisories/new](https://github.com/bankszach/real-dispatch/security/advisories/new)

Include reproduction steps, affected surfaces, and realistic impact.

## Security posture

- **System-of-record first:** canonical state lives in structured storage (database + object store), not model memory.
- **Closed toolset:** production agents only use explicitly allowlisted tools.
- **Least privilege:** each agent role has scope-limited permissions.
- **No public skill marketplace:** third-party/public skill loading is disabled by policy.
- **No arbitrary shell/OS access by default:** execution capabilities are denied unless explicitly enabled for controlled operators.
- **Full audit trail:** every state-changing action must emit an attributable event.

## Required controls

- Authenticate all operator and service-plane access.
- Gate and sanitize inbound channel payloads before dispatch actions.
- Enforce tenant/customer boundaries in reads and writes.
- Persist immutable audit events for ticket lifecycle changes.
- Require evidence validation before closeout completion.

## Out of scope

The following are out of scope for supported deployments and bug reports:

- Deployments that intentionally expose privileged control surfaces to the public internet without access controls.
- Custom forks that enable arbitrary execution or unrestricted tool loading.
- Environments where audit logging and persistent storage are disabled.

## Runtime baseline

- Node.js **22+**.
- Keep dependencies patched via normal update process.

## Secure deployment guidance

- Bind local control interfaces to loopback unless a hardened remote access layer is in place.
- Run services with least-privileged OS users.
- Encrypt secrets at rest and in transit.
- Use short-lived credentials where possible.
- Back up the database and object storage; periodically test restore workflows.

## Verification

Before production rollout, verify:

- role-to-tool permissions are enforced
- unauthorized action attempts are denied and audited
- closeout packets cannot finalize with missing required evidence
- operator actions are traceable in the audit log
