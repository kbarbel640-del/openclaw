import type { TranslationMap } from "../lib/types.ts";
import { mergeTranslations } from "./_merge.ts";
import { uk_base } from "./uk/base.ts";
import { uk_ui } from "./uk/ui.ts";

export const uk: TranslationMap = mergeTranslations(uk_base, uk_ui);
