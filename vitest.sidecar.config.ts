import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    pool: "forks",
    include: ["sidecars/ted-engine/tests/**/*.test.mjs"],
    exclude: ["**/node_modules/**"],
  },
});
