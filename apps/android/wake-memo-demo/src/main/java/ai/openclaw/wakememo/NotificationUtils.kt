package ai.openclaw.wakememo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotificationUtils {
  private const val CHANNEL_ID = "wake_memo"
  private const val CHANNEL_NAME = "Wake Memo"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = context.getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_LOW,
        ),
      )
    }
  }

  fun buildNotification(context: Context, isRecording: Boolean): Notification {
    val stopIntent = Intent(context, WakeMemoService::class.java).setAction(WakeMemoService.ACTION_STOP)
    val stopPi = PendingIntent.getService(
      context,
      1,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val text = if (isRecording) {
      "Recording... say \"alexa\" to stop"
    } else {
      "Listening... say \"hey jarvis\" to start"
    }

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("Wake Memo")
      .setContentText(text)
      .setOngoing(true)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop service", stopPi)
      .build()
  }

  fun notify(context: Context, id: Int, notification: Notification) {
    NotificationManagerCompat.from(context).notify(id, notification)
  }
}
