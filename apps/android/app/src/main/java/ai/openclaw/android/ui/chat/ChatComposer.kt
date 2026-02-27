package ai.openclaw.android.ui.chat

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

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
  var expanded by rememberSaveable { mutableStateOf(false) }

  val canSend = pendingRunCount == 0 && (input.trim().isNotEmpty() || attachments.isNotEmpty()) && healthOk
  val sendBusy = pendingRunCount > 0

  Column(
    modifier = Modifier
      .fillMaxWidth()
      .imePadding(),
    verticalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    if (attachments.isNotEmpty()) {
      AttachmentsStrip(attachments = attachments, onRemoveAttachment = onRemoveAttachment)
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(22.dp),
      color = MaterialTheme.colorScheme.surfaceContainerLow,
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)),
    ) {
      Column(
        modifier = Modifier.padding(vertical = 6.dp),
      ) {
        if (thinkingLevel != "off") {
          ThinkingBlock(
            thinkingLevel = thinkingLevel,
            expanded = expanded,
            onToggle = { expanded = !expanded },
            showThinkingMenu = showThinkingMenu,
            onShowMenu = { showThinkingMenu = true },
            onDismissMenu = { showThinkingMenu = false },
            onSetThinkingLevel = onSetThinkingLevel,
          )
        }

        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          IconButton(
            onClick = onPickImages,
            modifier = Modifier.size(36.dp),
          ) {
            Icon(
              Icons.Default.AttachFile,
              contentDescription = "Attach",
              tint = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.size(22.dp),
            )
          }

          Box(
            modifier = Modifier
              .weight(1f)
              .heightIn(min = 36.dp, max = 120.dp)
              .padding(horizontal = 4.dp),
          ) {
            if (input.isEmpty()) {
              Text(
                text = "Message",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 2.dp, top = 8.dp),
              )
            }
            BasicTextField(
              value = input,
              onValueChange = { input = it },
              modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
              textStyle = MaterialTheme.typography.bodyMedium.copy(
                color = MaterialTheme.colorScheme.onSurface,
              ),
              cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
              keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
              keyboardActions = KeyboardActions(
                onSend = {
                  if (canSend) {
                    val text = input
                    input = ""
                    onSend(text)
                  }
                },
              ),
              singleLine = false,
            )
          }

          // Right side buttons: Stop / Mic + Refresh / Send
          if (pendingRunCount > 0) {
            // Show stop button when processing
            IconButton(
              onClick = onAbort,
              modifier = Modifier.size(36.dp),
            ) {
              Icon(
                Icons.Default.Close,
                contentDescription = "Stop",
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(22.dp),
              )
            }
          } else if (input.isEmpty()) {
            // Show mic and refresh when text is blank
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
              IconButton(
                onClick = { },
                modifier = Modifier.size(36.dp),
              ) {
                Icon(
                  Icons.Default.Refresh,
                  contentDescription = "Refresh",
                  tint = MaterialTheme.colorScheme.onSurfaceVariant,
                  modifier = Modifier.size(20.dp),
                )
              }
              IconButton(
                onClick = { },
                modifier = Modifier.size(36.dp),
              ) {
                Icon(
                  Icons.Default.Mic,
                  contentDescription = "Voice",
                  tint = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(22.dp),
                )
              }
            }
          } else {
            // Show send button when there's text
            IconButton(
              onClick = {
                val text = input
                input = ""
                onSend(text)
              },
              enabled = canSend,
              modifier = Modifier.size(36.dp),
            ) {
              if (sendBusy) {
                androidx.compose.material3.CircularProgressIndicator(
                  modifier = Modifier.size(20.dp),
                  strokeWidth = 2.dp,
                  color = MaterialTheme.colorScheme.primary,
                )
              } else {
                Surface(
                  shape = RoundedCornerShape(18.dp),
                  color = if (canSend) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                ) {
                  Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = if (canSend) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                      .size(20.dp)
                      .padding(4.dp),
                  )
                }
              }
            }
          }
        }
      }
    }

    if (!healthOk) {
      Text(
        text = "Gateway offline",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.padding(horizontal = 4.dp),
      )
    }
  }
}

