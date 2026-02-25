import { describe, expect, it, vi } from "vitest";
import { requestOwnMatrixDeviceVerification } from "./verification.js";

describe("requestOwnMatrixDeviceVerification", () => {
  it("skips cleanly when crypto backend does not support self-verification requests", async () => {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
    };

    await expect(
      requestOwnMatrixDeviceVerification({
        crypto: {},
        logger,
      }),
    ).resolves.toBeUndefined();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("does not support self-verification requests"),
    );
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it("logs a verification request when the API is available", async () => {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
    };
    const requestOwnUserVerification = vi.fn().mockResolvedValue({ id: "req" });

    await requestOwnMatrixDeviceVerification({
      crypto: { requestOwnUserVerification },
      logger,
    });

    expect(requestOwnUserVerification).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      "matrix: device verification requested - please verify in another client",
    );
  });

  it("swallows verification request errors and logs debug info", async () => {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
    };
    const requestOwnUserVerification = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      requestOwnMatrixDeviceVerification({
        crypto: { requestOwnUserVerification },
        logger,
      }),
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith(
      "Device verification request failed (may already be verified)",
      expect.objectContaining({ error: expect.stringContaining("boom") }),
    );
  });
});
