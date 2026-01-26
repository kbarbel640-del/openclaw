import { describe, expect, it } from "vitest";
import { isOllamaUrlSafe, getSafeOllamaUrl } from "./ollama-security.js";

describe("Ollama Security", () => {
  describe("isOllamaUrlSafe", () => {
    it("should allow localhost URLs", () => {
      expect(isOllamaUrlSafe("http://localhost:11434")).toBe(true);
      expect(isOllamaUrlSafe("http://127.0.0.1:11434")).toBe(true);
      expect(isOllamaUrlSafe("http://[::1]:11434")).toBe(true);
    });

    it("should reject non-localhost URLs", () => {
      expect(isOllamaUrlSafe("http://0.0.0.0:11434")).toBe(false);
      expect(isOllamaUrlSafe("http://192.168.1.100:11434")).toBe(false);
      expect(isOllamaUrlSafe("http://10.0.0.1:11434")).toBe(false);
      expect(isOllamaUrlSafe("http://ollama.example.com:11434")).toBe(false);
      expect(isOllamaUrlSafe("http://my-server:11434")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(isOllamaUrlSafe("not-a-url")).toBe(false);
      expect(isOllamaUrlSafe("")).toBe(false);
    });
  });

  describe("getSafeOllamaUrl", () => {
    it("should always return localhost URL", () => {
      expect(getSafeOllamaUrl()).toBe("http://127.0.0.1:11434");
    });
  });
});
