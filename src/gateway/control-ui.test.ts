import { describe, expect, it } from "vitest";

// Test the avatar URL patterns that the UI should accept
describe("Control UI avatar URL patterns", () => {
  const isAvatarUrl = (value: string): boolean => {
    return (
      /^https?:\/\//i.test(value) || /^data:image\//i.test(value) || value.startsWith("/avatar/")
    );
  };

  it("accepts https URLs", () => {
    expect(isAvatarUrl("https://example.com/avatar.png")).toBe(true);
  });

  it("accepts http URLs", () => {
    expect(isAvatarUrl("http://example.com/avatar.png")).toBe(true);
  });

  it("accepts data URIs", () => {
    expect(isAvatarUrl("data:image/png;base64,abc123")).toBe(true);
  });

  it("accepts relative avatar endpoint URLs", () => {
    expect(isAvatarUrl("/avatar/main")).toBe(true);
    expect(isAvatarUrl("/avatar/my-agent")).toBe(true);
  });

  it("rejects plain filenames", () => {
    expect(isAvatarUrl("avatar.png")).toBe(false);
  });

  it("rejects relative paths without /avatar/ prefix", () => {
    expect(isAvatarUrl("./images/avatar.png")).toBe(false);
    expect(isAvatarUrl("images/avatar.png")).toBe(false);
  });
});
