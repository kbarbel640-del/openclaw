import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasImage, getImageBase64 } from "@crosscopy/clipboard";
import { Editor, Key, matchesKey } from "@mariozechner/pi-tui";

export class CustomEditor extends Editor {
  onEscape?: () => void;
  onCtrlC?: () => void;
  onCtrlD?: () => void;
  onCtrlG?: () => void;
  onCtrlL?: () => void;
  onCtrlO?: () => void;
  onCtrlP?: () => void;
  onCtrlT?: () => void;
  onShiftTab?: () => void;
  onAltEnter?: () => void;
  /** Called when an image is pasted. Receives a temp file path and suggested filename. */
  onImagePaste?: (filePath: string, fileName: string) => Promise<void>;

  handleInput(data: string): void {
    // Intercept Ctrl+V before pi-tui to check for clipboard images
    if (matchesKey(data, Key.ctrl("v"))) {
      void this.handlePasteKeypress();
      return;
    }

    // Terminal-standard line/word navigation
    if (matchesKey(data, Key.alt("left"))) {
      this.moveWordBackwards();
      return;
    }
    if (matchesKey(data, Key.alt("right"))) {
      this.moveWordForwards();
      return;
    }
    if (matchesKey(data, Key.ctrl("a"))) {
      this.moveToLineStart();
      return;
    }
    if (matchesKey(data, Key.ctrl("e"))) {
      this.moveToLineEnd();
      return;
    }

    // Existing shortcuts
    if (matchesKey(data, Key.alt("enter")) && this.onAltEnter) {
      this.onAltEnter();
      return;
    }
    if (matchesKey(data, Key.ctrl("l")) && this.onCtrlL) {
      this.onCtrlL();
      return;
    }
    if (matchesKey(data, Key.ctrl("o")) && this.onCtrlO) {
      this.onCtrlO();
      return;
    }
    if (matchesKey(data, Key.ctrl("p")) && this.onCtrlP) {
      this.onCtrlP();
      return;
    }
    if (matchesKey(data, Key.ctrl("g")) && this.onCtrlG) {
      this.onCtrlG();
      return;
    }
    if (matchesKey(data, Key.ctrl("t")) && this.onCtrlT) {
      this.onCtrlT();
      return;
    }
    if (matchesKey(data, Key.shift("tab")) && this.onShiftTab) {
      this.onShiftTab();
      return;
    }
    if (matchesKey(data, Key.escape) && this.onEscape && !this.isShowingAutocomplete()) {
      this.onEscape();
      return;
    }
    if (matchesKey(data, Key.ctrl("c")) && this.onCtrlC) {
      this.onCtrlC();
      return;
    }
    if (matchesKey(data, Key.ctrl("d"))) {
      if (this.getText().length === 0 && this.onCtrlD) {
        this.onCtrlD();
      }
      return;
    }
    super.handleInput(data);
  }

  /**
   * Handle Ctrl+V: check clipboard for an image, save to temp file and notify
   * via onImagePaste. Falls back to normal text paste if no image found.
   */
  private async handlePasteKeypress(): Promise<void> {
    try {
      if (hasImage() && this.onImagePaste) {
        const rawBase64 = await getImageBase64();

        // Strip data-URL prefix if present, remove whitespace
        let base64 = rawBase64;
        const commaIdx = base64.indexOf(",");
        if (commaIdx !== -1) {
          base64 = base64.slice(commaIdx + 1);
        }
        base64 = base64.replace(/\s/g, "");

        // Round-trip through Buffer to guarantee valid base64
        const imageBuffer = Buffer.from(base64, "base64");
        if (imageBuffer.length === 0) {
          throw new Error("Clipboard image decoded to empty buffer");
        }

        // Write to temp file (avoids passing large base64 strings around)
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `screenshot-${timestamp}.png`;
        const tempDir = mkdtempSync(join(tmpdir(), "openclaw-paste-"));
        const filePath = join(tempDir, fileName);

        writeFileSync(filePath, imageBuffer);
        await this.onImagePaste(filePath, fileName);
        return;
      }
    } catch (error) {
      // Surface the error through the paste handler if available
      if (this.onImagePaste) {
        try {
          await this.onImagePaste("", `error: ${String(error)}`);
        } catch {
          // Ignore handler errors
        }
      }
    }

    // No image or image failed — fall back to normal text paste
    super.handleInput(Key.ctrl("v"));
  }
}
