package ai.openclaw.android.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun ChatComposer(
  healthOk: Boolean,
  thinkingLevel: String,
  pendingRunCount: Int,
  attachments: List<PendingImageAttachment>,
  onPickImages: () -> Unit,
  onRemoveAttachment: (id: String) -> Unit,
  onSetThinkingLevel: (level: String) -> Unit,
  onRefresh: () -> Unit,
  onAbort: () -> Unit,
  onSend: (text: String) -> Unit,
) {
  var input by rememberSaveable { mutableStateOf("") }
  var showThinkingMenu by remember { mutableStateOf(false) }

  val canSend = pendingRunCount == 0 && (input.trim().isNotEmpty() || attachments.isNotEmpty()) && healthOk
  val sendBusy = pendingRunCount > 0

  Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Box(modifier = Modifier.weight(1f)) {
        Surface(
          onClick = { showThinkingMenu = true },
          shape = RoundedCornerShape(12.dp),
          color = MaterialTheme.colorScheme.secondaryContainer,
          tonalElevation = 1.dp,
        ) {
          Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
          ) {
            Text(
              text = "Thinking: ${thinkingLabel(thinkingLevel)}",
              style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
              color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
            Icon(
              Icons.Default.ArrowDropDown,
              contentDescription = "Select thinking level",
              tint = MaterialTheme.colorScheme.onSecondaryContainer,
            )
          }
        }

        DropdownMenu(expanded = showThinkingMenu, onDismissRequest = { showThinkingMenu = false }) {
          ThinkingMenuItem("off", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
          ThinkingMenuItem("low", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
          ThinkingMenuItem("medium", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
          ThinkingMenuItem("high", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
        }
      }

      IconButton(
        onClick = onPickImages,
        modifier = Modifier.size(40.dp),
      ) {
        Icon(
          Icons.Default.AttachFile,
          contentDescription = "Attach images",
          tint = MaterialTheme.colorScheme.primary,
        )
      }
    }

    if (attachments.isNotEmpty()) {
      AttachmentsStrip(attachments = attachments, onRemoveAttachment = onRemoveAttachment)
    }

    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

    Text(
      text = "MESSAGE",
      style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    OutlinedTextField(
      value = input,
      onValueChange = { input = it },
      modifier = Modifier.fillMaxWidth().height(96.dp),
      placeholder = {
        Text(
          "Type a message",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      },
      minLines = 2,
      maxLines = 5,
      textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
      shape = RoundedCornerShape(12.dp),
      colors = m3TextFieldColors(),
    )

    if (!healthOk) {
      Text(
        text = "Gateway is offline. Connect first in the Connect tab.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.error,
      )
    }

    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        SecondaryActionButton(
          icon = Icons.Default.Refresh,
          enabled = true,
          onClick = onRefresh,
        )

        SecondaryActionButton(
          icon = Icons.Default.Stop,
          enabled = pendingRunCount > 0,
          onClick = onAbort,
        )
      }

      Button(
        onClick = {
          val text = input
          input = ""
          onSend(text)
        },
        enabled = canSend,
        modifier = Modifier.weight(1f).height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors =
          ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
          ),
      ) {
        if (sendBusy) {
          CircularProgressIndicator(
            modifier = Modifier.size(16.dp),
            strokeWidth = 2.dp,
            color = MaterialTheme.colorScheme.onPrimary,
          )
        } else {
          Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
        }
        Spacer(modifier = Modifier.width(6.dp))
        Text(
          text = "Send",
          style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

@Composable
private fun SecondaryActionButton(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  enabled: Boolean,
  onClick: () -> Unit,
) {
  IconButton(
    onClick = onClick,
    enabled = enabled,
    modifier = Modifier.size(40.dp),
  ) {
    Icon(
      icon,
      contentDescription = null,
      tint = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun ThinkingMenuItem(
  value: String,
  current: String,
  onSet: (String) -> Unit,
  onDismiss: () -> Unit,
) {
  DropdownMenuItem(
    text = { Text(thinkingLabel(value), style = MaterialTheme.typography.bodyMedium) },
    onClick = {
      onSet(value)
      onDismiss()
    },
    trailingIcon = {
      if (value == current.trim().lowercase()) {
        Text("✓", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
      } else {
        Spacer(modifier = Modifier.width(24.dp))
      }
    },
  )
}

private fun thinkingLabel(raw: String): String {
  return when (raw.trim().lowercase()) {
    "low" -> "Low"
    "medium" -> "Medium"
    "high" -> "High"
    else -> "Off"
  }
}

@Composable
private fun AttachmentsStrip(
  attachments: List<PendingImageAttachment>,
  onRemoveAttachment: (id: String) -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    for (att in attachments) {
      AttachmentChip(
        fileName = att.fileName,
        onRemove = { onRemoveAttachment(att.id) },
      )
    }
  }
}

@Composable
private fun AttachmentChip(fileName: String, onRemove: () -> Unit) {
  Surface(
    shape = RoundedCornerShape(20.dp),
    color = MaterialTheme.colorScheme.secondaryContainer,
    tonalElevation = 0.dp,
  ) {
    Row(
      modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text(
        text = fileName,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSecondaryContainer,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.width(100.dp),
      )
      IconButton(
        onClick = onRemove,
        modifier = Modifier.size(24.dp),
      ) {
        Icon(
          Icons.Default.Close,
          contentDescription = "Remove",
          tint = MaterialTheme.colorScheme.onSecondaryContainer,
          modifier = Modifier.size(14.dp),
        )
      }
    }
  }
}

@Composable
private fun m3TextFieldColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = MaterialTheme.colorScheme.surface,
    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
    focusedBorderColor = MaterialTheme.colorScheme.primary,
    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
    focusedTextColor = MaterialTheme.colorScheme.onSurface,
    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
    cursorColor = MaterialTheme.colorScheme.primary,
    focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
    unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
  )
