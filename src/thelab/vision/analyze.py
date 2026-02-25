#!/usr/bin/env python3
"""
The Lab — Vision Analyzer Sidecar

Analyzes Lightroom screenshots against the photographer's learned style
profile using a local MLX vision model. The profile contains the typical
adjustments the photographer makes for a given scenario (time of day,
lighting, subject type). The vision model refines these for each specific
image.

Usage:
    python analyze.py --screenshot /path/to/screenshot.png \
                      --target /path/to/profile_target.json \
                      --model mlx-community/Qwen2-VL-7B-Instruct-4bit \
                      [--mode analyze|verify]
"""

import argparse
import json
import sys
import os
from pathlib import Path
from typing import Any

IDENTITY_LOCK = """
CRITICAL CONSTRAINT — IDENTITY LOCK:
You must NEVER suggest adjustments that would alter:
- Facial features, geometry, or skin texture
- Body proportions or pose
- Composition or spatial relationships
- Any element that would change the apparent identity of a person

You may ONLY adjust: color, tone, exposure, white balance, atmospheric
characteristics, grain, and presence settings. If you are uncertain whether
an adjustment would violate this constraint, flag the image for human review.
"""

ANALYSIS_PROMPT_TEMPLATE = """You are The Lab's vision analyzer — a precision instrument that helps
a photographer edit photos in Adobe Lightroom by matching their personal style.

You are looking at a screenshot of Adobe Lightroom Classic's Develop module.
The image being edited is visible in the center. The adjustment panels
(Basic, Tone Curve, HSL, etc.) are visible on the right side.

PHOTOGRAPHER'S LEARNED STYLE PROFILE: {film_stock_name}
{film_stock_description}

The photographer typically applies these adjustments for this type of photo:
{target_ranges}

{identity_lock}

TASK: You have two jobs:

1. READ THE CURRENT STATE — Look at the Lightroom sliders and estimate
   where each control is currently set.

2. REFINE THE PROFILE — The learned profile above shows what this photographer
   TYPICALLY does for this type of photo. But this specific image may need
   adjustments. For example:
   - If the image is underexposed compared to typical, increase the exposure delta
   - If the white balance is already warm, reduce the temperature adjustment
   - If the image has unusual lighting, adapt the profile accordingly

For each adjustment, provide:
1. The current value of the control (from what you see in the sliders)
2. The delta (change) needed — this should be the profile's typical value,
   refined for this specific image's needs
3. Your confidence in this specific adjustment (0.0 to 1.0)

If the image looks unusual for this scenario, or you're unsure how to adapt
the profile, set flag_for_review to true.

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "image_id": "<filename from the Lightroom title bar or 'unknown'>",
  "confidence": <0.0-1.0>,
  "adjustments": [
    {{
      "control": "<lightroom_control_name>",
      "current_estimate": <number>,
      "target_delta": <number>,
      "confidence": <0.0-1.0>
    }}
  ],
  "flag_for_review": <true|false>,
  "flag_reason": "<reason or null>",
  "reasoning": "<brief explanation: what does this image need vs the typical profile?>"
}}

Valid control names: exposure, contrast, highlights, shadows, whites, blacks,
temp, tint, vibrance, saturation, clarity, dehaze, texture,
grain_amount, grain_size, grain_roughness, vignette_amount,
hsl_hue_red, hsl_hue_orange, hsl_hue_yellow, hsl_hue_green,
hsl_hue_aqua, hsl_hue_blue, hsl_hue_purple, hsl_hue_magenta,
hsl_sat_red, hsl_sat_orange, hsl_sat_yellow, hsl_sat_green,
hsl_sat_aqua, hsl_sat_blue, hsl_sat_purple, hsl_sat_magenta,
hsl_lum_red, hsl_lum_orange, hsl_lum_yellow, hsl_lum_green,
hsl_lum_aqua, hsl_lum_blue, hsl_lum_purple, hsl_lum_magenta"""

VERIFY_PROMPT_TEMPLATE = """You are The Lab's verification system. You are looking at a screenshot of
Adobe Lightroom Classic's Develop module AFTER adjustments were applied.

The following adjustments were requested:
{adjustments_json}

TASK: Verify that the adjustments were applied correctly by examining the
current state of the sliders and the image appearance.

Respond with ONLY valid JSON:
{{
  "image_id": "<filename>",
  "adjustments_applied": <true|false>,
  "deviation_score": <0.0-1.0 where 0 is perfect match>,
  "needs_retry": <true|false>,
  "details": "<what looks correct/incorrect>"
}}"""


def load_film_stock_target(target_path: str) -> dict[str, Any]:
    """Load a film stock target profile from JSON."""
    with open(target_path, "r") as f:
        return json.load(f)