@Composable
private fun ThinkingBlock(
  thinkingLevel: String,
  expanded: Boolean,
  onToggle: () -> Unit,
  showThinkingMenu: Boolean,
  onShowMenu: () -> Unit,
  onDismissMenu: () -> Unit,
  onSetThinkingLevel: (level: String) -> Unit,
) {
  val accentColor = MaterialTheme.colorScheme.primary

  Column(
    modifier = Modifier
      .fillMaxWidth()
      .clickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
      ) { onToggle() }
      .animateContentSize(),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .height(if (expanded) 48.dp else 32.dp)
        .padding(horizontal = 12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Box(
        modifier = Modifier
          .width(3.dp)
          .height(if (expanded) 24.dp else 16.dp)
          .clip(RoundedCornerShape(2.dp))
          .clickable { onShowMenu() }
          .padding(end = 8.dp),
      ) {
        Surface(
          modifier = Modifier.fillMaxWidth().height(if (expanded) 24.dp else 16.dp),
          color = accentColor,
        ) {}
      }

      Row(
        modifier = Modifier
          .weight(1f)
          .clickable { onShowMenu() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Text(
          text = thinkingLabel(thinkingLevel),
          style = MaterialTheme.typography.bodySmall.copy(
            fontStyle = FontStyle.Italic,
            fontSize = 13.sp,
          ),
          color = accentColor,
        )
        Text(
          text = if (expanded) "▼" else "▶",
          style = MaterialTheme.typography.labelSmall,
          color = accentColor,
        )
      }
    }

    if (expanded) {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .heightIn(max = 200.dp)
          .padding(horizontal = 12.dp),
      ) {
        Text(
          text = "Reasoning enabled: ${thinkingLabel(thinkingLevel)} mode",
          style = MaterialTheme.typography.bodySmall.copy(fontStyle = FontStyle.Italic),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    DropdownMenu(
      expanded = showThinkingMenu,
      onDismissRequest = onDismissMenu,
    ) {
      listOf("off", "low", "medium", "high").forEach { level ->
        DropdownMenuItem(
          text = {
            Text(
              thinkingLabel(level),
              style = MaterialTheme.typography.bodySmall,
            )
          },
          onClick = {
            onSetThinkingLevel(level)
            onDismissMenu()
          },
          trailingIcon = {
            if (level == thinkingLevel.trim().lowercase()) {
              Text("✓", style = MaterialTheme.typography.bodySmall, color = accentColor)
            }
          },
        )
      }
    }
  }
}

@Composable
private fun AttachmentsStrip(
  attachments: List<PendingImageAttachment>,
  onRemoveAttachment: (id: String) -> Unit,
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .horizontalScroll(rememberScrollState()),
    horizontalArrangement = Arrangement.spacedBy(6.dp),
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
    shape = RoundedCornerShape(16.dp),
    color = MaterialTheme.colorScheme.secondaryContainer,
    tonalElevation = 0.dp,
  ) {
    Row(
      modifier = Modifier.padding(start = 10.dp, end = 2.dp, top = 4.dp, bottom = 4.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        text = fileName,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSecondaryContainer,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.width(80.dp),
      )
      IconButton(
        onClick = onRemove,
        modifier = Modifier.size(20.dp),
      ) {
        Icon(
          Icons.Default.Close,
          contentDescription = "Remove",
          tint = MaterialTheme.colorScheme.onSecondaryContainer,
          modifier = Modifier.size(12.dp),
        )
      }
    }
  }
}

private fun thinkingLabel(raw: String): String {
  return when (raw.trim().lowercase()) {
    "low" -> "Low"
    "medium" -> "Medium"
    "high" -> "High"
    else -> "Off"
  }
}
