package ai.openclaw.android.gateway

internal fun isTrustedForAutoConnect(
  endpoint: GatewayEndpoint,
  pinnedFingerprintSha256: String?,
): Boolean {
  if (endpoint.stableId.startsWith("manual|")) return true
  return !pinnedFingerprintSha256.isNullOrBlank()
}
