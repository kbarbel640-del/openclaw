import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerFeishuDocTools } from "./docx.js";
import { registerFeishuDriveTools } from "./drive.js";
import { registerFeishuPermTools } from "./perm.js";
import { registerFeishuWikiTools } from "./wiki.js";

const createFeishuClientMock = vi.hoisted(() => vi.fn());

vi.mock("./client.js", () => ({
  createFeishuClient: createFeishuClientMock,
}));

function createApi() {
  return {
    config: {
      channels: {
        feishu: {
          tools: { perm: true },
          accounts: {
            "z-main": {
              appId: "app_z",
              appSecret: "secret_z",
            },
            "a-first": {
              appId: "app_a",
              appSecret: "secret_a",
            },
          },
        },
      },
    },
    logger: { debug: vi.fn(), info: vi.fn() },
    registerTool: vi.fn(),
  } as any;
}

function getToolFromRegisterCall(
  registerTool: ReturnType<typeof vi.fn>,
  name: string,
  agentAccountId: string,
) {
  const call = registerTool.mock.calls.find((entry) => entry[1]?.name === name);
  const factory = call?.[0];
  expect(typeof factory).toBe("function");
  return factory({ agentAccountId });
}

describe("feishu tool account routing", () => {
  const appScopeListMock = vi.fn();
  const docCreateMock = vi.fn();
  const driveListMock = vi.fn();
  const wikiSpaceListMock = vi.fn();
  const permMemberListMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    createFeishuClientMock.mockReturnValue({
      application: {
        scope: {
          list: appScopeListMock,
        },
      },
      docx: {
        document: {
          create: docCreateMock,
        },
      },
      drive: {
        file: {
          list: driveListMock,
        },
        permissionMember: {
          list: permMemberListMock,
        },
      },
      wiki: {
        space: {
          list: wikiSpaceListMock,
        },
      },
    });

    appScopeListMock.mockResolvedValue({ code: 0, data: { scopes: [] } });
    docCreateMock.mockResolvedValue({ code: 0, data: { document: { document_id: "d1" } } });
    driveListMock.mockResolvedValue({ code: 0, data: { files: [] } });
    wikiSpaceListMock.mockResolvedValue({ code: 0, data: { items: [] } });
    permMemberListMock.mockResolvedValue({ code: 0, data: { items: [] } });
  });

  it("uses ctx.agentAccountId for feishu_doc", async () => {
    const api = createApi();
    registerFeishuDocTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_doc", "z-main");

    await tool.execute("call-id", { action: "create", title: "Doc Title" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "z-main" }),
    );
  });

  it("falls back to first account when ctx.agentAccountId is missing for feishu_doc", async () => {
    const api = createApi();
    registerFeishuDocTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_doc", "missing-account");

    await tool.execute("call-id", { action: "create", title: "Doc Title" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "a-first" }),
    );
  });

  it("uses ctx.agentAccountId for feishu_drive", async () => {
    const api = createApi();
    registerFeishuDriveTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_drive", "z-main");

    await tool.execute("call-id", { action: "list" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "z-main" }),
    );
  });

  it("falls back to first account when ctx.agentAccountId is missing for feishu_drive", async () => {
    const api = createApi();
    registerFeishuDriveTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_drive", "missing-account");

    await tool.execute("call-id", { action: "list" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "a-first" }),
    );
  });

  it("uses ctx.agentAccountId for feishu_wiki", async () => {
    const api = createApi();
    registerFeishuWikiTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_wiki", "z-main");

    await tool.execute("call-id", { action: "spaces" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "z-main" }),
    );
  });

  it("falls back to first account when ctx.agentAccountId is missing for feishu_wiki", async () => {
    const api = createApi();
    registerFeishuWikiTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_wiki", "missing-account");

    await tool.execute("call-id", { action: "spaces" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "a-first" }),
    );
  });

  it("uses ctx.agentAccountId for feishu_perm", async () => {
    const api = createApi();
    registerFeishuPermTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_perm", "z-main");

    await tool.execute("call-id", { action: "list", token: "doc_token", type: "docx" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "z-main" }),
    );
  });

  it("falls back to first account when ctx.agentAccountId is missing for feishu_perm", async () => {
    const api = createApi();
    registerFeishuPermTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_perm", "missing-account");

    await tool.execute("call-id", { action: "list", token: "doc_token", type: "docx" });

    expect(createFeishuClientMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountId: "a-first" }),
    );
  });
});

