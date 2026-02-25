# Gmail Pub/Sub -> Clawdbot (gogcli)

Source: docs/automation/gmail-pubsub.md.

## Prereqs

- gcloud + gogcli installed and authenticated
- hooks enabled in ~/.clawdbot/clawdbot.json
- Tailscale logged in for supported push (Funnel)

## Minimal hook enablement

```json5
{
  hooks: {
    enabled: true,
    token: "CLAWDBOT_HOOK_TOKEN",
    path: "/hooks",
    presets: ["gmail"],
  },
}
```

## Recommended flow

- Use wizard:
  - clawdbot hooks gmail setup --account <email>
- Gateway auto-starts watcher when hooks.gmail.account is set.
- Manual daemon:
  - clawdbot hooks gmail run

## One-time setup (manual)

1. gcloud auth login
2. gcloud config set project <project-id>
3. gcloud services enable gmail.googleapis.com pubsub.googleapis.com
4. gcloud pubsub topics create gog-gmail-watch
5. gcloud pubsub topics add-iam-policy-binding gog-gmail-watch \
   --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
   --role=roles/pubsub.publisher

## Start watch

```bash
gog gmail watch start \
  --account <email> \
  --label INBOX \
  --topic projects/<project-id>/topics/gog-gmail-watch
```

## Serve handler

- Use gog gmail watch serve (wrapped by clawdbot hooks gmail run).
- If using tailscale mode, Clawdbot manages paths to avoid Funnel prefix stripping.
