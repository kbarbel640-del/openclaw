export { GOVERNANCE_PROMPT } from "./governance.js";
export { REACH_PROMPT } from "./reach.js";
export { AGENCY_PROMPT } from "./agency.js";
export { SAFEGUARDS_PROMPT } from "./safeguards.js";
export { POTENTIAL_DAMAGE_PROMPT } from "./potential-damage.js";

import type { DimensionPrompt } from "../types.js";
import { GOVERNANCE_PROMPT } from "./governance.js";
import { REACH_PROMPT } from "./reach.js";
import { AGENCY_PROMPT } from "./agency.js";
import { SAFEGUARDS_PROMPT } from "./safeguards.js";
import { POTENTIAL_DAMAGE_PROMPT } from "./potential-damage.js";

export const ALL_DIMENSION_PROMPTS: DimensionPrompt[] = [
  GOVERNANCE_PROMPT,
  REACH_PROMPT,
  AGENCY_PROMPT,
  SAFEGUARDS_PROMPT,
  POTENTIAL_DAMAGE_PROMPT,
];
