---
name: using-omarchy
description: Guides setup, customization, updates, and troubleshooting for Omarchy (Arch + Hyprland). Use when installing Omarchy, changing hotkeys/themes, editing Omarchy configs, managing updates/snapshots, or resolving Omarchy-specific issues.
invocation: user
arguments: "[install|config|hotkeys|themes|update|snapshot|troubleshoot]"
---

# Using Omarchy

## Quick Reference

| Task              | Command/Path                                            |
| ----------------- | ------------------------------------------------------- |
| Open launcher     | Super + Space                                           |
| Open Omarchy menu | Super + Alt + Space                                     |
| Show keybindings  | Super + K                                               |
| Screenshot        | Print Screen (runs `omarchy-cmd-screenshot`)            |
| Update Omarchy    | Omarchy menu > Update > Omarchy                         |
| Switch channel    | Omarchy menu > Update > Channel                         |
| Create snapshot   | `omarchy-snapshot create`                               |
| Restore snapshot  | `omarchy-snapshot restore` (or boot snapshot in Limine) |
| Reinstall Omarchy | `omarchy-reinstall`                                     |
| Debug bundle      | `omarchy-debug`                                         |

## Workflow

1. Identify intent: install, config, hotkeys, themes, updates/snapshots, or troubleshooting.
2. Ground the task in the Omarchy Manual (see `references/manual-index.md`).
3. Prefer Omarchy menu paths over direct file edits when available; it restarts services automatically.
4. If editing files, change `~/.config` and avoid `~/.local/share/omarchy` unless explicitly required.
5. For updates, use Omarchy Update flow (not direct `pacman/yay`) to ensure migrations run.
6. Verify with the smallest safe check (reload a service, relaunch Hyprland, or boot a snapshot).

## Defaults and Guardrails

- Hotkeys are the primary interface; document the exact keys before changing behavior.
- Omarchy uses full-disk encryption and Limine snapshots; treat rollback as a first-line recovery.
- Themes are generated from `colors.toml`; keep changes in theme folders to avoid drift.

## Validation

- Hotkeys: press Super + K, confirm bindings reflect expected changes.
- Config edits: reopen the app/process or restart Hyprland if required.
- Updates: verify Omarchy version in the update UI, confirm snapshot created.
- Recovery: boot snapshot and ensure `/root` restored (home remains intact).

## Screenshot note

- If Print Screen behaves oddly, run `omarchy-cmd-screenshot` (or `omarchy-cmd-screenshot smart clipboard`) from a terminal to verify the capture pipeline works, then revisit keybindings.

## References

- `references/official-links.md`
- `references/manual-index.md`
- `references/keyboard-shortcuts.md`
- `references/config-paths.md`
- `references/updates-and-recovery.md`
- `references/themes.md`
- `references/extra-themes.md`
- `references/troubleshooting.md`
- `references/ai-and-tools.md`
- `references/hardware-and-input.md`
- `references/security.md`
- `references/external-links-pointer.md`
