import { askChoice } from "../src/telegram/interactive-question";

const TEST_CHAT_ID = process.env.TEST_CHAT_ID;

async function run() {
  if (!TEST_CHAT_ID) {
    console.error("Please set TEST_CHAT_ID env var");
    process.exit(1);
  }

  console.log("Sending interactive question...");
  const result = await askChoice({
    chatId: TEST_CHAT_ID,
    question: "What is your favorite fruit?",
    choices: [
      { label: "Apple 🍎", value: "apple" },
      { label: "Banana 🍌", value: "banana" },
      { label: "Cherry 🍒", value: "cherry" },
      { label: "Dragonfruit 🐉", value: "dragonfruit" },
    ],
    allowText: true,
    timeoutMs: 30000,
  });

  console.log("Interactive result:", result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
