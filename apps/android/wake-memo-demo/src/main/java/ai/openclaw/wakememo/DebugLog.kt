package ai.openclaw.wakememo

import android.os.Handler
import android.os.Looper
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList

/**
 * In-app debug logger that displays logs in the UI.
 * Call DebugLog.d/i/w/e() instead of Log.d/i/w/e() to show logs in app.
 */
object DebugLog {
  private const val MAX_LINES = 200
  private val lines = CopyOnWriteArrayList<String>()
  private val listeners = CopyOnWriteArrayList<(String) -> Unit>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val timeFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)

  fun addListener(listener: (String) -> Unit) {
    listeners.add(listener)
    // Send current log to new listener
    listener(getLog())
  }

  fun removeListener(listener: (String) -> Unit) {
    listeners.remove(listener)
  }

  fun getLog(): String = lines.joinToString("\n")

  fun clear() {
    lines.clear()
    notifyListeners()
  }

  fun d(tag: String, msg: String) {
    Log.d(tag, msg)
    append("D", tag, msg)
  }

  fun i(tag: String, msg: String) {
    Log.i(tag, msg)
    append("I", tag, msg)
  }

  fun w(tag: String, msg: String) {
    Log.w(tag, msg)
    append("W", tag, msg)
  }

  fun e(tag: String, msg: String, t: Throwable? = null) {
    if (t != null) {
      Log.e(tag, msg, t)
      append("E", tag, "$msg: ${t.message}")
    } else {
      Log.e(tag, msg)
      append("E", tag, msg)
    }
  }

  private fun append(level: String, tag: String, msg: String) {
    val time = timeFormat.format(Date())
    val shortTag = tag.replace("WakeMemo:", "").take(12)
    val line = "$time $level/$shortTag: $msg"
    
    lines.add(line)
    while (lines.size > MAX_LINES) {
      lines.removeAt(0)
    }
    
    notifyListeners()
  }

  private fun notifyListeners() {
    val log = getLog()
    mainHandler.post {
      listeners.forEach { it(log) }
    }
  }
}
