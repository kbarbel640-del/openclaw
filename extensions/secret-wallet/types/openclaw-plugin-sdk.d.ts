declare module "openclaw/plugin-sdk" {
  export type OpenClawTool = {
    name: string;
    [key: string]: unknown;
  };

  export type OpenClawToolContext = {
    sandboxed?: boolean;
  };

  export type OpenClawPluginApi = {
    pluginConfig?: unknown;
    registerTool: (
      factory: (ctx: OpenClawToolContext) => OpenClawTool | null,
      options?: { optional?: boolean },
    ) => void;
  };
}
