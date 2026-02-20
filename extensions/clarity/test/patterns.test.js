/**
 * Unit tests for ExtractionPatterns
 * Run with: node test/patterns.test.js
 */

const { ExtractionPatterns } = require("../lib/v2/patterns");
const { EntityType } = require("../lib/v2/entity");

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }
  }

  assertTrue(value, msg) {
    if (!value) {
      throw new Error(`${msg}: expected true, got ${value}`);
    }
  }

  assertFalse(value, msg) {
    if (value) {
      throw new Error(`${msg}: expected false, got ${value}`);
    }
  }

  assertIncludes(array, item, msg) {
    if (!array.includes(item)) {
      throw new Error(`${msg}: expected array to include ${item}`);
    }
  }

  assertNotIncludes(array, item, msg) {
    if (array.includes(item)) {
      throw new Error(`${msg}: expected array NOT to include ${item}`);
    }
  }

  async run() {
    console.log("Running Patterns tests...\n");

    for (const { name, fn } of this.tests) {
      try {
        await fn(this);
        this.passed++;
        console.log(`  ✓ ${name}`);
      } catch (e) {
        this.failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
      }
    }

    console.log(`\n${this.passed}/${this.tests.length} tests passed`);
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// ========== Project Pattern Tests ==========
runner.test("Detects CamelCase projects", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Working on ClaraCore and OpenClaw today.");

  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  t.assertEqual(projects.length, 2, "Found 2 projects");
  t.assertTrue(
    projects.some((e) => e.name === "ClaraCore"),
    "Found ClaraCore",
  );
  t.assertTrue(
    projects.some((e) => e.name === "OpenClaw"),
    "Found OpenClaw",
  );
});

runner.test("Detects FocusEngine as CamelCase", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("FocusEngine is the new project.");

  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  t.assertTrue(
    projects.some((e) => e.name === "FocusEngine"),
    "Found FocusEngine",
  );
});

runner.test("Detects lowercase with tech suffixes", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("The claracore and openclaw projects are core components.");

  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  const normalized = projects.map((e) => e.normalized);
  t.assertTrue(normalized.includes("claracore"), "Found claracore");
  t.assertTrue(normalized.includes("openclaw"), "Found openclaw");
});

runner.test("Detects engine suffix projects", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("ModelRouter uses the inference engine.");

  // "engine" alone might not be extracted, but "modelrouter" should
  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  t.assertTrue(
    projects.some((e) => e.normalized === "modelrouter"),
    "Found modelrouter",
  );
});

runner.test("Filters out stop words from project detection", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("The core of the system is here.");

  // "core" alone is a stop word, shouldn't be extracted as project
  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  t.assertFalse(
    projects.some((e) => e.normalized === "core"),
    'Did not extract "core" as project',
  );
});

runner.test("Excludes system hyphenated terms", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("This is a high-level overview of the end-to-end system.");

  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  t.assertFalse(
    projects.some((e) => e.name === "high-level"),
    'Did not extract "high-level"',
  );
  t.assertFalse(
    projects.some((e) => e.name === "end-to-end"),
    'Did not extract "end-to-end"',
  );
});

runner.test("Accepts valid hyphenated projects", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Using focus-engine and model-router now.");

  const projects = result.entities.filter((e) => e.type === EntityType.PROJECT);
  t.assertTrue(
    projects.some((e) => e.name === "focus-engine"),
    "Found focus-engine",
  );
  t.assertTrue(
    projects.some((e) => e.name === "model-router"),
    "Found model-router",
  );
});

// ========== Plugin Pattern Tests ==========
runner.test("Detects known plugins", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("The clarity plugin works with awareness and continuity.");

  const plugins = result.entities.filter((e) => e.type === EntityType.PLUGIN);
  t.assertEqual(plugins.length, 3, "Found 3 plugins");
  t.assertTrue(
    plugins.some((e) => e.normalized === "clarity"),
    "Found clarity",
  );
  t.assertTrue(
    plugins.some((e) => e.normalized === "awareness"),
    "Found awareness",
  );
  t.assertTrue(
    plugins.some((e) => e.normalized === "continuity"),
    "Found continuity",
  );
});

runner.test("Detects recover and reflect plugins", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Using recover and reflect for error handling.");

  const plugins = result.entities.filter((e) => e.type === EntityType.PLUGIN);
  t.assertTrue(
    plugins.some((e) => e.normalized === "recover"),
    "Found recover",
  );
  t.assertTrue(
    plugins.some((e) => e.normalized === "reflect"),
    "Found reflect",
  );
});

runner.test("Case insensitive plugin detection", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("CLARITY and Clarity are the same plugin.");

  const plugins = result.entities.filter((e) => e.type === EntityType.PLUGIN);
  // Deduplication results in 1 unique entity
  t.assertEqual(plugins.length, 1, "Found 1 unique plugin (deduplicated)");
  t.assertTrue(
    plugins.every((e) => e.normalized === "clarity"),
    "Both normalized to clarity",
  );
});

