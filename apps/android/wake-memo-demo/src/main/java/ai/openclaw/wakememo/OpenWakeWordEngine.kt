package ai.openclaw.wakememo

import android.content.Context
import android.os.SystemClock
import android.util.Log
import java.io.Closeable
import java.util.concurrent.CopyOnWriteArrayList

class OpenWakeWordEngine(
  private val context: Context,
  private val modelDir: String = "oww",
  private val threshold: Float = 0.3f,  // Lowered from 0.5 for testing
  private val cooldownMs: Long = 1200,
) : WakeWordEngine, Closeable {

  companion object {
    private const val TAG = "OpenWakeWordEngine"
    private const val DEFAULT_WAKE = "hey jarvis"
    private const val DEFAULT_STOP = "alexa"
  }

  private val listeners = CopyOnWriteArrayList<WakeWordListener>()
  private val predictionHistory = mutableMapOf<String, ArrayDeque<Float>>()

  private var wakeKeyword = DEFAULT_WAKE
  private var stopKeyword = DEFAULT_STOP

  private var audioFeatures: OpenWakeWordAudioFeatures? = null
  private var wakeModel: OpenWakeWordModel? = null
  private var stopModel: OpenWakeWordModel? = null

  private var lastWakeMs = 0L
  private var lastStopMs = 0L
  private var started = false

  override val sampleRate: Int
    get() = 16000

  override val frameLength: Int
    get() = 1280

  override fun setKeywords(wake: String, stop: String) {
    wakeKeyword = wake
    stopKeyword = stop
  }

  override fun addListener(listener: WakeWordListener) {
    listeners.add(listener)
  }

  override fun removeListener(listener: WakeWordListener) {
    listeners.remove(listener)
  }

  override fun start() {
    DebugLog.d(TAG, "start: starting engine, started=$started")
    if (started) return

    val wakeModelPath = modelPathForKeyword(wakeKeyword)
    val stopModelPath = modelPathForKeyword(stopKeyword)
    DebugLog.d(TAG, "start: wakeModel=$wakeModelPath, stopModel=$stopModelPath")

    if (wakeModelPath == null || stopModelPath == null) {
      DebugLog.e(TAG, "start: unsupported keywords $wakeKeyword / $stopKeyword")
      throw IllegalStateException("Unsupported OpenWakeWord keywords: $wakeKeyword / $stopKeyword")
    }

    DebugLog.d(TAG, "start: loading audio features")
    audioFeatures = OpenWakeWordAudioFeatures(
      context = context,
      melspecAssetPath = "$modelDir/melspectrogram.onnx",
      embeddingAssetPath = "$modelDir/embedding_model.onnx",
    )
    DebugLog.d(TAG, "start: loading wake model")
    wakeModel = OpenWakeWordModel(context, "$modelDir/$wakeModelPath")
    DebugLog.d(TAG, "start: loading stop model")
    stopModel = OpenWakeWordModel(context, "$modelDir/$stopModelPath")

    predictionHistory.clear()
    started = true
    DebugLog.i(TAG, "start: engine started successfully")
  }

  override fun stop() {
    try {
      audioFeatures?.close()
    } catch (_: Exception) {
    }

    try {
      wakeModel?.close()
      stopModel?.close()
    } catch (_: Exception) {
    }

    audioFeatures = null
    wakeModel = null
    stopModel = null
    predictionHistory.clear()
    started = false
  }

  override fun processFrame(frame: ShortArray) {
    if (!started) return

    val features = audioFeatures ?: return
    val wake = wakeModel ?: return
    val stop = stopModel ?: return

    val prepared = features.process(frame)
    if (prepared < frameLength) return

    val wakeFeatures = features.getFeatures(wake.inputFrames)
    val stopFeatures = features.getFeatures(stop.inputFrames)

    frameCount++

    val wakeScore = if (wakeFeatures != null) {
      applyWarmup("wake", wake.predict(wakeFeatures))
    } else {
      0f
    }
    val stopScore = if (stopFeatures != null) {
      applyWarmup("stop", stop.predict(stopFeatures))
    } else {
      0f
    }

    // Only log significant scores (above 0.05)
    val now = SystemClock.elapsedRealtime()
    if ((wakeScore > 0.05f || stopScore > 0.05f) && now - lastLogMs >= 500) {
      DebugLog.d(TAG, "Score: wake=${"%.2f".format(wakeScore)}, stop=${"%.2f".format(stopScore)}")
      lastLogMs = now
    }

    if (wakeScore >= threshold && now - lastWakeMs >= cooldownMs) {
      DebugLog.i(TAG, ">>> WAKE DETECTED: score=$wakeScore, threshold=$threshold")
      lastWakeMs = now
      listeners.forEach { it.onWakeWordDetected() }
    }

    if (stopScore >= threshold && now - lastStopMs >= cooldownMs) {
      DebugLog.i(TAG, ">>> STOP DETECTED: score=$stopScore, threshold=$threshold")
      lastStopMs = now
      listeners.forEach { it.onStopWordDetected() }
    }
  }

  private var lastLogMs = 0L
  private var frameCount = 0L

  override fun close() {
    stop()
  }

  private fun applyWarmup(key: String, score: Float): Float {
    val buffer = predictionHistory.getOrPut(key) { ArrayDeque(30) }
    buffer.addLast(score)
    if (buffer.size > 30) buffer.removeFirst()
    return if (buffer.size < 5) 0f else score
  }

  private fun modelPathForKeyword(keyword: String): String? {
    return when (keyword.trim().lowercase()) {
      "hey jarvis", "hey_jarvis" -> "hey_jarvis_v0.1.onnx"
      "alexa" -> "alexa_v0.1.onnx"
      else -> {
        DebugLog.w(TAG, "Unknown keyword: $keyword")
        null
      }
    }
  }
}
