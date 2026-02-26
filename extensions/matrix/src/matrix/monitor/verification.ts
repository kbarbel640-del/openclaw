type MatrixCryptoWithVerification = {
  requestOwnUserVerification?: unknown;
};

type MatrixVerificationLogger = {
  info: (message: string) => void;
  debug?: (message: string, meta?: Record<string, unknown>) => void;
};

export async function requestOwnMatrixDeviceVerification(opts: {
  crypto: MatrixCryptoWithVerification;
  logger: MatrixVerificationLogger;
}): Promise<void> {
  const requestOwnUserVerification = opts.crypto.requestOwnUserVerification;
  if (typeof requestOwnUserVerification !== "function") {
    opts.logger.info(
      "matrix: current Matrix SDK/crypto backend does not support self-verification requests; skipping automatic device verification",
    );
    return;
  }

  try {
    const verificationRequest = await requestOwnUserVerification.call(opts.crypto);
    if (verificationRequest) {
      opts.logger.info("matrix: device verification requested - please verify in another client");
    }
  } catch (err) {
    opts.logger.debug?.("Device verification request failed (may already be verified)", {
      error: String(err),
    });
  }
}
