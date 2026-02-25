/**
 * TCP Client for SophieConnect Lightroom Plugin
 *
 * Communicates with the Lua TCP plugin running inside Lightroom Classic
 * on localhost:47290. Provides direct programmatic control of Lightroom
 * sliders without needing screenshot-based UI automation.
 *
 * Protocol: JSON commands over TCP, newline-delimited.
 */

import { Socket } from "node:net";

export interface TcpClientConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

export interface DevelopSettings {
  [param: string]: number;
}

const DEFAULT_CONFIG: TcpClientConfig = {
  host: "127.0.0.1",
  port: 47290,
  timeoutMs: 5000,
};

export class LightroomTcpClient {
  private config: TcpClientConfig;

  constructor(config: Partial<TcpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Send a command to the Lightroom plugin and receive a response.
   */
  private async sendCommand(command: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let responseData = "";

      socket.setTimeout(this.config.timeoutMs);

      socket.connect(this.config.port, this.config.host, () => {
        const payload = JSON.stringify(command) + "\n";
        socket.write(payload);
      });

      socket.on("data", (data) => {
        responseData += data.toString();
        // Check for complete JSON response (newline terminated)
        if (responseData.includes("\n")) {
          const line = responseData.split("\n")[0];
          try {
            const result = JSON.parse(line) as Record<string, unknown>;
            socket.destroy();
            resolve(result);
          } catch {
            socket.destroy();
            reject(new Error(`Invalid JSON response: ${line}`));
          }
        }
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("TCP connection timed out"));
      });

      socket.on("error", (err) => {
        socket.destroy();
        reject(new Error(`TCP error: ${err.message}`));
      });

      socket.on("close", () => {
        if (responseData && !responseData.includes("\n")) {
          // Try to parse whatever we got
          try {
            const result = JSON.parse(responseData.trim()) as Record<string, unknown>;
            resolve(result);
          } catch {
            reject(new Error("Connection closed without complete response"));
          }
        }
      });
    });
  }

  /**
   * Ping the plugin to check if it's running.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.sendCommand({ action: "ping" });
      return result.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Get a single develop slider value.
   */
  async getSliderValue(param: string): Promise<number | null> {
    try {
      const result = await this.sendCommand({ action: "getValue", param });
      if (result.error) {
        console.warn(`[TcpClient] getValue error: ${result.error as string}`);
        return null;
      }
      return (result.value as number) ?? null;
    } catch (err) {
      console.warn(
        `[TcpClient] getSliderValue failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Set a single develop slider value.
   */
  async setSliderValue(param: string, value: number): Promise<boolean> {
    try {
      const result = await this.sendCommand({ action: "setValue", param, value });
      return result.success === true;
    } catch (err) {
      console.warn(
        `[TcpClient] setSliderValue failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Get all develop settings as a map.
   */
  async getAllDevelopSettings(): Promise<DevelopSettings> {
    try {
      const result = await this.sendCommand({ action: "getDevelopSettings" });
      if (result.error) {
        console.warn(`[TcpClient] getDevelopSettings error: ${result.error as string}`);
        return {};
      }
      return (result.settings as DevelopSettings) ?? {};
    } catch (err) {
      console.warn(
        `[TcpClient] getAllDevelopSettings failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {};
    }
  }

  /**
   * Get the file path of the currently selected photo.
   */
  async getSelectedPhotoPath(): Promise<string | null> {
    try {
      const result = await this.sendCommand({ action: "getSelectedPhotoPath" });
      if (result.error) {
        return null;
      }
      return (result.path as string) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Navigate to the next photo.
   */
  async nextPhoto(): Promise<boolean> {
    try {
      const result = await this.sendCommand({ action: "selectNextPhoto" });
      return result.success === true;
    } catch {
      return false;
    }
  }
}
