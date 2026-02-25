package ai.openclaw.android.ui.chat

import android.content.ContentResolver
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ai.openclaw.android.MainViewModel
import ai.openclaw.android.chat.ChatSessionEntry
import ai.openclaw.android.chat.OutgoingAttachment
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ChatSheetContent(viewModel: MainViewModel) {
  val messages by viewModel.chatMessages.collectAsState()
  val errorText by viewModel.chatError.collectAsState()
  val pendingRunCount by viewModel.pendingRunCount.collectAsState()
  val healthOk by viewModel.chatHealthOk.collectAsState()
  val sessionKey by viewModel.chatSessionKey.collectAsState()
  val mainSessionKey by viewModel.mainSessionKey.collectAsState()
  val thinkingLevel by viewModel.chatThinkingLevel.collectAsState()
  val streamingAssistantText by viewModel.chatStreamingAssistantText.collectAsState()
  val pendingToolCalls by viewModel.chatPendingToolCalls.collectAsState()
  val sessions by viewModel.chatSessions.collectAsState()

  LaunchedEffect(mainSessionKey) {
    viewModel.loadChat(mainSessionKey)
    viewModel.refreshChatSessions(limit = 200)
  }

  val context = LocalContext.current
  val resolver = context.contentResolver
  val scope = rememberCoroutineScope()

  val attachments = remember { mutableStateListOf<PendingImageAttachment>() }

  val pickImages =
    rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
      if (uris.isNullOrEmpty()) return@rememberLauncherForActivityResult
      scope.launch(Dispatchers.IO) {
        val next =
          uris.take(8).mapNotNull { uri ->
            try {
              loadImageAttachment(resolver, uri)
            } catch (_: Throwable) {
              null
            }
          }
        withContext(Dispatchers.Main) {
          attachments.addAll(next)
        }
      }
    }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .imePadding(),
  ) {
    ChatThreadSelector(
      sessionKey = sessionKey,
      sessions = sessions,
      mainSessionKey = mainSessionKey,
      onSelectSession = { key -> viewModel.switchChatSession(key) },
    )

    if (!errorText.isNullOrBlank()) {
      ChatErrorRail(errorText = errorText!!)
    }

    ChatMessageListCard(
      messages = messages,
      pendingRunCount = pendingRunCount,
      pendingToolCalls = pendingToolCalls,
      streamingAssistantText = streamingAssistantText,
      healthOk = healthOk,
      modifier = Modifier
        .weight(1f, fill = true)
        .fillMaxWidth(),
    )

    ChatComposer(
      healthOk = healthOk,
      thinkingLevel = thinkingLevel,
      pendingRunCount = pendingRunCount,
      attachments = attachments,
      onPickImages = { pickImages.launch("image/*") },
      onRemoveAttachment = { id -> attachments.removeAll { it.id == id } },
      onSetThinkingLevel = { level -> viewModel.setChatThinkingLevel(level) },
      onRefresh = {
        viewModel.refreshChat()
        viewModel.refreshChatSessions(limit = 200)
      },
      onAbort = { viewModel.abortChat() },
      onSend = { text ->
        val outgoing =
          attachments.map { att ->
            OutgoingAttachment(
              type = "image",
              mimeType = att.mimeType,
              fileName = att.fileName,
              base64 = att.base64,
            )
          }
        viewModel.sendChat(message = text, thinking = thinkingLevel, attachments = outgoing)
        attachments.clear()
      },
    )
  }
}

@Composable
private fun ChatThreadSelector(
  sessionKey: String,
  sessions: List<ChatSessionEntry>,
  mainSessionKey: String,
  onSelectSession: (String) -> Unit,
) {
  val sessionOptions = resolveSessionChoices(sessionKey, sessions, mainSessionKey = mainSessionKey)
  val currentSessionLabel =
    friendlySessionName(sessionOptions.firstOrNull { it.key == sessionKey }?.displayName ?: sessionKey)

  Column(
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 12.dp, vertical = 8.dp),
    verticalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text(
        text = "Session",
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        text = currentSessionLabel,
        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }

    Row(
      modifier = Modifier
        .fillMaxWidth()
        .horizontalScroll(rememberScrollState()),
      horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      for (entry in sessionOptions) {
        val active = entry.key == sessionKey
        FilterChip(
          selected = active,
          onClick = { onSelectSession(entry.key) },
          label = {
            Text(
              text = friendlySessionName(entry.displayName ?: entry.key),
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              style = MaterialTheme.typography.labelSmall,
            )
          },
          colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
          ),
          border = FilterChipDefaults.filterChipBorder(
            borderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
            selectedBorderColor = MaterialTheme.colorScheme.primary,
            enabled = true,
            selected = active,
          ),
        )
      }
    }
  }
}

@Composable
private fun ChatErrorRail(errorText: String) {
  Surface(
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 12.dp),
    color = MaterialTheme.colorScheme.errorContainer,
    shape = RoundedCornerShape(8.dp),
  ) {
    Text(
      text = errorText,
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onErrorContainer,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
    )
  }
}

data class PendingImageAttachment(
  val id: String,
  val fileName: String,
  val mimeType: String,
  val base64: String,
)

private suspend fun loadImageAttachment(resolver: ContentResolver, uri: Uri): PendingImageAttachment {
  val mimeType = resolver.getType(uri) ?: "image/*"
  val fileName = (uri.lastPathSegment ?: "image").substringAfterLast('/')
  val bytes =
    withContext(Dispatchers.IO) {
      resolver.openInputStream(uri)?.use { input ->
        val out = ByteArrayOutputStream()
        input.copyTo(out)
        out.toByteArray()
      } ?: ByteArray(0)
    }
  if (bytes.isEmpty()) throw IllegalStateException("empty attachment")
  val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
  return PendingImageAttachment(
    id = uri.toString() + "#" + System.currentTimeMillis().toString(),
    fileName = fileName,
    mimeType = mimeType,
    base64 = base64,
  )
}
