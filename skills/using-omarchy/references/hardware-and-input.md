# Hardware and input

Sources:

```
https://learn.omacom.io/2/the-omarchy-manual/78/keyboard-mouse-trackpad
```

```
https://learn.omacom.io/2/the-omarchy-manual/86/monitors
```

```
https://learn.omacom.io/2/the-omarchy-manual/103/system-sleep
```

```
https://learn.omacom.io/2/the-omarchy-manual/77/fingerprint-fido2-authentication
```

## Input config

- All input settings live in `~/.config/hypr/input.conf`.
- You can change repeat rate, delay, mouse sensitivity, and touchpad options.
- You can swap Alt/Super with `altwin:swap_alt_win` in `kb_options`.

## Monitors and scaling

- Omarchy defaults to 2x scaling; adjust `GDK_SCALE` and monitor scaling in `~/.config/hypr/monitors.conf` for 1x or fractional scaling.

## Sleep/hibernate

- Sleep is disabled by default due to hardware variability.
- Enable via Omarchy menu: Setup > System Sleep > Enable Suspend or Enable Hibernation.

## Fingerprint and Fido2

- Setup via Omarchy menu: Setup > Security > Fingerprint or Fido2.
- Remove via Omarchy menu: Remove > Fingerprint or Remove > Fido2.
