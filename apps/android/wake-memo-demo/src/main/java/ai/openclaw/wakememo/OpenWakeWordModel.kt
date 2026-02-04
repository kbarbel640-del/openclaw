package ai.openclaw.wakememo

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.Closeable
import kotlin.math.min

class OpenWakeWordModel(
  context: Context,
  assetPath: String,
  private val ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment(),
) : Closeable {

  companion object {
    private const val TAG = "OWW:Model"
  }

  private val session: OrtSession

  val inputFrames: Int
  val embeddingDim: Int
  private var predictCount = 0

  init {
    DebugLog.d(TAG, "Loading model: $assetPath")
    val bytes = context.assets.open(assetPath).use { it.readBytes() }
    session = ortEnv.createSession(bytes)

    // Parse input shape - typically [1, frames, embedding_dim]
    var shape = longArrayOf(1, 16, 96) // defaults
    try {
      val inputMeta = session.inputInfo.values.firstOrNull()
      val tensorInfo = inputMeta?.info as? ai.onnxruntime.TensorInfo
      shape = tensorInfo?.shape ?: shape
    } catch (e: Exception) {
      DebugLog.w(TAG, "Could not get input shape: ${e.message}")
    }
    
    inputFrames = if (shape.size >= 2) shape[1].toInt() else 16
    embeddingDim = if (shape.size >= 3) shape[2].toInt() else 96
    
    DebugLog.d(TAG, "Model loaded: inputFrames=$inputFrames, embeddingDim=$embeddingDim")
  }

  fun predict(features: Array<FloatArray>): Float {
    if (features.isEmpty()) return 0f
    val frames = min(features.size, inputFrames)
    if (frames < inputFrames) return 0f

    try {
      // Create input tensor [1, inputFrames, embeddingDim]
      val startIndex = features.size - inputFrames
      val inputData = Array(1) { Array(inputFrames) { i ->
        val frame = features[startIndex + i]
        FloatArray(embeddingDim) { j -> if (j < frame.size) frame[j] else 0f }
      }}

      val inputTensor = OnnxTensor.createTensor(ortEnv, inputData)
      
      // Get input name from session
      val inputName = session.inputNames.firstOrNull() ?: "input"
      val outputs = session.run(mapOf(inputName to inputTensor))
      inputTensor.close()

      val onnxResult = outputs[0] as? OnnxTensor
      if (onnxResult == null) {
        outputs.close()
        return 0f
      }
      
      val shape = onnxResult.info.shape
      val floatBuffer = onnxResult.floatBuffer
      val size = shape.fold(1L) { acc, d -> acc * d }.toInt()
      val rawData = FloatArray(size)
      floatBuffer.get(rawData)
      
      predictCount++

      outputs.close()
      return rawData.firstOrNull() ?: 0f
    } catch (e: Exception) {
      DebugLog.e(TAG, "Predict error: ${e.message}")
      return 0f
    }
  }

  override fun close() {
    session.close()
  }
}
