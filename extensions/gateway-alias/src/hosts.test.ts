import * as fs from "node:fs";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { syncHostsFile, removeHostsBlock, hostsFileIsUpToDate } from "./hosts.js";

vi.mock("node:fs");

const MARKER_START = "# >>> openclaw-gateway-alias";
const MARKER_END = "# <<< openclaw-gateway-alias";

const baseHosts = `##
# Host Database
##
127.0.0.1\tlocalhost
255.255.255.255\tbroadcasthost
::1\tlocalhost
`;

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
};

describe("syncHostsFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true for empty hostnames", () => {
    expect(syncHostsFile([], mockLog)).toBe(true);
  });

  it("appends block when not present", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(baseHosts);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    const result = syncHostsFile(["hal", "sam"], mockLog);

    expect(result).toBe(true);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain(MARKER_START);
    expect(written).toContain("127.0.0.1\thal");
    expect(written).toContain("127.0.0.1\tsam");
    expect(written).toContain(MARKER_END);
    // Original content preserved.
    expect(written).toContain("127.0.0.1\tlocalhost");
  });

  it("replaces existing block", () => {
    const existing = baseHosts + `${MARKER_START}\n127.0.0.1\told\n${MARKER_END}\n`;
    vi.mocked(fs.readFileSync).mockReturnValue(existing);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    const result = syncHostsFile(["hal"], mockLog);

    expect(result).toBe(true);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain("127.0.0.1\thal");
    expect(written).not.toContain("127.0.0.1\told");
  });

  it("skips write when block is already up to date", () => {
    const block = `${MARKER_START}\n127.0.0.1\thal\n${MARKER_END}`;
    vi.mocked(fs.readFileSync).mockReturnValue(baseHosts + block + "\n");

    const result = syncHostsFile(["hal"], mockLog);

    expect(result).toBe(true);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("already contains"));
  });

  it("returns false on EACCES", () => {
    const err = new Error("EACCES: permission denied");
    vi.mocked(fs.readFileSync).mockReturnValue(baseHosts);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw err;
    });

    const result = syncHostsFile(["hal"], mockLog);
    expect(result).toBe(false);
    expect(mockLog.warn).toHaveBeenCalled();
  });
});

describe("removeHostsBlock", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("removes existing block", () => {
    const withBlock = baseHosts + `${MARKER_START}\n127.0.0.1\thal\n${MARKER_END}\n`;
    vi.mocked(fs.readFileSync).mockReturnValue(withBlock);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    const result = removeHostsBlock(mockLog);

    expect(result).toBe(true);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).not.toContain(MARKER_START);
    expect(written).toContain("127.0.0.1\tlocalhost");
  });

  it("returns true when no block exists", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(baseHosts);

    const result = removeHostsBlock(mockLog);
    expect(result).toBe(true);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

describe("hostsFileIsUpToDate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true for empty hostnames", () => {
    expect(hostsFileIsUpToDate([])).toBe(true);
  });

  it("returns true when block matches", () => {
    const block = `${MARKER_START}\n127.0.0.1\thal\n127.0.0.1\tsam\n${MARKER_END}`;
    vi.mocked(fs.readFileSync).mockReturnValue(baseHosts + block);

    expect(hostsFileIsUpToDate(["hal", "sam"])).toBe(true);
  });

  it("returns false when block differs", () => {
    const block = `${MARKER_START}\n127.0.0.1\told\n${MARKER_END}`;
    vi.mocked(fs.readFileSync).mockReturnValue(baseHosts + block);

    expect(hostsFileIsUpToDate(["hal"])).toBe(false);
  });

  it("returns false when file cannot be read", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(hostsFileIsUpToDate(["hal"])).toBe(false);
  });
});
