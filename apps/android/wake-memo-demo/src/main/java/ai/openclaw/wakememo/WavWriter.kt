package ai.openclaw.wakememo

import java.io.File
import java.io.RandomAccessFile

class WavWriter(
  private val file: File,
  private val sampleRate: Int,
  private val channels: Int = 1,
  private val bitsPerSample: Int = 16,
) {
  private var raf: RandomAccessFile? = null
  private var dataBytesWritten: Long = 0
  private var byteBuf: ByteArray = ByteArray(0)

  @Synchronized
  fun start() {
    raf = RandomAccessFile(file, "rw").apply {
      setLength(0)
      write(ByteArray(44))
    }
    dataBytesWritten = 0
  }

  @Synchronized
  fun writePcm(frame: ShortArray) {
    val out = raf ?: return
    val needed = frame.size * 2
    if (byteBuf.size != needed) byteBuf = ByteArray(needed)

    var bi = 0
    for (s in frame) {
      val v = s.toInt()
      byteBuf[bi] = (v and 0xFF).toByte()
      byteBuf[bi + 1] = ((v shr 8) and 0xFF).toByte()
      bi += 2
    }

    out.write(byteBuf)
    dataBytesWritten += needed.toLong()
  }

  @Synchronized
  fun stopAndFinalize() {
    val out = raf ?: return
    out.seek(0)
    writeWavHeader(out, dataBytesWritten)
    out.close()
    raf = null
  }

  private fun writeWavHeader(out: RandomAccessFile, dataSize: Long) {
    val byteRate = sampleRate * channels * bitsPerSample / 8
    val blockAlign = (channels * bitsPerSample / 8).toShort()
    val chunkSize = 36L + dataSize

    out.writeBytes("RIFF")
    out.writeIntLE(chunkSize.toInt())
    out.writeBytes("WAVE")

    out.writeBytes("fmt ")
    out.writeIntLE(16)
    out.writeShortLE(1.toShort())
    out.writeShortLE(channels.toShort())
    out.writeIntLE(sampleRate)
    out.writeIntLE(byteRate)
    out.writeShortLE(blockAlign)
    out.writeShortLE(bitsPerSample.toShort())

    out.writeBytes("data")
    out.writeIntLE(dataSize.toInt())
  }
}

private fun RandomAccessFile.writeIntLE(value: Int) {
  write(
    byteArrayOf(
      (value and 0xFF).toByte(),
      ((value shr 8) and 0xFF).toByte(),
      ((value shr 16) and 0xFF).toByte(),
      ((value shr 24) and 0xFF).toByte(),
    ),
  )
}

private fun RandomAccessFile.writeShortLE(value: Short) {
  val v = value.toInt()
  write(
    byteArrayOf(
      (v and 0xFF).toByte(),
      ((v shr 8) and 0xFF).toByte(),
    ),
  )
}
