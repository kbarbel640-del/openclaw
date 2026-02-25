import { describe, expect, it } from "vitest";
import { buildLaunchAgentPlist } from "./launchd-plist.js";

describe("buildLaunchAgentPlist", () => {
  const defaults = {
    label: "ai.openclaw.gateway",
    programArguments: ["/usr/local/bin/node", "gateway", "run"],
    stdoutPath: "/tmp/gateway.log",
    stderrPath: "/tmp/gateway.err.log",
  };

  it("uses KeepAlive dict with SuccessfulExit=false instead of unconditional true", () => {
    const plist = buildLaunchAgentPlist(defaults);
    // Must NOT contain unconditional KeepAlive=true (causes restart loops on crash)
    expect(plist).not.toMatch(/<key>KeepAlive<\/key>\s*<true\s*\/>/);
    // Must contain KeepAlive dict with SuccessfulExit=false
    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("<key>SuccessfulExit</key>");
    expect(plist).toMatch(/<key>SuccessfulExit<\/key>\s*<false\s*\/>/);
  });

  it("includes ThrottleInterval to prevent tight restart loops", () => {
    const plist = buildLaunchAgentPlist(defaults);
    expect(plist).toContain("<key>ThrottleInterval</key>");
    expect(plist).toMatch(/<key>ThrottleInterval<\/key>\s*<integer>30<\/integer>/);
  });

  it("includes RunAtLoad", () => {
    const plist = buildLaunchAgentPlist(defaults);
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\s*\/>/);
  });

  it("renders ProgramArguments", () => {
    const plist = buildLaunchAgentPlist(defaults);
    expect(plist).toContain("<key>ProgramArguments</key>");
    expect(plist).toContain("/usr/local/bin/node");
    expect(plist).toContain("gateway");
  });

  it("escapes XML entities in arguments", () => {
    const plist = buildLaunchAgentPlist({
      ...defaults,
      programArguments: ["/usr/bin/node", "--flag=a&b<c>d"],
    });
    expect(plist).toContain("a&amp;b&lt;c&gt;d");
  });
});
