import { en } from "./en.js";
import { zhCN } from "./zh-CN.js";

export type Locale = "en" | "zh-CN";

export const locales = {
    en,
    "zh-CN": zhCN,
};

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
    currentLocale = locale;
}

export function getLocale(): Locale {
    return currentLocale;
}

export function t() {
    return locales[currentLocale];
}
