import { parseAbsoluteTimeMs } from "./src/cron/parse.js";

const input = "2024-05-18T10:00:00.000Z+05:30";
const parsed = parseAbsoluteTimeMs(input);

console.log(`Input: ${input}`);
console.log(`Parsed: ${parsed}`);

if (parsed && !isNaN(parsed)) {
  console.log("SUCCESS: Parsed valid timestamp");
} else {
  console.log("FAILURE: Could not parse timestamp");
  process.exit(1);
}
