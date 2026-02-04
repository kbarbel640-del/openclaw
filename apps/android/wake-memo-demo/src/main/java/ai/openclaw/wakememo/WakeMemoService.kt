package ai.openclaw.wakememo

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat

class WakeMemoService : Service() {

  companion object {
    const val ACTION_START = "ai.openclaw.wakememo.action.START"
    const val ACTION_STOP = "ai.openclaw.wakememo.action.STOP"

    const val ACTION_STATUS = "ai.openclaw.wakememo.action.STATUS"
    const val EXTRA_IS_LISTENING = "is_listening"
    const val EXTRA_IS_RECORDING = "is_recording"
    const val EXTRA_LAST_FILE = "last_file"

    private const val NOTIFICATION_ID = 1001
    private const val TAG = "WakeMemoService"
  }

  private val recordingLock = Any()

  private var engine: WakeWordEngine? = null
  private var audioThread: Thread? = null

  @Volatile private var isListening = false
  @Volatile private var isRecording = false

  private var wavWriter: WavWriter? = null
  private var lastFilePath: String? = null

  private val engineListener = object : WakeWordListener {
    override fun onWakeWordDetected() {
      DebugLog.i(TAG, ">>> WAKE WORD DETECTED! isRecording=$isRecording")
      if (!isRecording) startRecording()
    }

    override fun onStopWordDetected() {
      DebugLog.i(TAG, ">>> STOP WORD DETECTED! isRecording=$isRecording")
      if (isRecording) stopRecording()
    }
  }

  override fun onCreate() {
    super.onCreate()
    DebugLog.d(TAG, "onCreate: initializing service")
    NotificationUtils.ensureChannel(this)
    DebugLog.d(TAG, "onCreate: notification channel ensured")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    DebugLog.d(TAG, "onStartCommand: action=${intent?.action}, flags=$flags, startId=$startId")
    when (intent?.action) {
      ACTION_STOP -> {
        DebugLog.d(TAG, "onStartCommand: stopping service")
        stopListeningAndCleanup()
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_START, null -> {
        DebugLog.d(TAG, "onStartCommand: starting service")
        startForegroundWithNotification()
        startListeningIfNeeded()
        return START_STICKY
      }
      else -> {
        DebugLog.w(TAG, "onStartCommand: unknown action ${intent?.action}")
        return START_NOT_STICKY
      }
    }
  }

  private fun startForegroundWithNotification() {
    val notification = NotificationUtils.buildNotification(this, isRecording)
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
    )
  }

  private fun startListeningIfNeeded() {
    DebugLog.d(TAG, "startListeningIfNeeded: isListening=$isListening")
    if (isListening) {
      DebugLog.d(TAG, "startListeningIfNeeded: already listening, returning")
      return
    }

    // Using OpenWakeWord with ONNX Runtime (TFLite had compatibility issues)
    val engineType = WakeWordEngineType.OPEN_WAKE_WORD
    DebugLog.d(TAG, "startListeningIfNeeded: creating engine type=$engineType")
    val wakeEngine = WakeWordEngineFactory.create(this, engineType)
    DebugLog.d(TAG, "startListeningIfNeeded: engine created: ${wakeEngine.javaClass.simpleName}")

    DebugLog.d(TAG, "startListeningIfNeeded: setting keywords 'hey jarvis', 'alexa'")
    wakeEngine.setKeywords("hey jarvis", "alexa")
    wakeEngine.addListener(engineListener)

    try {
      DebugLog.d(TAG, "startListeningIfNeeded: starting engine")
      wakeEngine.start()
      DebugLog.d(TAG, "startListeningIfNeeded: engine started successfully")
    } catch (e: Exception) {
      DebugLog.e(TAG, "Failed to start wake word engine", e)
      stopSelf()
      return
    }

    engine = wakeEngine
    isListening = true
    DebugLog.d(TAG, "startListeningIfNeeded: isListening=true, broadcasting status")
    broadcastStatus()

    DebugLog.d(TAG, "startListeningIfNeeded: starting audio thread")
    audioThread = Thread { runAudioLoop() }.apply { start() }
    DebugLog.d(TAG, "startListeningIfNeeded: audio thread started")
  }

