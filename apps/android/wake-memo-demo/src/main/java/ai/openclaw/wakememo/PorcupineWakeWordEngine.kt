package ai.openclaw.wakememo

import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineException
import android.content.Context
import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

class PorcupineWakeWordEngine(
  private val context: Context,
  private val accessKey: String,
) : WakeWordEngine {

  companion object {
    private const val TAG = "PorcupineWakeWordEngine"
    private const val DEFAULT_SENSITIVITY = 0.6f
  }

  private val listeners = CopyOnWriteArrayList<WakeWordListener>()
  private var porcupine: Porcupine? = null
  private var wakeKeyword = Porcupine.BuiltInKeyword.PORCUPINE
  private var stopKeyword = Porcupine.BuiltInKeyword.BUMBLEBEE

  private var currentSampleRate = 16000
  private var currentFrameLength = 512

  override val sampleRate: Int
    get() = currentSampleRate

  override val frameLength: Int
    get() = currentFrameLength

  override fun setKeywords(wake: String, stop: String) {
    val wakeMapped = mapKeyword(wake)
    val stopMapped = mapKeyword(stop)

    if (wakeMapped == null || stopMapped == null) {
      Log.w(TAG, "Unsupported keywords. Using defaults: porcupine/bumblebee")
      wakeKeyword = Porcupine.BuiltInKeyword.PORCUPINE
      stopKeyword = Porcupine.BuiltInKeyword.BUMBLEBEE
      return
    }

    wakeKeyword = wakeMapped
    stopKeyword = stopMapped
  }

  override fun addListener(listener: WakeWordListener) {
    listeners.add(listener)
  }

  override fun removeListener(listener: WakeWordListener) {
    listeners.remove(listener)
  }

  override fun start() {
    if (porcupine != null) return
    if (accessKey.isBlank()) {
      throw IllegalStateException("Picovoice access key is missing")
    }

    try {
      porcupine = Porcupine.Builder()
        .setAccessKey(accessKey)
        .setKeywords(arrayOf(wakeKeyword, stopKeyword))
        .setSensitivities(floatArrayOf(DEFAULT_SENSITIVITY, DEFAULT_SENSITIVITY))
        .build(context)

      val engine = porcupine ?: return
      currentSampleRate = engine.sampleRate
      currentFrameLength = engine.frameLength
    } catch (e: Exception) {
      Log.e(TAG, "Failed to start Porcupine", e)
      stop()
      throw e
    }
  }

  override fun stop() {
    try {
      porcupine?.delete()
    } catch (e: Exception) {
      Log.w(TAG, "Error deleting Porcupine", e)
    }
    porcupine = null
  }

  override fun processFrame(frame: ShortArray) {
    val engine = porcupine ?: return
    val keywordIndex = try {
      engine.process(frame)
    } catch (_: PorcupineException) {
      return
    }

    if (keywordIndex < 0) return

    when (keywordIndex) {
      0 -> listeners.forEach { it.onWakeWordDetected() }
      1 -> listeners.forEach { it.onStopWordDetected() }
      else -> Log.w(TAG, "Unknown keyword index: $keywordIndex")
    }
  }

  private fun mapKeyword(word: String): Porcupine.BuiltInKeyword? {
    return when (word.trim().lowercase()) {
      "porcupine" -> Porcupine.BuiltInKeyword.PORCUPINE
      "bumblebee" -> Porcupine.BuiltInKeyword.BUMBLEBEE
      else -> null
    }
  }
}
