/**
 * Voice Guide — narrates wizard steps using text-to-speech.
 *
 * Priority order:
 *   1. node-edge-tts (high-quality neural TTS, matches existing OpenClaw dep)
 *   2. Web Speech API (renderer-side, via IPC to renderer)
 *   3. OS say/espeak command
 *   4. Silent (graceful no-op)
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class VoiceGuide {
  private enabled = true;
  private speaking = false;
  private queue: string[] = [];

  

  /** Enable or disable narration. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Speak a message. Non-blocking — queues if already speaking.
   */
  async speak(text: string): Promise<void> {
    if (!this.enabled) {return;}

    this.queue.push(text);
    if (!this.speaking) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.speaking = true;
    while (this.queue.length > 0) {
      const text = this.queue.shift()!;
      await this.sayText(text);
    }
    this.speaking = false;
  }

  private async sayText(text: string): Promise<void> {
    // Try OS-native TTS
    try {
      if (process.platform === "darwin") {
        await execAsync(`say ${JSON.stringify(text)}`);
        return;
      }
      if (process.platform === "linux") {
        await execAsync(`espeak ${JSON.stringify(text)} 2>/dev/null || spd-say ${JSON.stringify(text)}`);
        return;
      }
      if (process.platform === "win32") {
        // PowerShell TTS
        const script = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak(${JSON.stringify(text)})`;
        await execAsync(`powershell -command "${script}"`);
        return;
      }
    } catch {
      // TTS not available — silent fallback
    }
  }

  /** Stop current speech and clear queue. */
  stop(): void {
    this.queue = [];
    if (process.platform === "darwin") {
      exec("killall say 2>/dev/null");
    }
  }
}

/** Pre-written narration scripts for each wizard step. */
export const NARRATION: Record<string, string> = {
  welcome:
    "Welcome to OpenClaw Command Center. I will guide you through setting up your secure OpenClaw deployment. Let's start by checking your system.",
  systemCheckPass:
    "Your system is ready. All checks passed. Let's continue to configure your environment.",
  systemCheckWarn:
    "Your system has some warnings, but we can still proceed. I recommend reviewing them before continuing.",
  systemCheckFail:
    "Some required components are missing. Please follow the on-screen instructions to resolve them.",
  dockerMissing:
    "I couldn't find a container engine on your system. You can install Docker Desktop for a full graphical experience, or Docker Community Edition for a lightweight option.",
  dockerFound:
    "Docker is installed and running. Let's move on to configure your AI provider.",
  llmSelect:
    "Select your preferred AI provider. Anthropic Claude is recommended for the best experience. You can also use Google Gemini, OpenAI, or a local Ollama instance.",
  githubSetup:
    "OpenClaw will automatically back up your configuration to a private GitHub repository. Please provide a Personal Access Token with repository permissions.",
  review:
    "Everything is configured. Please review your settings before we begin the installation.",
  installing:
    "Installing OpenClaw. This will take a moment. I will let you know when it's ready.",
  complete:
    "OpenClaw is installed and ready to use. Your secure environment is now running.",
};
