package ai.openclaw.wakememo

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
  companion object {
    private const val TAG = "WakeMemo:MainActivity"
  }

  private lateinit var statusText: TextView
  private lateinit var lastFileText: TextView
  private lateinit var logText: TextView
  private lateinit var logScroll: ScrollView
  private lateinit var debugBtn: Button

  private val logListener: (String) -> Unit = { log ->
    logText.text = log
    logScroll.post { logScroll.fullScroll(ScrollView.FOCUS_DOWN) }
  }

  private val permissionLauncher =
    registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
      val micOk = granted[Manifest.permission.RECORD_AUDIO] == true
      val notifOk = if (Build.VERSION.SDK_INT >= 33) {
        granted[Manifest.permission.POST_NOTIFICATIONS] == true
      } else true

      DebugLog.d(TAG, "Permissions granted: mic=$micOk, notif=$notifOk")
      if (micOk && notifOk) startWakeMemoService()
      else {
        DebugLog.e(TAG, "Permissions denied!")
        Toast.makeText(this, "Need microphone (and notification) permission", Toast.LENGTH_LONG).show()
      }
    }

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != WakeMemoService.ACTION_STATUS) return
      val listening = intent.getBooleanExtra(WakeMemoService.EXTRA_IS_LISTENING, false)
      val recording = intent.getBooleanExtra(WakeMemoService.EXTRA_IS_RECORDING, false)
      val lastFile = intent.getStringExtra(WakeMemoService.EXTRA_LAST_FILE)

      DebugLog.d(TAG, "Status: listening=$listening, recording=$recording")
      statusText.text = if (recording) "🔴 RECORDING" else if (listening) "🟢 LISTENING" else "⚪ IDLE"
      lastFileText.text = "Last file: ${lastFile ?: "(none)"}"
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    DebugLog.d(TAG, "=== App Started ===")
    DebugLog.d(TAG, "Build: ${BuildConfig.VERSION_NAME} (${BuildConfig.BUILD_TYPE})")
    setContentView(R.layout.activity_main)

    statusText = findViewById(R.id.statusText)
    lastFileText = findViewById(R.id.lastFileText)
    logText = findViewById(R.id.logText)
    logScroll = findViewById(R.id.logScroll)
    debugBtn = findViewById(R.id.debugBtn)

    findViewById<Button>(R.id.startBtn).setOnClickListener {
      DebugLog.d(TAG, "Start button pressed")
      ensurePermissionsThenStart()
    }
    findViewById<Button>(R.id.stopBtn).setOnClickListener {
      DebugLog.d(TAG, "Stop button pressed")
      stopService(Intent(this, WakeMemoService::class.java))
    }
    findViewById<Button>(R.id.clearLogBtn).setOnClickListener {
      DebugLog.clear()
      DebugLog.d(TAG, "Log cleared")
    }

    if (BuildConfig.DEBUG) {
      debugBtn.visibility = android.view.View.VISIBLE
      debugBtn.setOnClickListener {
        startActivity(Intent(this, DebugTranscribeActivity::class.java))
      }
    }

    DebugLog.d(TAG, "UI initialized")
  }

  override fun onStart() {
    super.onStart()
    DebugLog.d(TAG, "onStart: registering receivers")
    DebugLog.addListener(logListener)
    registerReceiver(
      statusReceiver,
      IntentFilter(WakeMemoService.ACTION_STATUS),
      Context.RECEIVER_NOT_EXPORTED
    )
  }

  override fun onStop() {
    super.onStop()
    DebugLog.d(TAG, "onStop: unregistering receivers")
    DebugLog.removeListener(logListener)
    unregisterReceiver(statusReceiver)
  }

  private fun ensurePermissionsThenStart() {
    val needed = mutableListOf(Manifest.permission.RECORD_AUDIO)
    if (Build.VERSION.SDK_INT >= 33) needed += Manifest.permission.POST_NOTIFICATIONS

    val missing = needed.filter {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }

    DebugLog.d(TAG, "Checking permissions: needed=${needed.size}, missing=${missing.size}")
    if (missing.isEmpty()) startWakeMemoService()
    else {
      DebugLog.d(TAG, "Requesting permissions: $missing")
      permissionLauncher.launch(missing.toTypedArray())
    }
  }

  private fun startWakeMemoService() {
    DebugLog.d(TAG, "Starting WakeMemoService...")
    val i = Intent(this, WakeMemoService::class.java).setAction(WakeMemoService.ACTION_START)
    ContextCompat.startForegroundService(this, i)
    Toast.makeText(this, "Service starting...", Toast.LENGTH_SHORT).show()
  }
}
