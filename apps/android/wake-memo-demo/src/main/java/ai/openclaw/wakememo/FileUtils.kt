package ai.openclaw.wakememo

import android.content.Context
import android.os.Environment
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object FileUtils {
  fun newMemoFile(context: Context): File {
    val root = File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "memos")
    root.mkdirs()
    val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    return File(root, "memo_$ts.wav")
  }
}
