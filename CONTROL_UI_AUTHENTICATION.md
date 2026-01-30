# Control UI Authentication (Docker)

If you bind the gateway to anything other than loopback (Docker uses `lan`), the Control UI needs a gateway token.

## Working Setup

1) Open the dashboard with a token:

```text
http://localhost:18789/?token=<YOUR_GATEWAY_TOKEN>
```

2) If it redirects to `/chat` and still looks disconnected:

- Go to `Overview`
- Confirm `WebSocket URL` is `ws://localhost:18789`
- Paste the token into `Gateway Token`
- Click `Connect`

## Troubleshooting

- Tail logs:

```bash
docker logs -f clawdbot-gateway
```

- If you see `unauthorized: gateway token missing`, you’re not sending the token.

## Notes

- The Control UI runs in your browser but connects over WebSocket; the token is provided during the WebSocket handshake.
- We keep `gateway.controlUi.allowInsecureAuth=true` so token auth works over plain `http://` locally.