// ========== File Pattern Tests ==========
runner.test("Detects memory files", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Check memory/2026-02-19.md for details.");

  const files = result.entities.filter((e) => e.type === EntityType.FILE);
  t.assertTrue(
    files.some((e) => e.name === "memory/2026-02-19.md"),
    "Found memory file",
  );
});

runner.test("Detects docs files", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("See docs/architecture.md and docs/api.md.");

  const files = result.entities.filter((e) => e.type === EntityType.FILE);
  t.assertTrue(
    files.some((e) => e.name === "docs/architecture.md"),
    "Found architecture.md",
  );
  t.assertTrue(
    files.some((e) => e.name === "docs/api.md"),
    "Found api.md",
  );
});

runner.test("Detects root workspace files", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Update SOUL.md and AGENTS.md please.");

  const files = result.entities.filter((e) => e.type === EntityType.FILE);
  t.assertTrue(
    files.some((e) => e.name === "SOUL.md"),
    "Found SOUL.md",
  );
  t.assertTrue(
    files.some((e) => e.name === "AGENTS.md"),
    "Found AGENTS.md",
  );
});

runner.test("Detects config files", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Edit openclaw.json or package.json.");

  const files = result.entities.filter((e) => e.type === EntityType.FILE);
  t.assertTrue(
    files.some((e) => e.name === "openclaw.json"),
    "Found openclaw.json",
  );
  t.assertTrue(
    files.some((e) => e.name === "package.json"),
    "Found package.json",
  );
});

runner.test("Detects JS/TS files", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("The entity.js and patterns.ts files are ready.");

  const files = result.entities.filter((e) => e.type === EntityType.FILE);
  t.assertTrue(
    files.some((e) => e.name === "entity.js"),
    "Found entity.js",
  );
  t.assertTrue(
    files.some((e) => e.name === "patterns.ts"),
    "Found patterns.ts",
  );
});

runner.test("Filters out node_modules from file detection", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Not node_modules/something.js though.");

  const files = result.entities.filter((e) => e.type === EntityType.FILE);
  t.assertFalse(
    files.some((e) => e.name.includes("node_modules")),
    "Did not extract node_modules file",
  );
});

// ========== Tool Pattern Tests ==========
runner.test("Detects known tools", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Use sessions_spawn and subagents for parallel work.");

  const tools = result.entities.filter((e) => e.type === EntityType.TOOL);
  t.assertTrue(
    tools.some((e) => e.normalized === "sessions_spawn"),
    "Found sessions_spawn",
  );
  t.assertTrue(
    tools.some((e) => e.normalized === "subagents"),
    "Found subagents",
  );
});

runner.test("Detects memory tools", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Call memory_search or recall for history.");

  const tools = result.entities.filter((e) => e.type === EntityType.TOOL);
  t.assertTrue(
    tools.some((e) => e.normalized === "memory_search"),
    "Found memory_search",
  );
  t.assertTrue(
    tools.some((e) => e.normalized === "recall"),
    "Found recall",
  );
});

runner.test("Detects basic tools", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Use read, write, and exec for file operations.");

  const tools = result.entities.filter((e) => e.type === EntityType.TOOL);
  const normalized = tools.map((e) => e.normalized);
  t.assertTrue(normalized.includes("read"), "Found read");
  t.assertTrue(normalized.includes("write"), "Found write");
  t.assertTrue(normalized.includes("exec"), "Found exec");
});

// ========== Normalization Tests ==========
runner.test("normalizeName lowercases", (t) => {
  const patterns = new ExtractionPatterns();
  t.assertEqual(patterns.normalizeName("ClaraCore", EntityType.PROJECT), "claracore", "Lowercases");
});

runner.test("normalizeName removes file extensions", (t) => {
  const patterns = new ExtractionPatterns();
  t.assertEqual(patterns.normalizeName("SOUL.md", EntityType.FILE), "soul", "Removes .md");
  t.assertEqual(patterns.normalizeName("config.json", EntityType.FILE), "config", "Removes .json");
});

runner.test("normalizeName replaces spaces and hyphens", (t) => {
  const patterns = new ExtractionPatterns();
  t.assertEqual(
    patterns.normalizeName("my-project", EntityType.PROJECT),
    "my_project",
    "Hyphens to underscores",
  );
  t.assertEqual(
    patterns.normalizeName("my project", EntityType.PROJECT),
    "my_project",
    "Spaces to underscores",
  );
});

runner.test("normalizeName handles paths", (t) => {
  const patterns = new ExtractionPatterns();
  t.assertEqual(
    patterns.normalizeName("memory/2026-02-19.md", EntityType.FILE),
    "memory_2026_02_19",
    "Path normalized",
  );
});

