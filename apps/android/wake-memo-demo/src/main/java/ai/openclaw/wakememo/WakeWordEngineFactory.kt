package ai.openclaw.wakememo

import android.content.Context

object WakeWordEngineFactory {
  fun create(context: Context, type: WakeWordEngineType): WakeWordEngine {
    return when (type) {
      WakeWordEngineType.OPEN_WAKE_WORD -> OpenWakeWordEngine(context)
      WakeWordEngineType.PICOVOICE -> PorcupineWakeWordEngine(
        context = context,
        accessKey = BuildConfig.PICOVOICE_ACCESS_KEY,
      )
    }
  }
}