describe("feishu per-account tool gating", () => {
  const appScopeListMock = vi.fn();
  const docCreateMock = vi.fn();
  const driveListMock = vi.fn();
  const wikiSpaceListMock = vi.fn();
  const permMemberListMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    createFeishuClientMock.mockReturnValue({
      application: { scope: { list: appScopeListMock } },
      docx: { document: { create: docCreateMock } },
      drive: { file: { list: driveListMock }, permissionMember: { list: permMemberListMock } },
      wiki: { space: { list: wikiSpaceListMock } },
    });

    appScopeListMock.mockResolvedValue({ code: 0, data: { scopes: [] } });
    docCreateMock.mockResolvedValue({ code: 0, data: { document: { document_id: "d1" } } });
    driveListMock.mockResolvedValue({ code: 0, data: { files: [] } });
    wikiSpaceListMock.mockResolvedValue({ code: 0, data: { items: [] } });
    permMemberListMock.mockResolvedValue({ code: 0, data: { items: [] } });
  });

  /**
   * Helper: create config where account "enabled" has the tool on,
   * and account "disabled" has it off.
   */
  function createMixedApi(toolKey: string) {
    return {
      config: {
        channels: {
          feishu: {
            tools: { perm: true }, // top-level default
            accounts: {
              enabled: {
                appId: "app_enabled",
                appSecret: "secret_enabled",
                tools: { [toolKey]: true },
              },
              disabled: {
                appId: "app_disabled",
                appSecret: "secret_disabled",
                tools: { [toolKey]: false },
              },
            },
          },
        },
      },
      logger: { debug: vi.fn(), info: vi.fn() },
      registerTool: vi.fn(),
    } as any;
  }

  it("blocks feishu_perm when the resolved account has perm=false", async () => {
    const api = createMixedApi("perm");
    registerFeishuPermTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_perm", "disabled");

    const result = await tool.execute("call-id", { action: "list", token: "t", type: "docx" });
    expect(result.details.error).toMatch(/disabled.*"disabled"/);
    expect(createFeishuClientMock).not.toHaveBeenCalled();
  });

  it("allows feishu_perm when the resolved account has perm=true", async () => {
    const api = createMixedApi("perm");
    registerFeishuPermTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_perm", "enabled");

    await tool.execute("call-id", { action: "list", token: "t", type: "docx" });
    expect(createFeishuClientMock).toHaveBeenCalled();
  });

  it("blocks feishu_doc when the resolved account has doc=false", async () => {
    const api = createMixedApi("doc");
    registerFeishuDocTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_doc", "disabled");

    const result = await tool.execute("call-id", { action: "create", title: "T" });
    expect(result.details.error).toMatch(/disabled.*"disabled"/);
    expect(createFeishuClientMock).not.toHaveBeenCalled();
  });

  it("blocks feishu_drive when the resolved account has drive=false", async () => {
    const api = createMixedApi("drive");
    registerFeishuDriveTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_drive", "disabled");

    const result = await tool.execute("call-id", { action: "list" });
    expect(result.details.error).toMatch(/disabled.*"disabled"/);
    expect(createFeishuClientMock).not.toHaveBeenCalled();
  });

  it("blocks feishu_wiki when the resolved account has wiki=false", async () => {
    const api = createMixedApi("wiki");
    registerFeishuWikiTools(api);
    const tool = getToolFromRegisterCall(api.registerTool, "feishu_wiki", "disabled");

    const result = await tool.execute("call-id", { action: "spaces" });
    expect(result.details.error).toMatch(/disabled.*"disabled"/);
    expect(createFeishuClientMock).not.toHaveBeenCalled();
  });
});
