package ai.openclaw.android.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ai.openclaw.android.chat.ChatMessage
import ai.openclaw.android.chat.ChatPendingToolCall

@Composable
fun ChatMessageListCard(
  messages: List<ChatMessage>,
  pendingRunCount: Int,
  pendingToolCalls: List<ChatPendingToolCall>,
  streamingAssistantText: String?,
  healthOk: Boolean,
  modifier: Modifier = Modifier,
) {
  val listState = rememberLazyListState()

  LaunchedEffect(messages.size, pendingRunCount, pendingToolCalls.size, streamingAssistantText) {
    listState.animateScrollToItem(index = 0)
  }

  Box(modifier = modifier.fillMaxWidth()) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      state = listState,
      reverseLayout = true,
      verticalArrangement = Arrangement.spacedBy(12.dp),
      contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 8.dp),
    ) {
      val stream = streamingAssistantText?.trim()
      if (!stream.isNullOrEmpty()) {
        item(key = "stream") {
          ChatStreamingAssistantBubble(text = stream)
        }
      }

      if (pendingToolCalls.isNotEmpty()) {
        item(key = "tools") {
          ChatPendingToolsBubble(toolCalls = pendingToolCalls)
        }
      }

      if (pendingRunCount > 0) {
        item(key = "typing") {
          ChatTypingIndicatorBubble()
        }
      }

      items(count = messages.size, key = { idx -> messages[messages.size - 1 - idx].id }) { idx ->
        ChatMessageBubble(message = messages[messages.size - 1 - idx])
      }
    }

    if (messages.isEmpty() && pendingRunCount == 0 && pendingToolCalls.isEmpty() && streamingAssistantText.isNullOrBlank()) {
      EmptyChatHint(modifier = Modifier.align(Alignment.Center), healthOk = healthOk)
    }
  }
}

@Composable
private fun EmptyChatHint(modifier: Modifier = Modifier, healthOk: Boolean) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = MaterialTheme.colorScheme.surfaceContainerLow,
    tonalElevation = 1.dp,
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        "No messages yet",
        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        color = MaterialTheme.colorScheme.onSurface,
      )
      Text(
        text =
          if (healthOk) {
            "Send the first prompt to start this session."
          } else {
            "Connect gateway first, then return to chat."
          },
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}
