# WhatsApp provider quick reference

Source: local Clawdbot docs at docs/providers/whatsapp.md, docs/concepts/group-messages.md, docs/concepts/multi-agent.md, docs/gateway/configuration.md.

## Key facts

- WhatsApp runs via Baileys. The Gateway owns the WhatsApp session(s).
- Default DM policy is pairing; unknown senders receive a pairing code until approved.
- Credentials live at ~/.clawdbot/credentials/whatsapp/<accountId>/creds.json.

## Minimal safe config

```json5
{
  whatsapp: {
    dmPolicy: "allowlist",
    allowFrom: ["+15551234567"],
  },
}
```

## Pairing flow (recommended for bulletproof access control)

- Keep dmPolicy = "pairing" (default).
- Approve codes:
  - list: clawdbot pairing list whatsapp
  - approve: clawdbot pairing approve whatsapp <code>

## Personal number fallback

- If running on your own WhatsApp number, enable selfChatMode and allow your own E.164.
- Sample:

```json5
{
  whatsapp: {
    selfChatMode: true,
    dmPolicy: "allowlist",
    allowFrom: ["+15551234567"],
  },
  messages: {
    responsePrefix: "[clawdbot]",
  },
}
```

## Groups

- Group policy: whatsapp.groupPolicy = open | disabled | allowlist (default allowlist).
- Use whatsapp.groups for group allowlist + default activation behavior.
- When _.groups is set, include "_" to allow all groups while still setting defaults.

## Multi-agent routing (WhatsApp DMs)

- Bind each sender’s DM to a different agentId using routing bindings.
- Replies still come from the same WhatsApp account; dmPolicy/allowFrom is global.
- Example bindings:

```json5
{
  routing: {
    bindings: [
      {
        agentId: "alex",
        match: { provider: "whatsapp", peer: { kind: "dm", id: "+15551230001" } },
      },
      { agentId: "mia", match: { provider: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
    ],
  },
}
```

## Account login

- QR login: clawdbot providers login
- Multi-account: clawdbot providers login --account <accountId>
