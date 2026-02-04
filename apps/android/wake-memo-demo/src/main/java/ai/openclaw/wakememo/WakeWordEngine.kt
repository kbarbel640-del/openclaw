package ai.openclaw.wakememo

interface WakeWordEngine {
  val sampleRate: Int
  val frameLength: Int

  fun start()
  fun stop()
  fun setKeywords(wake: String, stop: String)
  fun addListener(listener: WakeWordListener)
  fun removeListener(listener: WakeWordListener)
  fun processFrame(frame: ShortArray)
}
