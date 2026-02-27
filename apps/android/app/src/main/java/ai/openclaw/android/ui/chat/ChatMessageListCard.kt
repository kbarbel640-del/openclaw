package ai.openclaw.android.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
  val surfaceColor = MaterialTheme.colorScheme.surface
  val isDark = surfaceColor.red * 0.299 + surfaceColor.green * 0.587 + surfaceColor.blue * 0.114 < 0.5
  val bgColor = if (isDark) Color(0xFF17212B) else Color(0xFFEFEFF3)

  LaunchedEffect(messages.size, pendingRunCount, pendingToolCalls.size, streamingAssistantText) {
    if (messages.isNotEmpty()) {
      listState.animateScrollToItem(index = 0)
    }
  }

  Box(
    modifier = modifier
      .fillMaxWidth()
      .background(bgColor),
  ) {
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 16.dp),
      state = listState,
      reverseLayout = true,
      verticalArrangement = Arrangement.spacedBy(2.dp),
      contentPadding = androidx.compose.foundation.layout.PaddingValues(
        top = 4.dp,
        bottom = 8.dp,
      ),
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
      EmptyChatHint(
        modifier = Modifier.align(Alignment.Center),
        healthOk = healthOk,
        isDark = isDark,
      )
    }
  }
}

@Composable
private fun EmptyChatHint(modifier: Modifier = Modifier, healthOk: Boolean, isDark: Boolean) {
  val hintBg = if (isDark) Color(0xFF17212B).copy(alpha = 0.8f) else Color(0xFFEFEFF3).copy(alpha = 0.8f)
  val textColor = if (isDark) Color(0xFFA8B2BC) else Color(0xFF5D6472)

  Column(
    modifier = modifier.padding(32.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(4.dp),
  ) {
    Text(
      if (healthOk) "Start a conversation" else "Connect gateway first",
      style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
      color = textColor,
      textAlign = TextAlign.Center,
    )
    if (healthOk) {
      Text(
        "Send a message to begin",
        style = MaterialTheme.typography.bodySmall,
        color = textColor.copy(alpha = 0.7f),
        textAlign = TextAlign.Center,
      )
    }
  }
}
