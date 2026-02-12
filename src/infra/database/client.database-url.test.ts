import { describe, expect, it, beforeEach, afterEach } from "vitest";

// Import module under test dynamically so env changes apply.
async function loadModule() {
  const mod = await import("./client.js");
  return mod;
}

describe("infra/database client (DATABASE_URL)", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("parses DATABASE_URL and prefers it over POSTGRES_*", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@db.local:5433/mydb?sslmode=require";
    process.env.POSTGRES_HOST = "should-not-win";
    const { getDatabaseConfig } = await loadModule();
    const cfg = getDatabaseConfig();
    expect(cfg.host).toBe("db.local");
    expect(cfg.port).toBe(5433);
    expect(cfg.database).toBe("mydb");
    expect(cfg.username).toBe("u");
    expect(cfg.password).toBe("p");
    expect(cfg.ssl).toBe(true);
    expect(cfg.url).toBe(process.env.DATABASE_URL);
  });
});
