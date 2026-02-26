---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image (Nano Banana Pro).
homepage: https://ai.google.dev/
metadata:
  {
    "openclaw":
      {
        "emoji": "🍌",
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"] },
        "primaryEnv": "GEMINI_API_KEY",
        "install":
          [
            {
              "id": "uv-brew",
              "kind": "brew",
              "formula": "uv",
              "bins": ["uv"],
              "label": "Install uv (brew)",
            },
          ],
      },
  }
---

# Nano Banana Pro (Gemini Image Generation)

Use the bundled script to generate or edit images using Gemini image models.

## Models

- **flash** (default): Nano Banana 2 (`gemini-3.1-flash-image-preview`) — Fast, efficient for most tasks
- **pro**: Nano Banana Pro (`gemini-3-pro-image-preview`) — High-fidelity for demanding tasks

## Usage

Generate (default: flash model)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "your image description" --filename "output.png" --resolution 1K
```

Generate with Pro model (high-fidelity)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "detailed artwork" --filename "output.png" --model pro --resolution 4K
```

Edit (single image)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "edit instructions" --filename "output.png" -i "/path/in.png" --resolution 2K
```

Multi-image composition (up to 14 images)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "combine these into one scene" --filename "output.png" -i img1.png -i img2.png -i img3.png
```

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--prompt` | `-p` | Image description/prompt (required) |
| `--filename` | `-f` | Output filename (required) |
| `--model` | `-m` | Model: `flash` (default) or `pro` |
| `--resolution` | `-r` | Output resolution: `1K` (default), `2K`, `4K` |
| `--input-image` | `-i` | Input image(s) for editing (repeatable, up to 14) |
| `--api-key` | `-k` | Gemini API key (overrides env var) |

## API Key

- `GEMINI_API_KEY` env var
- Or set `skills."nano-banana-pro".apiKey` / `skills."nano-banana-pro".env.GEMINI_API_KEY` in `~/.openclaw/openclaw.json`

## Notes

- Use timestamps in filenames: `yyyy-mm-dd-hh-mm-ss-name.png`.
- The script prints a `MEDIA:` line for OpenClaw to auto-attach on supported chat providers.
- Do not read the image back; report the saved path only.
