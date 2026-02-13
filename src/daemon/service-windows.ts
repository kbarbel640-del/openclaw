import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
export type DaemonServiceConfig = {
  cwd: string;
};

const execFileAsync = promisify(execFile);
const SERVICE_NAME = "OpenClawGateway";

// Helper to run schtasks commands
async function runSchtasks(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("schtasks", args, { encoding: "utf8" });
    return stdout;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // schtasks writes errors to stderr, but node throws.
    // If it's "system cannot find the file specified" it means task doesn't exist.
    if (message.includes("The system cannot find the file specified")) {
      throw new Error("Task not found");
    }
    throw err;
  }
}

export async function installWindowsService(config: DaemonServiceConfig): Promise<void> {
  // Instead of running the gateway directly, run the launcher VBS script.
  // This ensures the Tray Icon appears and we have a unified process.
  // The VBS script handles the silent launch of the Python logic.
  const scriptPath = path.resolve(config.cwd, "LaunchOpenClaw.vbs");
  
  // Use wscript to run the VBS
  const args = [
    "/Create",
    "/TN", SERVICE_NAME,
    "/TR", `wscript.exe "${scriptPath}"`, 
    "/SC", "ONLOGON", // Critical: Must run on logon to interact with desktop (Tray Icon)
    "/F", 
    "/RL", "HIGHEST"
  ];

  await runSchtasks(args);
  console.log(`Windows Task "${SERVICE_NAME}" created. It will launch the Tray App on login.`);
}

export async function uninstallWindowsService(): Promise<void> {
  try {
    await runSchtasks(["/Delete", "/TN", SERVICE_NAME, "/F"]);
    console.log(`Windows Task "${SERVICE_NAME}" deleted.`);
  } catch (e) {
    console.log(`Task "${SERVICE_NAME}" not found or already deleted.`);
  }
}

export async function startWindowsService(): Promise<void> {
  await runSchtasks(["/Run", "/TN", SERVICE_NAME]);
  console.log(`Windows Task "${SERVICE_NAME}" started.`);
}

export async function stopWindowsService(): Promise<void> {
  try {
    await runSchtasks(["/End", "/TN", SERVICE_NAME]);
    console.log(`Windows Task "${SERVICE_NAME}" stopped.`);
  } catch (e) {
    // Ignore if not running
  }
}

export async function isWindowsServiceRunning(): Promise<boolean> {
  try {
    const output = await runSchtasks(["/Query", "/TN", SERVICE_NAME, "/FO", "CSV", "/NH"]);
    // Status is usually the 3rd column in CSV format: "\TaskName", "Next Run Time", "Status"
    // Status values: Running, Ready, Disabled
    return output.includes("Running");
  } catch {
    return false;
  }
}

export async function getWindowsServiceStatus(): Promise<string> {
  try {
    const output = await runSchtasks(["/Query", "/TN", SERVICE_NAME, "/FO", "LIST"]);
    return output; // Return full details
  } catch {
    return "Not Installed";
  }
}
