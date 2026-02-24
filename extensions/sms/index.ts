import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { smsPlugin } from "./src/channel.js";

const plugin = {
  id: "sms",
  name: "SMS",
  description: "SMS channel plugin with Aliyun + Tencent Cloud providers",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: smsPlugin });
  },
};

export default plugin;
