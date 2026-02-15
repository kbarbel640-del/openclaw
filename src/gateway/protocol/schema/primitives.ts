import { z } from "zod";
import { SESSION_LABEL_MAX_LENGTH } from "../../../sessions/session-label.js";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_MODES } from "../client-info.js";

export const NonEmptyString = z.string().min(1);
export const SessionLabelString = z.string().min(1).max(SESSION_LABEL_MAX_LENGTH);

const clientIdValues = Object.values(GATEWAY_CLIENT_IDS) as [string, ...string[]];
export const GatewayClientIdSchema = z.enum(clientIdValues);

const clientModeValues = Object.values(GATEWAY_CLIENT_MODES) as [string, ...string[]];
export const GatewayClientModeSchema = z.enum(clientModeValues);
