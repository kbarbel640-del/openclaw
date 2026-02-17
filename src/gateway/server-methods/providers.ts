/**
 * Gateway handlers for providers endpoints.
 */

import { detectProviders, getUsage, type UsagePeriod } from "../../commands/providers/index.js";
import {
  ErrorCodes,
  errorShape,
  validateProvidersListParams,
  validateProvidersUsageParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const providersHandlers: GatewayRequestHandlers = {
  /**
   * List known LLM providers and their detection status.
   */
  "providers.list": async ({ params, respond }) => {
    if (!validateProvidersListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid providers.list params"),
      );
      return;
    }

    try {
      const typedParams = params as { all?: boolean; providerId?: string };
      const providers = detectProviders({
        includeNotDetected: typedParams.all ?? false,
        providerIds: typedParams.providerId ? [typedParams.providerId] : undefined,
      });

      respond(true, { providers }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get LLM usage statistics by provider/model.
   */
  "providers.usage": async ({ params, respond }) => {
    if (!validateProvidersUsageParams(params)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid providers.usage params"),
      );
      return;
    }

    try {
      const typedParams = params as {
        period?: UsagePeriod;
        providerId?: string;
        modelId?: string;
      };

      const period = typedParams.period ?? "all";
      const { usage, totals } = await getUsage({
        period,
        providerId: typedParams.providerId,
        modelId: typedParams.modelId,
      });

      respond(true, { usage, totals, period }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
