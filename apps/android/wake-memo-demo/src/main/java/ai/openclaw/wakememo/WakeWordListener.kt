package ai.openclaw.wakememo

interface WakeWordListener {
  fun onWakeWordDetected()
  fun onStopWordDetected()
}
