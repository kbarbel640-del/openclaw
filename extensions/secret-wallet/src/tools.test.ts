import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSecretWallet } from "./runner.js";
import {
  createSecretWalletInjectTool,
  createSecretWalletReadTools,
  createSecretWalletWriteTools,
} from "./tools.js";

vi.mock("./runner.js", () => ({
  runSecretWallet: vi.fn(),
}));

const runMock = vi.mocked(runSecretWallet);

describe("secret-wallet tool surface", () => {
  beforeEach(() => {
    runMock.mockReset();
  });

  it("exposes stable read/write tool names", () => {
    const readNames = createSecretWalletReadTools({}).map((tool) => tool.name);
    const writeNames = createSecretWalletWriteTools({}).map((tool) => tool.name);

    expect(readNames).toEqual(["secret_wallet_status", "secret_wallet_list", "secret_wallet_get"]);
    expect(writeNames).toEqual(["secret_wallet_add", "secret_wallet_remove"]);
  });

  it("maps inject request to repeated --only args", async () => {
    runMock.mockResolvedValue({
      ok: true,
      stdout: "ok",
      exitCode: 0,
    });

    const injectTool = createSecretWalletInjectTool({ binaryPath: "/usr/local/bin/secret-wallet" });
    await injectTool.execute("id", {
      command: ["node", "server.js"],
      secretNames: ["OPENAI_KEY", "DB_URL"],
    });

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith(
      "/usr/local/bin/secret-wallet",
      ["inject", "--only", "OPENAI_KEY", "--only", "DB_URL", "--", "node", "server.js"],
      { timeoutMs: 120_000 },
    );
  });

  it("rejects empty command before spawning process", async () => {
    const injectTool = createSecretWalletInjectTool({});
    const result = await injectTool.execute("id", {
      command: [],
      secretNames: ["OPENAI_KEY"],
    });

    const text = result.content[0]?.text ?? "";
    expect(text).toContain("No command specified");
    expect(runMock).not.toHaveBeenCalled();
  });

  it("rejects empty secretNames before spawning process", async () => {
    const injectTool = createSecretWalletInjectTool({});
    const result = await injectTool.execute("id", {
      command: ["node", "server.js"],
      secretNames: [],
    });

    const text = result.content[0]?.text ?? "";
    expect(text).toContain("at least one secret name");
    expect(runMock).not.toHaveBeenCalled();
  });
});
