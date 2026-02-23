package ai.openclaw.android.gateway

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class GatewaySessionProtocolValidationTest {
  @Test
  fun protocol3Passes() {
    val payload =
      buildJsonObject {
        put("type", JsonPrimitive("hello-ok"))
        put("protocol", JsonPrimitive(3))
      }

    validateConnectHelloProtocol(payload)
  }

  @Test
  fun protocol2Fails() {
    val payload =
      buildJsonObject {
        put("protocol", JsonPrimitive(2))
      }

    val err =
      assertThrows(IllegalStateException::class.java) {
        validateConnectHelloProtocol(payload)
      }

    assertEquals("connect failed: hello-ok protocol mismatch (expected=3 actual=2)", err.message)
  }

  @Test
  fun missingProtocolFails() {
    val payload =
      buildJsonObject {
        put("type", JsonPrimitive("hello-ok"))
      }

    val err =
      assertThrows(IllegalStateException::class.java) {
        validateConnectHelloProtocol(payload)
      }

    assertEquals("connect failed: hello-ok missing protocol", err.message)
  }

  @Test
  fun nonNumericProtocolFails() {
    val payload =
      buildJsonObject {
        put("protocol", JsonPrimitive("3"))
      }

    val err =
      assertThrows(IllegalStateException::class.java) {
        validateConnectHelloProtocol(payload)
      }

    assertEquals("connect failed: hello-ok protocol is not numeric", err.message)
  }
}