  private fun runAudioLoop() {
    DebugLog.d(TAG, "runAudioLoop: starting")
    val localEngine = engine ?: run {
      DebugLog.e(TAG, "runAudioLoop: engine is null, returning")
      return
    }
    val sampleRate = localEngine.sampleRate
    val frameSize = localEngine.frameLength
    DebugLog.d(TAG, "runAudioLoop: sampleRate=$sampleRate, frameSize=$frameSize")

    val minBuffer = AudioRecord.getMinBufferSize(
      sampleRate,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    DebugLog.d(TAG, "runAudioLoop: minBuffer=$minBuffer")

    val bufferSize = maxOf(minBuffer, frameSize * 2 * 4)
    DebugLog.d(TAG, "runAudioLoop: creating AudioRecord with bufferSize=$bufferSize")
    var record = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      sampleRate,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      bufferSize,
    )
    DebugLog.d(TAG, "runAudioLoop: AudioRecord state=${record.state} (expecting ${AudioRecord.STATE_INITIALIZED})")

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      DebugLog.w(TAG, "runAudioLoop: VOICE_RECOGNITION failed, trying MIC source")
      record.release()
      record = AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufferSize,
      )
      DebugLog.d(TAG, "runAudioLoop: MIC AudioRecord state=${record.state}")
      if (record.state != AudioRecord.STATE_INITIALIZED) {
        DebugLog.e(TAG, "AudioRecord failed to initialize with both sources")
        stopListeningAndCleanup()
        stopSelf()
        return
      }
    }

    val frame = ShortArray(frameSize)
    var frameCount = 0L

    try {
      DebugLog.d(TAG, "runAudioLoop: starting recording")
      record.startRecording()
      DebugLog.d(TAG, "runAudioLoop: recording started, entering main loop")
      while (isListening) {
        val read = record.read(frame, 0, frame.size)
        if (read == frame.size) {
          frameCount++
          if (frameCount % 100 == 0L) {
            Log.v(TAG, "runAudioLoop: processed $frameCount frames")
          }
          localEngine.processFrame(frame)

          val writer = synchronized(recordingLock) { if (isRecording) wavWriter else null }
          writer?.writePcm(frame)
        }
      }
      DebugLog.d(TAG, "runAudioLoop: exited main loop, isListening=$isListening")
    } catch (e: Exception) {
      DebugLog.e(TAG, "Audio loop error", e)
    } finally {
      DebugLog.d(TAG, "runAudioLoop: cleaning up, total frames=$frameCount")
      try {
        record.stop()
      } catch (_: Exception) {
      }
      record.release()
      if (isListening) {
        stopListeningAndCleanup()
      }
    }
  }

  private fun startRecording() {
    DebugLog.d(TAG, "startRecording: starting")
    synchronized(recordingLock) {
      if (isRecording) {
        DebugLog.d(TAG, "startRecording: already recording, returning")
        return
      }

      val file = FileUtils.newMemoFile(this)
      val sampleRate = engine?.sampleRate ?: 16000
      DebugLog.d(TAG, "startRecording: file=${file.absolutePath}, sampleRate=$sampleRate")

      wavWriter = WavWriter(file, sampleRate = sampleRate).apply { start() }
      lastFilePath = file.absolutePath
      isRecording = true
      DebugLog.i(TAG, "startRecording: RECORDING STARTED to $lastFilePath")
    }

    NotificationUtils.notify(this, NOTIFICATION_ID, NotificationUtils.buildNotification(this, true))
    broadcastStatus()
  }

  private fun stopRecording() {
    DebugLog.d(TAG, "stopRecording: stopping")
    synchronized(recordingLock) {
      if (!isRecording) {
        DebugLog.d(TAG, "stopRecording: not recording, returning")
        return
      }
      try {
        wavWriter?.stopAndFinalize()
        DebugLog.i(TAG, "stopRecording: RECORDING STOPPED, file=$lastFilePath")
      } finally {
        wavWriter = null
        isRecording = false
      }
    }

    NotificationUtils.notify(this, NOTIFICATION_ID, NotificationUtils.buildNotification(this, false))
    broadcastStatus()
  }

  private fun stopListeningAndCleanup() {
    isListening = false
    if (isRecording) stopRecording()

    try {
      val thread = audioThread
      if (thread != null && thread != Thread.currentThread()) {
        thread.join(500)
      }
    } catch (_: Exception) {
    }
    audioThread = null

    try {
      engine?.removeListener(engineListener)
      engine?.stop()
    } catch (_: Exception) {
    }
    engine = null

    broadcastStatus()
  }

  private fun broadcastStatus() {
    val i = Intent(ACTION_STATUS)
      .setPackage(packageName)
      .putExtra(EXTRA_IS_LISTENING, isListening)
      .putExtra(EXTRA_IS_RECORDING, isRecording)

    lastFilePath?.let { i.putExtra(EXTRA_LAST_FILE, it) }
    sendBroadcast(i)
  }

  override fun onDestroy() {
    stopListeningAndCleanup()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
