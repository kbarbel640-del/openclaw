import type { BrowserActionOk, BrowserActionTargetOk } from "./client-actions-types.js";
import { buildProfileQuery, withBaseUrl } from "./client-actions-url.js";
import { fetchBrowserJson } from "./client-fetch.js";

export async function browserSetOffline(
  baseUrl: string | undefined,
  opts: { offline: boolean; targetId?: string; profile?: string },
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(withBaseUrl(baseUrl, `/set/offline${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId: opts.targetId, offline: opts.offline }),
    timeoutMs: 20000,
  });
}

export async function browserSetHeaders(
  baseUrl: string | undefined,
  opts: {
    headers: Record<string, string>;
    targetId?: string;
    profile?: string;
  },
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(withBaseUrl(baseUrl, `/set/headers${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId: opts.targetId, headers: opts.headers }),
    timeoutMs: 20000,
  });
}

export async function browserSetHttpCredentials(
  baseUrl: string | undefined,
  opts: {
    username?: string;
    password?: string;
    clear?: boolean;
    targetId?: string;
    profile?: string;
  } = {},
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(
    withBaseUrl(baseUrl, `/set/credentials${q}`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId: opts.targetId,
        username: opts.username,
        password: opts.password,
        clear: opts.clear,
      }),
      timeoutMs: 20000,
    },
  );
}

export async function browserSetGeolocation(
  baseUrl: string | undefined,
  opts: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    origin?: string;
    clear?: boolean;
    targetId?: string;
    profile?: string;
  } = {},
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(
    withBaseUrl(baseUrl, `/set/geolocation${q}`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId: opts.targetId,
        latitude: opts.latitude,
        longitude: opts.longitude,
        accuracy: opts.accuracy,
        origin: opts.origin,
        clear: opts.clear,
      }),
      timeoutMs: 20000,
    },
  );
}

export async function browserSetMedia(
  baseUrl: string | undefined,
  opts: {
    colorScheme: "dark" | "light" | "no-preference" | "none";
    targetId?: string;
    profile?: string;
  },
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(withBaseUrl(baseUrl, `/set/media${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetId: opts.targetId,
      colorScheme: opts.colorScheme,
    }),
    timeoutMs: 20000,
  });
}

export async function browserSetTimezone(
  baseUrl: string | undefined,
  opts: { timezoneId: string; targetId?: string; profile?: string },
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(withBaseUrl(baseUrl, `/set/timezone${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetId: opts.targetId,
      timezoneId: opts.timezoneId,
    }),
    timeoutMs: 20000,
  });
}

export async function browserSetLocale(
  baseUrl: string | undefined,
  opts: { locale: string; targetId?: string; profile?: string },
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(withBaseUrl(baseUrl, `/set/locale${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId: opts.targetId, locale: opts.locale }),
    timeoutMs: 20000,
  });
}

export async function browserSetDevice(
  baseUrl: string | undefined,
  opts: { name: string; targetId?: string; profile?: string },
): Promise<BrowserActionTargetOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionTargetOk>(withBaseUrl(baseUrl, `/set/device${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId: opts.targetId, name: opts.name }),
    timeoutMs: 20000,
  });
}

export async function browserClearPermissions(
  baseUrl: string | undefined,
  opts: { targetId?: string; profile?: string } = {},
): Promise<BrowserActionOk> {
  const q = buildProfileQuery(opts.profile);
  return await fetchBrowserJson<BrowserActionOk>(withBaseUrl(baseUrl, `/set/geolocation${q}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId: opts.targetId, clear: true }),
    timeoutMs: 20000,
  });
}
