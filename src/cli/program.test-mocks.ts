import { vi } from "vitest";
import type { MockFn } from "../test-utils/vitest-mock-fn.js";

export const messageCommand: MockFn = vi.fn();
export const statusCommand: MockFn = vi.fn();
export const configureCommand: MockFn = vi.fn();
export const configureCommandWithSections: MockFn = vi.fn();
export const setupCommand: MockFn = vi.fn();
export const onboardCommand: MockFn = vi.fn();
export const callGateway: MockFn = vi.fn();
export const runChannelLogin: MockFn = vi.fn();
export const runChannelLogout: MockFn = vi.fn();
export const runTui: MockFn = vi.fn();

export const loadAndMaybeMigrateDoctorConfig: MockFn = vi.fn();
export const ensureConfigReady: MockFn = vi.fn();
export const ensurePluginRegistryLoaded: MockFn = vi.fn();

export const runtime: { log: MockFn; error: MockFn; exit: MockFn } = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(() => {
    throw new Error("exit");
  }),
};

export function installBaseProgramMocks() {
  vi.mock("../commands/message.js", () => ({ messageCommand }));
  vi.mock("../commands/status.js", () => ({ statusCommand }));
  vi.mock("../commands/configure.js", () => ({
    CONFIGURE_WIZARD_SECTIONS: [
      "workspace",
      "model",
      "web",
      "gateway",
      "daemon",
      "channels",
      "skills",
      "health",
    ],
    configureCommand,
    configureCommandWithSections,
  }));
  vi.mock("../commands/setup.js", () => ({ setupCommand }));
  vi.mock("../commands/onboard.js", () => ({ onboardCommand }));
  vi.mock("../runtime.js", () => ({ defaultRuntime: runtime }));
  vi.mock("./channel-auth.js", () => ({ runChannelLogin, runChannelLogout }));
  vi.mock("../tui/tui.js", () => ({ runTui }));
  vi.mock("../gateway/call.js", () => ({
    callGateway,
    randomIdempotencyKey: () => "idem-test",
    buildGatewayConnectionDetails: () => ({
      url: "ws://127.0.0.1:1234",
      urlSource: "test",
      message: "Gateway target: ws://127.0.0.1:1234",
    }),
  }));
  vi.mock("./deps.js", () => ({ createDefaultDeps: () => ({}) }));
}

export function installSmokeProgramMocks() {
  vi.mock("./plugin-registry.js", () => ({ ensurePluginRegistryLoaded }));
  vi.mock("../commands/doctor-config-flow.js", () => ({
    loadAndMaybeMigrateDoctorConfig,
  }));
  vi.mock("./program/config-guard.js", () => ({ ensureConfigReady }));
  vi.mock("./preaction.js", () => ({ registerPreActionHooks: () => {} }));
}
