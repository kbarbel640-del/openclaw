import { vi } from "vitest";
import * as ssrf from "../infra/net/ssrf.js";

export function mockPinnedHostnameResolution(addresses: string[] = ["93.184.216.34"]) {
  const buildPinned = (hostname: string, policy?: ssrf.SsrFPolicy) => {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
    if (ssrf.isBlockedHostnameOrIp(normalized, policy)) {
      throw new ssrf.SsrFBlockedError(
        "Blocked hostname or private/internal/special-use IP address",
      );
    }
    const pinnedAddresses = [...addresses];
    return {
      hostname: normalized,
      addresses: pinnedAddresses,
      lookup: ssrf.createPinnedLookup({ hostname: normalized, addresses: pinnedAddresses }),
    };
  };
  vi.spyOn(ssrf, "resolvePinnedHostname").mockImplementation(async (hostname) =>
    buildPinned(hostname),
  );
  return vi
    .spyOn(ssrf, "resolvePinnedHostnameWithPolicy")
    .mockImplementation(async (hostname, params) => buildPinned(hostname, params?.policy));
}
