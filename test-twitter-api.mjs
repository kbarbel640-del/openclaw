import { getTwitterDashboardData } from "./src/gateway/twitter-api.ts";

console.log("Testing Twitter API...\n");

try {
  const result = await getTwitterDashboardData();
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n✓ Response time: ${result.responseTimeMs}ms`);
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