def format_target_ranges(target: dict[str, Any]) -> str:
    """Format target ranges for the prompt."""
    ranges = target.get("target_ranges", {})
    if not ranges:
        return "No specific target ranges defined. Use your best judgment based on the film stock description."

    lines = []
    for control, range_info in ranges.items():
        lines.append(
            f"  {control}: typical={range_info['typical']}, "
            f"range=[{range_info['min']}, {range_info['max']}]"
        )
    return "\n".join(lines)


def build_analysis_prompt(target: dict[str, Any]) -> str:
    """Build the full analysis prompt with the photographer's learned profile."""
    return ANALYSIS_PROMPT_TEMPLATE.format(
        film_stock_name=target.get("name", "Unknown"),
        film_stock_description=target.get("description", ""),
        target_ranges=format_target_ranges(target),
        identity_lock=IDENTITY_LOCK,
    )


def build_verify_prompt(adjustments: list[dict[str, Any]]) -> str:
    """Build the verification prompt."""
    return VERIFY_PROMPT_TEMPLATE.format(
        adjustments_json=json.dumps(adjustments, indent=2)
    )


def analyze_screenshot(
    screenshot_path: str,
    target: dict[str, Any],
    model_name: str,
) -> dict[str, Any]:
    """Run vision model analysis on a Lightroom screenshot."""
    try:
        from mlx_vlm import load, generate
    except ImportError:
        print(
            json.dumps({
                "error": "mlx-vlm not installed. Run: pip install mlx-vlm",
                "image_id": "unknown",
                "confidence": 0,
                "adjustments": [],
                "flag_for_review": True,
                "flag_reason": "Vision model not available",
            }),
            file=sys.stdout,
        )
        sys.exit(1)

    prompt = build_analysis_prompt(target)

    model, processor = load(model_name)
    output = generate(
        model,
        processor,
        prompt,
        [screenshot_path],
        verbose=False,
        max_tokens=2048,
    )

    return parse_model_output(output)


def verify_screenshot(
    screenshot_path: str,
    adjustments: list[dict[str, Any]],
    model_name: str,
) -> dict[str, Any]:
    """Run verification on a post-adjustment screenshot."""
    try:
        from mlx_vlm import load, generate
    except ImportError:
        return {
            "image_id": "unknown",
            "adjustments_applied": False,
            "deviation_score": 1.0,
            "needs_retry": True,
            "details": "Vision model not available",
        }

    prompt = build_verify_prompt(adjustments)

    model, processor = load(model_name)
    output = generate(
        model,
        processor,
        prompt,
        [screenshot_path],
        verbose=False,
        max_tokens=1024,
    )

    return parse_model_output(output)


def parse_model_output(raw_output: str) -> dict[str, Any]:
    """Extract JSON from model output, handling markdown fences and preamble."""
    text = raw_output.strip()

    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1:
        text = text[brace_start : brace_end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse model output: {e}",
            "raw_output": raw_output[:500],
            "image_id": "unknown",
            "confidence": 0,
            "adjustments": [],
            "flag_for_review": True,
            "flag_reason": f"Model output parse error: {e}",
        }


def main():
    parser = argparse.ArgumentParser(description="The Lab Vision Analyzer")
    parser.add_argument("--screenshot", required=True, help="Path to Lightroom screenshot")
    parser.add_argument("--target", required=True, help="Path to film stock target JSON")
    parser.add_argument(
        "--model",
        default="mlx-community/Qwen2-VL-7B-Instruct-4bit",
        help="MLX vision model to use",
    )
    parser.add_argument(
        "--mode",
        choices=["analyze", "verify"],
        default="analyze",
        help="Analysis mode",
    )
    parser.add_argument(
        "--adjustments",
        help="JSON string of adjustments to verify (for verify mode)",
    )
    args = parser.parse_args()

    if not Path(args.screenshot).exists():
        print(
            json.dumps({"error": f"Screenshot not found: {args.screenshot}"}),
            file=sys.stdout,
        )
        sys.exit(1)

    if not Path(args.target).exists():
        print(
            json.dumps({"error": f"Target file not found: {args.target}"}),
            file=sys.stdout,
        )
        sys.exit(1)

    target = load_film_stock_target(args.target)

    if args.mode == "analyze":
        result = analyze_screenshot(args.screenshot, target, args.model)
    elif args.mode == "verify":
        adjustments = json.loads(args.adjustments) if args.adjustments else []
        result = verify_screenshot(args.screenshot, adjustments, args.model)
    else:
        result = {"error": f"Unknown mode: {args.mode}"}

    print(json.dumps(result, indent=2), file=sys.stdout)


if __name__ == "__main__":
    main()
