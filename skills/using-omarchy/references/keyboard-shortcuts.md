# Keyboard shortcuts (Omarchy hotkeys)

Source:

```
https://learn.omacom.io/2/the-omarchy-manual/53/hotkeys
```

## Global

- Super + K -> Show main keybindings
- Super + Space -> Application launcher
- Super + Alt + Space -> Omarchy control menu

## Navigation + window management

- Super + Escape -> Lock, suspend, relaunch, restart, shutdown
- Super + Ctrl + L -> Lock computer
- Super + W -> Close window
- Ctrl + Alt + Del -> Close all windows
- Super + T -> Toggle tiling/floating
- Super + O -> Toggle sticky floating
- Super + F -> Full screen
- Super + Alt + F -> Full width (keep top bar)
- Super + 1/2/3/4 -> Jump to workspace
- Super + Tab -> Next workspace
- Super + Shift + Tab -> Previous workspace
- Super + Ctrl + Tab -> Former workspace
- Super + Shift + 1/2/3/4 -> Move window to workspace
- Super + Shift + Alt + Arrows -> Move workspaces to directional monitor
- Super + Arrow -> Focus window in direction
- Super + Shift + Arrow -> Swap window in direction
- Super + Equal -> Grow windows to the left
- Super + Minus -> Grow windows to the right
- Super + Shift + Equal -> Grow windows to the bottom
- Super + Shift + Minus -> Grow windows to the top
- Super + G -> Toggle window grouping
- Super + Alt + G -> Move window out of grouping
- Super + Alt + Tab -> Cycle windows in grouping
- Super + Alt + 1/2/3/4 -> Jump to specific window in grouping
- Super + Alt + Arrow -> Move window into grouping
- Super + Ctrl + Arrow -> Move between windows inside a tiling group
- Super + S -> Scratchpad overlay
- Super + Alt + S -> Move window to scratchpad

## System controls

- Super + Ctrl + A -> Audio controls (wiremix)
- Super + Ctrl + B -> Bluetooth controls (bluetui)
- Super + Ctrl + W -> Wifi controls (impala)
- Super + Ctrl + S -> Share menu (LocalSend)
- Super + Ctrl + T -> Activity (btop)

## Launching apps

- Super + Return -> Terminal
- Super + Shift + B -> Browser
- Super + Shift + Alt + B -> Browser (private/incognito)
- Super + Shift + F -> File manager
- Super + Shift + M -> Music (Spotify)
- Super + Shift + / -> Password manager (1Password)
- Super + Shift + N -> Neovim
- Super + Shift + C -> Calendar (HEY)
- Super + Shift + E -> Email (HEY)
- Super + Shift + A -> AI (ChatGPT)
- Super + Shift + G -> Messenger (Signal)
- Super + Shift + Alt + G -> Messenger (WhatsApp)
- Super + Shift + Ctrl + G -> Messenger (Google)
- Super + Shift + D -> Docker (LazyDocker)
- Super + Shift + O -> Obsidian
- Super + Shift + X -> X

Change/add bindings in:

```
~/.config/hypr/bindings.conf
```

## Universal clipboard

- Super + C -> Copy
- Super + X -> Cut (not in terminal)
- Super + V -> Paste
- Super + Ctrl + V -> Clipboard manager

## Capture

- Print Screen -> Screenshot with editing
- Shift + Print Screen -> Screenshot to clipboard
- Alt + Print Screen -> Screenrecord
- Super + Print Screen -> Color picker
- Alt + Shift + L -> Copy current URL from webapp or Chromium
- Super + Ctrl + X -> Hold to capture dictation (requires Install > AI > Dictation)

Notes:

- Print Screen runs `omarchy-cmd-screenshot` from `~/.local/share/omarchy/default/hypr/bindings/utilities.conf`.
- If the hotkey misbehaves, run `omarchy-cmd-screenshot` directly to test capture without the binding.

## Notifications

- Super + , -> Dismiss latest
- Super + Shift + , -> Dismiss all
- Super + Ctrl + , -> Toggle silencing notifications
- Super + Alt + , -> Invoke most recent notification

## Style

- Super + Ctrl + Shift + Space -> Pick new theme
- Super + Ctrl + Space -> Next background image for theme
- Super + Backspace -> Toggle window transparency

Extra backgrounds:

```
~/.config/omarchy/current/backgrounds
```

## Toggles

- Super + Ctrl + I -> Toggle idle/sleep prevention
- Super + Ctrl + N -> Toggle nightlight
- Super + Shift + Space -> Toggle top bar
- Super + Mute -> Next audio output

## Ghostty terminal

- Ctrl + Shift + E -> New split below
- Ctrl + Shift + O -> New split besides
- Ctrl + Alt + Arrows -> Move between splits
- Super + Ctrl + Shift + Arrows -> Resize split by 10 lines
- Super + Ctrl + Shift + Alt + Arrows -> Resize split by 100 lines
- Ctrl + Shift + T -> New tab
- Ctrl + Shift + Arrows -> Move between tabs
- Alt + Numbers -> Go to specific tab
- Shift + Pg Up/Down -> Scroll history
- Ctrl + Left mouse -> Open link in browser

## File manager

- Ctrl + L -> Go to path
- Space -> Preview file (arrows navigate)
- Backspace -> Go back one folder

## Apple display brightness (asdcontrol)

- Ctrl + F1 -> Turn down brightness
- Ctrl + F2 -> Turn up brightness
- Ctrl + Shift + F2 -> Max brightness

## Neovim (LazyVim)

- Space -> Command options
- Space Space -> Fuzzy file search
- Space E -> Toggle sidebar
- Space G G -> Git controls
- Space S G -> Search file content
- Ctrl + W W -> Jump between sidebar and editor
- Ctrl + Left/Right -> Resize sidebar
- Shift + H -> Left tab
- Shift + L -> Right tab
- Space B D -> Close file tab

While in sidebar:

- A -> Add new file
- Shift + A -> Add subdir
- D -> Delete highlighted file/dir
- M -> Move highlighted file/dir
- R -> Rename highlighted file/dir
- ? -> Help

## Quick emojis

- Super + Ctrl + E -> Emoji picker (clipboard)
- CapsLock M S -> smile
- CapsLock M C -> cry
- CapsLock M L -> love
- CapsLock M V -> victory
- CapsLock M H -> heart
- CapsLock M Y -> yes
- CapsLock M N -> no
- CapsLock M F -> fuck
- CapsLock M W -> wish
- CapsLock M R -> rock
- CapsLock M K -> kiss
- CapsLock M E -> eyeroll
- CapsLock M P -> pray
- CapsLock M D -> drool
- CapsLock M M -> money
- CapsLock M X -> xellebrate
- CapsLock M 1 -> 100%
- CapsLock M T -> toast
- CapsLock M O -> ok
- CapsLock M G -> greeting
- CapsLock M A -> arm
- CapsLock M B -> blowing

## Quick completions

- CapsLock Space Space -> - (mdash)
- CapsLock Space N -> Your name (as entered on setup)
- CapsLock Space E -> Your email (as entered on setup)

To add more:

```
~/.XCompose
```

Then run:

```
omarchy-restart-xcompose
```
