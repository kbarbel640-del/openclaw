package ai.openclaw.wakememo

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.Closeable
import java.nio.FloatBuffer
import java.util.ArrayDeque
import kotlin.math.min

class OpenWakeWordAudioFeatures(
  context: Context,
  melspecAssetPath: String,
  embeddingAssetPath: String,
  private val sampleRate: Int = 16000,
) : Closeable {

  companion object {
    private const val TAG = "OWW:AudioFeatures"
    private const val FRAME_SAMPLES = 1280
    private const val MEL_BINS = 32
    private const val MEL_WINDOW = 76
    private const val MEL_BUFFER_MAX_LEN = 970
    private const val FEATURE_BUFFER_MAX_LEN = 120
    private const val MEL_CONTEXT_SAMPLES = 160 * 3
  }

  private val ortEnv = OrtEnvironment.getEnvironment()
  private val melspecSession: OrtSession
  private val embeddingSession: OrtSession

  private var embeddingDim: Int = 96

  private val rawBuffer = ShortRingBuffer(sampleRate * 10)
  private val melBuffer = ArrayDeque<FloatArray>(MEL_WINDOW)
  private val featureBuffer = ArrayDeque<FloatArray>(FEATURE_BUFFER_MAX_LEN)
  private var accumulatedSamples = 0
  private var rawRemainder = ShortArray(0)

  init {
    DebugLog.d(TAG, "Loading ONNX models...")
    
    val melBytes = context.assets.open(melspecAssetPath).use { it.readBytes() }
    melspecSession = ortEnv.createSession(melBytes)
    DebugLog.d(TAG, "Melspec model loaded")

    val embBytes = context.assets.open(embeddingAssetPath).use { it.readBytes() }
    embeddingSession = ortEnv.createSession(embBytes)
    DebugLog.d(TAG, "Embedding model loaded")

    // Get embedding output dimension from output info
    try {
      val outputMeta = embeddingSession.outputInfo.values.firstOrNull()
      if (outputMeta != null) {
        val tensorInfo = outputMeta.info as? ai.onnxruntime.TensorInfo
        val shape = tensorInfo?.shape
        if (shape != null && shape.isNotEmpty()) {
          embeddingDim = shape.last().toInt()
        }
      }
    } catch (e: Exception) {
      DebugLog.w(TAG, "Could not get embedding dim: ${e.message}")
    }
    DebugLog.d(TAG, "Embedding dim: $embeddingDim")
  }

  @Synchronized
  fun process(frame: ShortArray): Int {
    var processedSamples = 0
    var samples = frame

    if (rawRemainder.isNotEmpty()) {
      val combined = ShortArray(rawRemainder.size + samples.size)
      System.arraycopy(rawRemainder, 0, combined, 0, rawRemainder.size)
      System.arraycopy(samples, 0, combined, rawRemainder.size, samples.size)
      samples = combined
      rawRemainder = ShortArray(0)
    }

    if (accumulatedSamples + samples.size >= FRAME_SAMPLES) {
      val remainder = (accumulatedSamples + samples.size) % FRAME_SAMPLES
      if (remainder != 0) {
        val evenLen = samples.size - remainder
        if (evenLen > 0) {
          rawBuffer.append(samples, evenLen)
          accumulatedSamples += evenLen
        }
        rawRemainder = samples.copyOfRange(evenLen, samples.size)
      } else {
        rawBuffer.append(samples)
        accumulatedSamples += samples.size
        rawRemainder = ShortArray(0)
      }
    } else {
      rawBuffer.append(samples)
      accumulatedSamples += samples.size
      rawRemainder = ShortArray(0)
    }

    if (accumulatedSamples >= FRAME_SAMPLES && accumulatedSamples % FRAME_SAMPLES == 0) {
      streamingMelspectrogram(accumulatedSamples)

      val steps = accumulatedSamples / FRAME_SAMPLES
      val melList = melBuffer.toList()
      
      // Reduced logging - only log once when ready
      if (melList.size == MEL_WINDOW) {
        DebugLog.d(TAG, "Mel buffer ready")
      }
      for (i in steps - 1 downTo 0) {
        val ndx = -8 * i
        val endIndex = if (ndx == 0) melList.size else melList.size + ndx
        val startIndex = endIndex - MEL_WINDOW
        if (startIndex >= 0 && endIndex <= melList.size) {
          val window = melList.subList(startIndex, endIndex)
          val embedding = computeEmbedding(window)
          if (embedding != null) {
            featureBuffer.addLast(embedding)
            trimFeatureBuffer()
          }
        }
      }

      processedSamples = accumulatedSamples
      accumulatedSamples = 0
    }

    trimFeatureBuffer()
    return if (processedSamples != 0) processedSamples else accumulatedSamples
  }

  fun getFeatures(nFeatureFrames: Int, startIndex: Int = -1): Array<FloatArray>? {
    val list = featureBuffer.toList()
    if (list.size < nFeatureFrames) return null

    val size = list.size
    val start = if (startIndex != -1) {
      if (startIndex < 0) size + startIndex else startIndex
    } else {
      size - nFeatureFrames
    }

    val end = if (startIndex != -1) {
      val rawEnd = startIndex + nFeatureFrames
      when {
        rawEnd == 0 -> size
        rawEnd < 0 -> size + rawEnd
        else -> rawEnd
      }
    } else {
      size
    }

    if (start < 0 || end > size || end - start < nFeatureFrames) return null
    return list.subList(start, end).toTypedArray()
  }

  override fun close() {
    melspecSession.close()
    embeddingSession.close()
  }

  private fun streamingMelspectrogram(nSamples: Int) {
    if (rawBuffer.size < 400) return

    val tail = rawBuffer.tail(nSamples + MEL_CONTEXT_SAMPLES)
    val melFrames = computeMelspec(tail)
    for (frame in melFrames) {
      melBuffer.addLast(frame)
      if (melBuffer.size > MEL_BUFFER_MAX_LEN) {
        melBuffer.removeFirst()
      }
    }
  }

  private var melDebugCount = 0

  private fun computeMelspec(samples: ShortArray): List<FloatArray> {
    val inputSize = samples.size
    if (inputSize <= 0) return emptyList()

    try {
      // Create input tensor [1, inputSize]
      val floatData = FloatArray(inputSize) { samples[it].toFloat() }
      val inputTensor = OnnxTensor.createTensor(ortEnv, arrayOf(floatData))

      val outputs = melspecSession.run(mapOf("input" to inputTensor))
      inputTensor.close()

      val result = outputs[0]
      val onnxTensor = result as? OnnxTensor
      
      melDebugCount++
      
      if (onnxTensor == null) {
        outputs.close()
        return emptyList()
      }

      // Get tensor info and extract as flat float array
      val info = onnxTensor.info
      val shape = info.shape

      // Get the raw float buffer
      val floatBuffer = onnxTensor.floatBuffer
      val totalSize = shape.fold(1L) { acc, d -> acc * d }.toInt()
      val rawData = FloatArray(totalSize)
      floatBuffer.get(rawData)

      // Parse shape: [1, 1, frames, 32] or [1, frames, 32] or [frames, 32]
      val frames: Int
      val bins: Int
      when (shape.size) {
        4 -> {
          // Shape: [batch, 1, frames, mel_bins]
          frames = shape[2].toInt()
          bins = shape[3].toInt()
        }
        3 -> {
          frames = shape[1].toInt()
          bins = shape[2].toInt()
        }
        2 -> {
          frames = shape[0].toInt()
          bins = shape[1].toInt()
        }
        else -> {
          outputs.close()
          return emptyList()
        }
      }

      // Convert to list of frames with normalization
      val output = ArrayList<FloatArray>(frames)
      for (f in 0 until frames) {
        val frame = FloatArray(bins)
        for (b in 0 until bins) {
          val idx = if (shape.size == 3) b + f * bins else b + f * bins
          frame[b] = (rawData[idx] / 10.0f) + 2.0f
        }
        output.add(frame)
      }

      outputs.close()
      return output
    } catch (e: Exception) {
      DebugLog.e(TAG, "Melspec error: ${e.message}")
      return emptyList()
    }
  }

  private fun computeEmbedding(window: List<FloatArray>): FloatArray? {
    if (window.size < MEL_WINDOW) return null

    try {
      // Create input tensor [1, MEL_WINDOW, MEL_BINS, 1] - shape expected by embedding model
      val inputData = Array(1) { Array(MEL_WINDOW) { i ->
        val frame = window[i]
        Array(MEL_BINS) { j -> 
          floatArrayOf(if (j < frame.size) frame[j] else 0f)
        }
      }}
      val inputTensor = OnnxTensor.createTensor(ortEnv, inputData)

      val outputs = embeddingSession.run(mapOf("input_1" to inputTensor))
      inputTensor.close()

      val onnxResult = outputs[0] as? OnnxTensor
      if (onnxResult == null) {
        outputs.close()
        return null
      }

      val shape = onnxResult.info.shape
      val floatBuffer = onnxResult.floatBuffer
      val totalSize = shape.fold(1L) { acc, d -> acc * d }.toInt()
      val rawData = FloatArray(totalSize)
      floatBuffer.get(rawData)

      outputs.close()
      
      // Return last embeddingDim values
      val start = maxOf(0, rawData.size - embeddingDim)
      return rawData.copyOfRange(start, start + embeddingDim)
    } catch (e: Exception) {
      DebugLog.e(TAG, "Embedding error: ${e.message}")
      return null
    }
  }

  private fun trimFeatureBuffer() {
    while (featureBuffer.size > FEATURE_BUFFER_MAX_LEN) {
      featureBuffer.removeFirst()
    }
  }
}

private class ShortRingBuffer(private val capacity: Int) {
  private val buffer = ShortArray(capacity)
  private var start = 0
  var size: Int = 0
    private set

  fun append(samples: ShortArray, length: Int = samples.size) {
    val count = min(length, samples.size)
    for (i in 0 until count) {
      buffer[(start + size) % capacity] = samples[i]
      if (size < capacity) {
        size += 1
      } else {
        start = (start + 1) % capacity
      }
    }
  }

  fun tail(count: Int): ShortArray {
    val actual = min(count, size)
    val out = ShortArray(actual)
    val offset = size - actual
    for (i in 0 until actual) {
      out[i] = buffer[(start + offset + i) % capacity]
    }
    return out
  }
}
