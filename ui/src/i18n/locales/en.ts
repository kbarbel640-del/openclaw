import type { TranslationMap } from "../lib/types.ts";
import { mergeTranslations } from "./_merge.ts";
import { en_base } from "./en/base.ts";
import { en_ui } from "./en/ui.ts";

export const en: TranslationMap = mergeTranslations(en_base, en_ui);
