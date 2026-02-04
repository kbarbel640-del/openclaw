package ai.openclaw.wakememo

import android.content.Context
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

object TfliteUtils {
  fun loadModelFile(context: Context, assetPath: String): ByteBuffer {
    return try {
      context.assets.openFd(assetPath).use { afd ->
        FileInputStream(afd.fileDescriptor).channel.use { channel ->
          channel.map(FileChannel.MapMode.READ_ONLY, afd.startOffset, afd.declaredLength)
        }
      }
    } catch (_: Exception) {
      val bytes = context.assets.open(assetPath).use { it.readBytes() }
      ByteBuffer.allocateDirect(bytes.size).apply {
        order(ByteOrder.nativeOrder())
        put(bytes)
        rewind()
      }
    }
  }

  fun shapeSize(shape: IntArray): Int {
    var size = 1
    for (dim in shape) size *= dim
    return size
  }

  fun createFloatBuffer(floatCount: Int): ByteBuffer {
    return ByteBuffer.allocateDirect(floatCount * 4).order(ByteOrder.nativeOrder())
  }

  fun readFloatArray(buffer: ByteBuffer, floatCount: Int): FloatArray {
    val out = FloatArray(floatCount)
    buffer.rewind()
    buffer.asFloatBuffer().get(out)
    return out
  }
}
