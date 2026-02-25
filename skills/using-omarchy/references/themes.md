# Themes

Sources:

```
https://learn.omacom.io/2/the-omarchy-manual/52/themes
```

```
https://learn.omacom.io/2/the-omarchy-manual/90/extra-themes
```

```
https://learn.omacom.io/2/the-omarchy-manual/92/making-your-own-theme
```

## Select and cycle

- Omarchy menu: Style > Theme (or Super + Ctrl + Shift + Space).
- Cycle backgrounds: Super + Ctrl + Space.

## Built-in themes

- Tokyo Night
- Catppuccin
- Ethereal
- Everforest
- Gruvbox
- Hackerman
- Osaka Jade
- Kanagawa
- Nord
- Matte Black
- Ristretto
- Flexoki Light
- Rose Pine
- Catppuccin Latte

## Extra themes

- Install: Omarchy menu > Install > Style > Theme (paste GitHub URL).
- Remove: Omarchy menu > Remove > Style > Theme.
- Full extra-theme URL list:

```
/home/klabo/Desktop/docs/omarchy-manual/EXTRA_THEMES.md
```

## Make your own

- Copy a theme from:

```
~/.local/share/omarchy/themes
```

- Create in:

```
~/.config/omarchy/themes
```

- Edit `colors.toml` to drive theme generation.
- Light mode: add empty `light.mode` file.
- Icon set: add `icons.theme` with icon set name.
- Distribute via a public git URL (recommended naming: omarchy-<theme>-theme).
