import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AdjustmentEntryType, LightroomControlType } from "../vision/schema.js";
import { SLIDER_UI_LABELS } from "./shortcuts.js";

const execFileAsync = promisify(execFile);

/**
 * Slider value increments in Lightroom.
 * Period/comma keys nudge the selected slider by these amounts.
 * With Shift held, the increment is larger.
 */
const SLIDER_INCREMENTS: Partial<Record<LightroomControlType, { small: number; large: number }>> = {
  exposure: { small: 0.05, large: 0.33 },
  contrast: { small: 1, large: 5 },
  highlights: { small: 1, large: 5 },
  shadows: { small: 1, large: 5 },
  whites: { small: 1, large: 5 },
  blacks: { small: 1, large: 5 },
  temp: { small: 50, large: 200 },
  tint: { small: 1, large: 5 },
  vibrance: { small: 1, large: 5 },
  saturation: { small: 1, large: 5 },
  clarity: { small: 1, large: 5 },
  dehaze: { small: 1, large: 5 },
  texture: { small: 1, large: 5 },
  grain_amount: { small: 1, large: 5 },
  grain_size: { small: 1, large: 5 },
  grain_roughness: { small: 1, large: 5 },
  vignette_amount: { small: 1, large: 5 },
};

/**
 * Controls Lightroom sliders via Peekaboo UI automation.
 *
 * Strategy: Use Peekaboo's `see` to find slider elements by label,
 * then `click` to select the slider, then use keyboard nudges
 * (period/comma) to adjust values, or directly type values into
 * the numeric input fields.
 */
export class SliderController {
  private appName: string;

  constructor(appName = "Adobe Lightroom Classic") {
    this.appName = appName;
  }

  /**
   * Apply a single adjustment by clicking the slider's value field
   * and typing the new value directly.
   */
  async applyAdjustment(adjustment: AdjustmentEntryType): Promise<boolean> {
    const label = SLIDER_UI_LABELS[adjustment.control];
    if (!label) {
      console.warn(`[SliderController] No UI label for control: ${adjustment.control}`);
      return await this.applyViaKeyboardNudge(adjustment);
    }

    try {
      return await this.applyViaDirectInput(adjustment, label);
    } catch (error) {
      console.warn(
        `[SliderController] Direct input failed for ${adjustment.control}, falling back to nudge:`,
        error,
      );
      return await this.applyViaKeyboardNudge(adjustment);
    }
  }

  /**
   * Apply adjustment by double-clicking the slider value field and typing.
   * This is the most precise method.
   */
  private async applyViaDirectInput(
    adjustment: AdjustmentEntryType,
    label: string,
  ): Promise<boolean> {
    const targetValue = adjustment.current_estimate + adjustment.target_delta;

    const script = this.buildSliderInputScript(label, targetValue);
    await this.runOsascript(script);
    await this.sleep(200);

    return true;
  }

  /**
   * Apply adjustment using keyboard nudges (period = up, comma = down).
   * Less precise but works when direct input targeting fails.
   */
  private async applyViaKeyboardNudge(adjustment: AdjustmentEntryType): Promise<boolean> {
    const increment = SLIDER_INCREMENTS[adjustment.control];
    if (!increment) {
      console.error(`[SliderController] No increment data for: ${adjustment.control}`);
      return false;
    }

    const delta = adjustment.target_delta;
    const direction = delta > 0 ? "." : ",";
    const absDelta = Math.abs(delta);

    const largeSteps = Math.floor(absDelta / increment.large);
    const remainingAfterLarge = absDelta - largeSteps * increment.large;
    const smallSteps = Math.round(remainingAfterLarge / increment.small);

    for (let i = 0; i < largeSteps; i++) {
      await this.peekabooHotkey(`shift,${direction}`);
      await this.sleep(50);
    }

    for (let i = 0; i < smallSteps; i++) {
      await this.peekabooPress(direction);
      await this.sleep(50);
    }

    return true;
  }

  /**
   * Apply a batch of adjustments in the recommended order:
   * 1. Base preset (if any)
   * 2. Exposure correction
   * 3. White balance (temp, tint)
   * 4. Tone (contrast, highlights, shadows, whites, blacks)
   * 5. Presence (clarity, vibrance, saturation, dehaze, texture)
   * 6. HSL
   * 7. Effects (grain, vignette)
   */
  async applyAdjustmentBatch(adjustments: AdjustmentEntryType[]): Promise<{
    applied: number;
    failed: number;
    results: Array<{ control: string; success: boolean }>;
  }> {
    const ordered = this.sortByEditingOrder(adjustments);
    const results: Array<{ control: string; success: boolean }> = [];
    let applied = 0;
    let failed = 0;

    for (const adj of ordered) {
      const success = await this.applyAdjustment(adj);
      results.push({ control: adj.control, success });
      if (success) {
        applied++;
      } else {
        failed++;
      }
      await this.sleep(300);
    }

    return { applied, failed, results };
  }

  private sortByEditingOrder(adjustments: AdjustmentEntryType[]): AdjustmentEntryType[] {
    const order: Record<string, number> = {
      exposure: 0,
      temp: 1,
      tint: 2,
      contrast: 3,
      highlights: 4,
      shadows: 5,
      whites: 6,
      blacks: 7,
      clarity: 8,
      dehaze: 9,
      texture: 10,
      vibrance: 11,
      saturation: 12,
    };

    return [...adjustments].toSorted((a, b) => {
      const orderA = order[a.control] ?? 50;
      const orderB = order[b.control] ?? 50;
      return orderA - orderB;
    });
  }

  /**
   * Build AppleScript to click a slider's value field and type a new value.
   * Lightroom's slider value fields are double-clickable for direct numeric input.
   */
  private buildSliderInputScript(sliderLabel: string, value: number): string {
    const formatted = this.formatSliderValue(value);
    return `
      tell application "System Events"
        tell process "Adobe Lightroom Classic"
          set frontmost to true
          delay 0.2

          -- Find the slider by its label and click its value field
          set sliderGroups to every group of window 1
          repeat with g in sliderGroups
            try
              set staticTexts to every static text of g
              repeat with st in staticTexts
                if value of st contains "${sliderLabel}" then
                  -- The value field is typically the next static text or text field
                  set valueFields to every text field of g
                  if (count of valueFields) > 0 then
                    set targetField to item 1 of valueFields
                    click targetField
                    delay 0.1
                    keystroke "a" using command down
                    keystroke "${formatted}"
                    keystroke return
                    return
                  end if
                end if
              end repeat
            end try
          end repeat
        end tell
      end tell
    `;
  }

  private formatSliderValue(value: number): string {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(2);
  }

  private async peekabooHotkey(keys: string): Promise<void> {
    await execFileAsync("peekaboo", ["hotkey", "--keys", keys, "--app", this.appName]);
  }

  private async peekabooPress(key: string): Promise<void> {
    await execFileAsync("peekaboo", ["press", key, "--app", this.appName]);
  }

  private async runOsascript(script: string): Promise<string> {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
