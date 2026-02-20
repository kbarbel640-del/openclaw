/**
 * Dynamic Relevance Scoring - Test Suite
 *
 * Tests the specific scenarios from the implementation spec:
 * 1. "Fix the session timeout bug" → session should appear (relevant to task)
 * 2. "Deploy the model to production" → model should appear
 * 3. "Write a poem about spring" → model filtered (not relevant)
 */

const { DynamicRelevanceScorer, formatClarityContext } = require("./dynamic-relevance");

// Test colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function test(name, fn) {
  try {
    fn();
    console.log(`${GREEN}✓${RESET} ${name}`);
    return true;
  } catch (err) {
    console.log(`${RED}✗${RESET} ${name}`);
    console.log(`  ${RED}Error:${RESET} ${err.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// ============================================
// SPECIFIC SCENARIO TESTS
// ============================================

console.log("\n" + "=".repeat(60));
console.log("Dynamic Relevance - Scenario Tests");
console.log("=".repeat(60) + "\n");

let passed = 0;
let failed = 0;

// Scenario 1: "Fix the session timeout bug" → session should appear
if (
  test('Scenario 1: "Fix the session timeout bug" - session appears', () => {
    const scorer = new DynamicRelevanceScorer();
    scorer.setCurrentTask({ description: "Fix the session timeout bug in authentication module" });

    scorer.addTurn({
      number: 1,
      userMessage: "Fix the session timeout bug",
      aiResponse:
        "I'll investigate the session timeout issue. Let me check the session configuration and fix the bug.",
      entities: [
        { term: "session", type: "keyword" },
        { term: "timeout", type: "keyword" },
      ],
    });

    const result = scorer.scoreRelevance({
      term: "session",
      type: "keyword",
      lastMentionTurn: 1,
    });

    assert(result.score >= 70, `Expected score >= 70, got ${result.score}`);
    assert(
      result.category.label === "Immediate" || result.category.label === "Useful",
      `Expected Immediate or Useful category, got ${result.category.label}`,
    );

    // Verify it has action context
    const hasActionSignal = result.signals.some((s) => s.type === "action");
    assert(hasActionSignal, 'Should have action signal ("fix" verb detected)');
  })
)
  passed++;
else failed++;

// Scenario 2: "Deploy the model to production" → model should appear
if (
  test('Scenario 2: "Deploy the model to production" - model appears', () => {
    const scorer = new DynamicRelevanceScorer();
    scorer.setCurrentTask({ description: "Deploy ML model to production environment" });

    scorer.addTurn({
      number: 1,
      userMessage: "Deploy the model to production",
      aiResponse:
        "I'll help you deploy the model. First, let me check the model configuration and prepare the deployment.",
      entities: [
        { term: "model", type: "keyword" },
        { term: "production", type: "keyword" },
      ],
    });

    const result = scorer.scoreRelevance({
      term: "model",
      type: "keyword",
      lastMentionTurn: 1,
    });

    assert(result.score >= 70, `Expected score >= 70, got ${result.score}`);
    assert(
      result.signals.some((s) => s.type === "action"),
      'Should have action signal ("deploy" verb)',
    );
    assert(
      result.signals.some((s) => s.type === "task"),
      "Should have task signal",
    );
  })
)
  passed++;
else failed++;

// Scenario 3: "Write a poem about spring" → model filtered (not relevant)
if (
  test('Scenario 3: "Write a poem about spring" - model is filtered', () => {
    const scorer = new DynamicRelevanceScorer();
    scorer.setCurrentTask({ description: "Write a creative poem" });

    scorer.addTurn({
      number: 1,
      userMessage: "Write a poem about spring",
      aiResponse: "Here's a poem about spring:\n\nBlossoms open wide...",
      entities: [
        { term: "model", type: "keyword" },
        { term: "poem", type: "keyword" },
      ],
    });

    const result = scorer.scoreRelevance({
      term: "model",
      type: "keyword",
      lastMentionTurn: 1,
    });

    // Model should have low score because:
    // 1. It's a generic term
    // 2. It wasn't actually referenced in response
    // 3. No action context for "model"
    assert(
      result.score < 40,
      `Expected score < 40 for irrelevant generic term, got ${result.score}`,
    );

    // Verify it has generic flag
    const hasGenericFlag = result.signals.some((s) => s.type === "generic");
    assert(hasGenericFlag, "Should have generic flag (model is a generic term without context)");
  })
)
  passed++;
else failed++;

// ============================================
// RELEVANCE SIGNAL TESTS
// ============================================

console.log("\n" + "-".repeat(60));
console.log("Relevance Signal Tests");
console.log("-".repeat(60) + "\n");

// Test: Referenced in response (+50)
if (
  test("Signal: Referenced in response (+50)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "Tell me about claracore",
      aiResponse: "ClaraCore is a project. I can tell you more about claracore if you'd like.",
      entities: [{ term: "claracore", type: "project" }],
    });

    const result = scorer.scoreRelevance({
      term: "claracore",
      type: "project",
      lastMentionTurn: 1,
    });

    assert(
      result.signals.some((s) => s.type === "referenced" && s.weight === 50),
      "Should have referenced signal with +50 weight",
    );
  })
)
  passed++;
else failed++;

// Test: Action verb present (+30)
if (
  test("Signal: Action verb present (+30)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "Deploy the server",
      aiResponse: "I'll deploy it now.",
      entities: [{ term: "server", type: "keyword" }],
    });

    const result = scorer.scoreRelevance({
      term: "server",
      type: "keyword",
      lastMentionTurn: 1,
    });

    assert(
      result.signals.some((s) => s.type === "action" && s.weight === 30),
      "Should have action signal with +30 weight",
    );
  })
)
  passed++;
else failed++;

// Test: Question marked (+20)
if (
  test("Signal: Question marked (+20)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "What is Redis used for?",
      aiResponse: "Redis is a key-value store.",
      entities: [{ term: "redis", type: "tool" }],
    });

    const result = scorer.scoreRelevance({
      term: "redis",
      type: "tool",
      lastMentionTurn: 1,
    });

    assert(
      result.signals.some((s) => s.type === "question" && s.weight === 20),
      "Should have question signal with +20 weight",
    );
  })
)
  passed++;
else failed++;

// Test: Part of current task (+25)
if (
  test("Signal: Part of current task (+25)", () => {
    const scorer = new DynamicRelevanceScorer();
    scorer.setCurrentTask({ description: "Fix the database connection pool" });

    scorer.addTurn({
      number: 1,
      userMessage: "Check the connection pool",
      aiResponse: "Looking at the connection pool now.",
      entities: [{ term: "database", type: "keyword" }],
    });

    const result = scorer.scoreRelevance({
      term: "database",
      type: "keyword",
      lastMentionTurn: 1,
    });

    assert(
      result.signals.some((s) => s.type === "task" && s.weight === 25),
      "Should have task signal with +25 weight",
    );
  })
)
  passed++;
else failed++;

// Test: Multiple mentions (+15)
if (
  test("Signal: Multiple mentions (+15)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "I need to fix the bug",
      aiResponse: "What bug are you referring to?",
      entities: [{ term: "bug", type: "keyword" }],
    });

    scorer.addTurn({
      number: 2,
      userMessage: "The login bug",
      aiResponse: "I'll fix the login bug.",
      entities: [
        { term: "bug", type: "keyword" },
        { term: "login", type: "keyword" },
      ],
    });

    const result = scorer.scoreRelevance({
      term: "bug",
      type: "keyword",
      lastMentionTurn: 2,
    });

    assert(
      result.signals.some((s) => s.type === "frequency" && s.weight === 15),
      "Should have frequency signal with +15 weight",
    );
  })
)
  passed++;
else failed++;

// Test: Single mention without context (-10)
if (
  test("Signal: Single mention without context (-10)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "Hello",
      aiResponse: "Hi there!",
      entities: [{ term: "token", type: "keyword" }], // Generic term, no context
    });

    const result = scorer.scoreRelevance({
      term: "token",
      type: "keyword",
      lastMentionTurn: 1,
      mentionCount: 1,
    });

    assert(
      result.signals.some((s) => s.type === "noise" && s.weight === -10),
      "Should have noise signal with -10 weight",
    );
  })
)
  passed++;
else failed++;

// ============================================
// DYNAMIC THRESHOLD TESTS
// ============================================

console.log("\n" + "-".repeat(60));
console.log("Dynamic Threshold Tests");
console.log("-".repeat(60) + "\n");

// Test: High information density threshold
if (
  test("Threshold: High density conversation shows more items", () => {
    const scorer = new DynamicRelevanceScorer();

    // Simulate high-density conversation (many entities per word)
    for (let i = 1; i <= 3; i++) {
      scorer.addTurn({
        number: i,
        userMessage: `Update ${i}`,
        aiResponse: `Working on claracore, redis, subagents, session, model, deployment config changes.`,
        entities: [
          { term: "claracore", type: "project" },
          { term: "redis", type: "tool" },
          { term: "subagents", type: "tool" },
          { term: "session", type: "keyword" },
          { term: "model", type: "keyword" },
          { term: "deployment", type: "keyword" },
        ],
      });
    }

    const threshold = scorer.calculateDynamicThreshold();
    assert(threshold.limit >= 5, "High density should show 5+ items");
    assert(threshold.minScore <= 30, "High density should have lower min score");
  })
)
  passed++;
else failed++;

// Test: Simple question threshold
if (
  test("Threshold: Simple question shows fewer items", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "What time is it?",
      aiResponse: "It's 3 PM.",
      entities: [{ term: "time", type: "keyword" }],
    });

    const threshold = scorer.calculateDynamicThreshold();
    assert(threshold.limit <= 3, "Simple question should show <= 3 items");
    assert(threshold.minScore >= 30, "Simple question should have higher min score");
  })
)
  passed++;
else failed++;

// ============================================
// CATEGORY TESTS
// ============================================

console.log("\n" + "-".repeat(60));
console.log("Relevance Category Tests");
console.log("-".repeat(60) + "\n");

// Test: Immediate category (>=70)
if (
  test("Category: 🔥 Immediate (score >= 70)", () => {
    const scorer = new DynamicRelevanceScorer();
    scorer.setCurrentTask({ description: "Fix the critical bug" });

    scorer.addTurn({
      number: 1,
      userMessage: "Fix the critical bug now!",
      aiResponse: "I'll fix the critical bug immediately.",
      entities: [{ term: "critical", type: "keyword" }],
    });

    const result = scorer.scoreRelevance({
      term: "critical",
      type: "keyword",
      lastMentionTurn: 1,
    });

    assert(result.category.icon === "🔥", "Should be 🔥 Immediate category");
    assert(result.score >= 70, "Immediate should have score >= 70");
  })
)
  passed++;
else failed++;

// Test: Useful category (40-69)
if (
  test("Category: ⭐ Useful (40-69)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "We should look at Redis",
      aiResponse: "Redis is a good choice.",
      entities: [{ term: "redis", type: "tool" }],
    });

    const result = scorer.scoreRelevance({
      term: "redis",
      type: "tool",
      lastMentionTurn: 1,
    });

    // Should be Useful or better based on action context
    assert(result.score >= 40, "Should have score >= 40");
  })
)
  passed++;
else failed++;

// Test: Background category (20-39)
if (
  test("Category: ○ Background (20-39)", () => {
    const scorer = new DynamicRelevanceScorer();

    scorer.addTurn({
      number: 1,
      userMessage: "Hello",
      aiResponse: "Hi!",
      entities: [{ term: "hello", type: "keyword" }],
    });

    scorer.addTurn({
      number: 2,
      userMessage: "By the way, we use Python",
      aiResponse: "Python is great.",
      entities: [{ term: "python", type: "keyword" }],
    });

    const result = scorer.scoreRelevance({
      term: "python",
      type: "keyword",
      lastMentionTurn: 2,
    });

    // Python mentioned once, no strong context = Background or lower
    assert(
      result.category.label === "Background" || result.score < 40,
      "Should be Background or lower for single mention without strong context",
    );
  })
)
  passed++;
else failed++;

// ============================================
// FORMAT OUTPUT TESTS
// ============================================

console.log("\n" + "-".repeat(60));
console.log("Format Output Tests");
console.log("-".repeat(60) + "\n");

// Test: formatClarityContext produces expected structure
if (
  test("Format: Shows WHY items are relevant", () => {
    const scoredEntities = [
      {
        term: "claracore",
        type: "project",
        score: 95,
        signals: [
          { type: "referenced", weight: 50, description: "you just referenced this" },
          {
            type: "action",
            weight: 30,
            description: 'mentioned with "fix"',
            context: "Fix the bug in claracore",
          },
          { type: "task", weight: 25, description: "needed for current task" },
        ],
        category: { icon: "🔥", label: "Immediate", min: 70 },
      },
      {
        term: "subagents",
        type: "tool",
        score: 55,
        signals: [{ type: "action", weight: 30, description: 'mentioned with "using"' }],
        category: { icon: "⭐", label: "Useful", min: 40 },
      },
    ];

    const output = formatClarityContext(scoredEntities);

    assert(output.includes("[CLARITY CONTEXT]"), "Should have header");
    assert(output.includes("🔥 project:claracore"), "Should show Immediate item");
    assert(output.includes("you just referenced this"), "Should explain WHY");
    assert(output.includes("⭐ tool:subagents"), "Should show Useful item");
    assert(output.includes("try subagents"), "Should suggest action");
  })
)
  passed++;
else failed++;

// ============================================
// SUMMARY
// ============================================

console.log("\n" + "=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60) + "\n");

if (failed > 0) {
  process.exit(1);
}

// Print demo output
console.log("\n" + "=".repeat(60));
console.log("Demo: formatClarityContext Output");
console.log("=".repeat(60) + "\n");

const demoEntities = [
  {
    term: "claracore",
    type: "project",
    score: 95,
    signals: [
      { type: "referenced", weight: 50, description: "you just referenced this" },
      {
        type: "action",
        weight: 30,
        description: 'mentioned with "fix"',
        context: "Fix the session bug in claracore",
      },
      { type: "task", weight: 25, description: "needed for current task" },
    ],
    category: { icon: "🔥", label: "Immediate", min: 70 },
  },
  {
    term: "subagents",
    type: "tool",
    score: 55,
    signals: [
      { type: "action", weight: 30, description: 'mentioned with "using"' },
      { type: "frequency", weight: 15, description: "mentioned 3 times recently" },
    ],
    category: { icon: "⭐", label: "Useful", min: 40 },
  },
  {
    term: "session",
    type: "keyword",
    score: 85,
    signals: [
      { type: "referenced", weight: 50, description: "you just referenced this" },
      { type: "action", weight: 30, description: 'mentioned with "fix"' },
      { type: "task", weight: 25, description: "needed for current task" },
      { type: "generic-contextual", weight: 0, description: "generic term with strong context" },
    ],
    category: { icon: "🔥", label: "Immediate", min: 70 },
  },
];

console.log(formatClarityContext(demoEntities));

console.log("\n" + "=".repeat(60));
console.log("Dynamic Relevance Scoring - Implementation Complete");
console.log("=".repeat(60));
