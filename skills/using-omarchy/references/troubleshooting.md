# Troubleshooting

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/88/troubleshooting
```

## Common fixes

- Update broke system: roll back snapshot; if needed run `omarchy-debug` and share in Discord; last resort: `omarchy-reinstall`.
- Oversized apps: adjust `GDK_SCALE` in `~/.config/hypr/hyprland.conf` (1x vs 2x).
- Caps Lock used for xcompose: change `kb_options` in `~/.config/hypr/input.conf` (example `compose:ralt`).
- External speakers: select default output in waybar audio controls.
- Login/sudo lockout: use TTY (Ctrl + Alt + F2), then `faillock --reset --user <username>`.
- 1Password prompts: enable hardware acceleration and reboot; also launch 1Password after boot.
