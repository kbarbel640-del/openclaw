package ai.openclaw.android.gateway

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayTrustTest {
  @Test
  fun isTrustedForAutoConnect_allowsManualEndpointsWithoutPin() {
    val endpoint = GatewayEndpoint.manual(host = "gateway.local", port = 18789)

    assertTrue(isTrustedForAutoConnect(endpoint, pinnedFingerprintSha256 = null))
  }

  @Test
  fun isTrustedForAutoConnect_rejectsDiscoveredEndpointsWithoutPin() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_openclaw-gw._tcp.|local.|demo",
        name = "Demo Gateway",
        host = "192.168.1.25",
        port = 18789,
      )

    assertFalse(isTrustedForAutoConnect(endpoint, pinnedFingerprintSha256 = null))
  }

  @Test
  fun isTrustedForAutoConnect_allowsDiscoveredEndpointsWithPin() {
    val endpoint =
      GatewayEndpoint(
        stableId = "_openclaw-gw._tcp.|local.|demo",
        name = "Demo Gateway",
        host = "192.168.1.25",
        port = 18789,
      )

    assertTrue(isTrustedForAutoConnect(endpoint, pinnedFingerprintSha256 = "abc123"))
  }
}
