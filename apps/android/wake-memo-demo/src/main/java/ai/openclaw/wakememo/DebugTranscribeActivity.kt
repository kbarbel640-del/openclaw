package ai.openclaw.wakememo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class DebugTranscribeActivity : AppCompatActivity() {

  private lateinit var statusText: TextView
  private lateinit var resultText: TextView
  private lateinit var recognizer: SpeechRecognizer

  private val permissionLauncher =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      if (granted) startTranscription()
      else Toast.makeText(this, "Microphone permission required", Toast.LENGTH_LONG).show()
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_debug_transcribe)

    statusText = findViewById(R.id.debugStatus)
    resultText = findViewById(R.id.debugResult)

    recognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
      setRecognitionListener(object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
          statusText.text = "Status: listening"
        }

        override fun onBeginningOfSpeech() {
          statusText.text = "Status: hearing"
        }

        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {
          statusText.text = "Status: processing"
        }

        override fun onError(error: Int) {
          statusText.text = "Status: error ($error)"
        }

        override fun onResults(results: Bundle?) {
          val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
          resultText.text = "Result: ${matches?.firstOrNull() ?: "(none)"}"
          statusText.text = "Status: idle"
        }

        override fun onPartialResults(partialResults: Bundle?) {
          val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
          if (!matches.isNullOrEmpty()) {
            resultText.text = "Partial: ${matches.first()}"
          }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
      })
    }

    findViewById<Button>(R.id.debugStartBtn).setOnClickListener { ensurePermissionThenStart() }
    findViewById<Button>(R.id.debugStopBtn).setOnClickListener { cancelTranscription() }
  }

  override fun onDestroy() {
    recognizer.destroy()
    super.onDestroy()
  }

  private fun ensurePermissionThenStart() {
    val permission = Manifest.permission.RECORD_AUDIO
    val granted = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    if (granted) startTranscription()
    else permissionLauncher.launch(permission)
  }

  private fun startTranscription() {
    if (!SpeechRecognizer.isRecognitionAvailable(this)) {
      Toast.makeText(this, "Speech recognition not available", Toast.LENGTH_LONG).show()
      return
    }

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
      if (Build.VERSION.SDK_INT >= 33) {
        putExtra(RecognizerIntent.EXTRA_ENABLE_FORMATTING, false)
      }
    }

    resultText.text = "Result: (listening...)"
    statusText.text = "Status: listening"
    recognizer.startListening(intent)
  }

  private fun cancelTranscription() {
    recognizer.cancel()
    statusText.text = "Status: idle"
  }
}
