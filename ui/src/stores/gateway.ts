import { atom } from "nanostores";
import type { GatewayHelloOk } from "../ui/gateway.ts";

// Gateway connection state
export const $hello = atom<GatewayHelloOk | null>(null);
export const $gatewayUrl = atom("");
export const $pendingGatewayUrl = atom<string | null>(null);
