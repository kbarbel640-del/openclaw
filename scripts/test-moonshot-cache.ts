#!/usr/bin/env npx tsx
/**
 * Manual test script for Moonshot context caching.
 *
 * Usage:
 *   MOONSHOT_API_KEY=sk-xxx npx tsx scripts/test-moonshot-cache.ts
 */

const API_KEY = process.env.MOONSHOT_API_KEY;
const BASE_URL = "https://api.moonshot.cn/v1";

if (!API_KEY) {
  console.error("❌ MOONSHOT_API_KEY environment variable required");
  process.exit(1);
}

async function createCache(): Promise<string> {
  console.log("\n📦 Creating cache...");

  const response = await fetch(`${BASE_URL}/caching`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1", // Note: caching API uses base model name without suffix
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. This is a test system prompt with some content to cache. Here is additional context about various topics including science, history, and technology that would typically be repeated in every API request. ".repeat(
              200,
            ),
        },
      ],
      ttl: 300,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cache creation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  console.log("✅ Cache created:", {
    id: data.id,
    tokens: data.tokens,
    status: data.status,
  });

  return data.id;
}

async function chatWithCache(cacheId: string, message: string): Promise<void> {
  console.log(`\n💬 Sending message with cache: "${message}"`);

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      messages: [
        {
          role: "cache",
          content: `cache_id=${cacheId};reset_ttl=300`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  console.log("✅ Response received");
  console.log("   Reply:", data.choices[0].message.content.slice(0, 100) + "...");
  console.log("   Usage:", JSON.stringify(data.usage, null, 2));
}

async function chatWithoutCache(message: string): Promise<void> {
  console.log(`\n💬 Sending message WITHOUT cache: "${message}"`);

  const systemPrompt =
    "You are a helpful assistant. This is a test system prompt with some content to cache. Here is additional context about various topics including science, history, and technology that would typically be repeated in every API request. ".repeat(
      200,
    );

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  console.log("✅ Response received");
  console.log("   Reply:", data.choices[0].message.content.slice(0, 100) + "...");
  console.log("   Usage:", JSON.stringify(data.usage, null, 2));
}

async function deleteCache(cacheId: string): Promise<void> {
  console.log(`\n🗑️ Deleting cache ${cacheId}...`);

  await fetch(`${BASE_URL}/caching/${cacheId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  console.log("✅ Cache deleted");
}

async function main() {
  console.log("🧪 Moonshot Context Cache Test\n");
  console.log("=".repeat(50));

  // Test 1: Without cache (baseline)
  console.log("\n📊 TEST 1: Request WITHOUT cache (baseline)");
  await chatWithoutCache("What is 2+2?");

  // Test 2: Create cache and use it
  console.log("\n📊 TEST 2: Request WITH cache");
  const cacheId = await createCache();
  await chatWithCache(cacheId, "What is 2+2?");

  // Test 3: Reuse same cache
  console.log("\n📊 TEST 3: Reuse same cache (should show cache hit in usage)");
  await chatWithCache(cacheId, "What is 3+3?");

  // Cleanup
  await deleteCache(cacheId);

  console.log("\n" + "=".repeat(50));
  console.log("✅ Test complete! Compare usage stats above.");
  console.log("   - Without cache: prompt_tokens should be ~2500");
  console.log("   - With cache: prompt_tokens should be much lower");
  console.log("   - Look for cache_read_tokens or similar in usage");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