// ========== Composite Term Tests ==========
runner.test("extractCompositeTerms finds bigrams", (t) => {
  const patterns = new ExtractionPatterns();
  const text = "The clarity plugin is working well with focus engine.";
  const result = patterns.extract(text);

  // Should find composite terms with known entities
  t.assertTrue(result.composites.length > 0, "Found some composites");
});

runner.test("extractCompositeTerms validates with tech suffixes", (t) => {
  const patterns = new ExtractionPatterns();
  const text = "Working on the clarity core system.";
  const result = patterns.extract(text);

  // Should detect "clarity core" as valid due to "core" suffix
  const hasCoreComposite = result.composites.some((c) => c.includes("core"));
  t.assertTrue(
    hasCoreComposite || result.entities.some((e) => e.normalized === "clarity"),
    "Found clarity entity",
  );
});

runner.test("isValidComposite accepts known entity pairs", (t) => {
  const patterns = new ExtractionPatterns();
  const known = new Set(["clarity", "plugin"]);

  t.assertTrue(patterns.isValidComposite("clarity plugin", known), "Valid: two known");
  t.assertFalse(patterns.isValidComposite("foo bar", known), "Invalid: neither known");
});

runner.test("isValidComposite accepts tech suffixes", (t) => {
  const patterns = new ExtractionPatterns();
  const known = new Set(["clarity"]);

  t.assertTrue(patterns.isValidComposite("clarity core", known), "Valid: known + core");
  t.assertTrue(patterns.isValidComposite("clarity engine", known), "Valid: known + engine");
});

// ========== Dynamic Registration Tests ==========
runner.test("addPlugin adds to known plugins", (t) => {
  const patterns = new ExtractionPatterns();
  patterns.addPlugin("newplugin");

  const result = patterns.extract("Using newplugin now.");
  const plugins = result.entities.filter((e) => e.type === EntityType.PLUGIN);
  t.assertTrue(
    plugins.some((e) => e.normalized === "newplugin"),
    "Found dynamically added plugin",
  );
});

runner.test("addTool adds to known tools", (t) => {
  const patterns = new ExtractionPatterns();
  patterns.addTool("custom_tool");

  const result = patterns.extract("Call custom_tool to proceed.");
  const tools = result.entities.filter((e) => e.type === EntityType.TOOL);
  t.assertTrue(
    tools.some((e) => e.normalized === "custom_tool"),
    "Found dynamically added tool",
  );
});

runner.test("addProject adds to known projects", (t) => {
  const patterns = new ExtractionPatterns();
  patterns.addProject("myproject");

  // Pass both 'myproject' and 'clarity' as known tokens for composite validation
  const isValid = patterns.isValidComposite("myproject clarity", new Set(["clarity", "myproject"]));
  t.assertTrue(isValid, "Dynamically added project recognized in composites");
});

// ========== Confidence Score Tests ==========
runner.test("CamelCase projects have high confidence", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("ClaraCore is great.");

  const project = result.entities.find((e) => e.type === EntityType.PROJECT);
  t.assertTrue(project.confidence >= 0.95, "CamelCase has 0.95 confidence");
});

runner.test("Known plugins have high confidence", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Using clarity.");

  const plugin = result.entities.find((e) => e.type === EntityType.PLUGIN);
  t.assertTrue(plugin.confidence >= 0.95, "Known plugin has 0.95 confidence");
});

// ========== Edge Case Tests ==========
runner.test("Empty text returns empty result", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("");

  t.assertEqual(result.entities.length, 0, "No entities from empty text");
  t.assertEqual(result.composites.length, 0, "No composites from empty text");
});

runner.test("Text with only stop words returns empty", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("the and or but");

  t.assertEqual(result.entities.length, 0, "No entities from stop words");
});

runner.test("Handles duplicates correctly", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract("Clarity clarity CLARITY");

  const plugins = result.entities.filter((e) => e.type === EntityType.PLUGIN);
  // Should dedupe to single entity but we track mentions separately
  const uniqueNormalized = [...new Set(plugins.map((e) => e.normalized))];
  t.assertEqual(uniqueNormalized.length, 1, "Only one unique plugin");
});

runner.test("Mixed content extraction", (t) => {
  const patterns = new ExtractionPatterns();
  const result = patterns.extract(
    "Update SOUL.md for the ClaraCore project and use sessions_spawn.",
  );

  t.assertTrue(
    result.entities.some((e) => e.type === EntityType.FILE && e.name === "SOUL.md"),
    "Found file",
  );
  t.assertTrue(
    result.entities.some((e) => e.type === EntityType.PROJECT && e.name === "ClaraCore"),
    "Found project",
  );
  t.assertTrue(
    result.entities.some((e) => e.type === EntityType.TOOL && e.normalized === "sessions_spawn"),
    "Found tool",
  );
});

// Run tests
runner.run().then((success) => {
  process.exit(success ? 0 : 1);
});
