
import { zhCN } from "./locales/zh-CN.js";

const currentLocale = "zh-CN"; // Default to Chinese
const locales: Record<string, any> = {
    "zh-CN": zhCN,
};

export function t(key: string, args?: Record<string, string | number>): string {
    const keys = key.split(".");
    let value = locales[currentLocale];
    for (const k of keys) {
        if (value && typeof value === "object") {
            value = value[k];
        } else {
            return key;
        }
    }
    let str = typeof value === "string" ? value : key;
    if (args) {
        for (const [k, v] of Object.entries(args)) {
            str = str.replace(new RegExp(`{${k}}`, "g"), String(v));
        }
    }
    return str;
}
