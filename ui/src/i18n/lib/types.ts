export type TranslationMap = { [key: string]: string | TranslationMap };

export type Locale = "en" | "zh-CN" | "zh-TW" | "pt-BR" | "nl" | "fr" | "de" | "it";

export interface I18nConfig {
  locale: Locale;
  fallbackLocale: Locale;
  translations: Record<Locale, TranslationMap>;
}
