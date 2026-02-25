# Configuration paths (Omarchy)

Source (dotfiles):

```
https://learn.omacom.io/2/the-omarchy-manual/65/dotfiles
```

## Core guidance

- Prefer editing files in `~/.config`.
- Avoid editing `~/.local/share/omarchy` directly; override in `~/.config` instead.

## Key files (from Omarchy manual)

- `~/.config/hypr/hyprland.conf` -> Hyprland defaults, keybindings, apps
- `~/.config/hypr/monitors.conf` -> Monitor layout, resolution, scaling
- `~/.config/hypr/hypridle.conf` -> Idle/sleep behavior
- `~/.config/hypr/hyprlock.conf` -> Lock screen (symlinked to theme)
- `~/.config/waybar/config.jsonc` -> Top bar config
- `~/.config/waybar/style.css` -> Top bar theme (symlinked)
- `~/.config/walker/config.toml` -> Launcher (Walker)
- `~/.config/ghostty/config` -> Terminal config
- `~/.config/uwsm/default` -> Default $EDITOR
- `~/.XCompose` -> Emoji/autocomplete; restart with `omarchy-restart-xcompose`

## Input

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/78/keyboard-mouse-trackpad
```

- `~/.config/hypr/input.conf` -> Keyboard/mouse/trackpad settings

## Themes

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/92/making-your-own-theme
```

- `~/.config/omarchy/themes` -> Custom themes
- `~/.local/share/omarchy/themes` -> Built-in themes
- Theme core file: `colors.toml`
- Optional theme files: `light.mode`, `icons.theme`

## Windows VM

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/100/windows-vm
```

- `~/.config/windows/docker-compose.yml` -> Windows VM resources and mounts
- `~/Windows` -> Shared directory with the VM

## Backgrounds

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/53/hotkeys
```

- `~/.config/omarchy/current/backgrounds` -> Extra background images
