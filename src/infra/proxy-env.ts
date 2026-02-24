import process from "node:process";
import type { Dispatcher } from "undici";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const PROXY_ENV_KEYS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] as const;

type ProxyAgentCtor = new (uri: string) => Dispatcher;
type SetGlobalDispatcherFn = (dispatcher: Dispatcher) => void;
export type ProxyDispatcherDeps = {
  ProxyAgent: ProxyAgentCtor;
  setGlobalDispatcher: SetGlobalDispatcherFn;
};

export function resolveProxyUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of PROXY_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

export function configureGlobalProxyDispatcher(
  env: NodeJS.ProcessEnv = process.env,
  deps: ProxyDispatcherDeps = { ProxyAgent: ProxyAgent as ProxyAgentCtor, setGlobalDispatcher },
): boolean {
  const proxyUrl = resolveProxyUrlFromEnv(env);
  if (!proxyUrl) {
    return false;
  }
  deps.setGlobalDispatcher(new deps.ProxyAgent(proxyUrl));
  return true;
}
