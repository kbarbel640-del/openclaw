package ai.openclaw.android.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ScreenShare
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ai.openclaw.android.MainViewModel

private enum class HomeTab(
  val label: String,
  val icon: ImageVector,
) {
  Connect(label = "Connect", icon = Icons.Default.CheckCircle),
  Chat(label = "Chat", icon = Icons.Default.ChatBubble),
  Voice(label = "Voice", icon = Icons.Default.RecordVoiceOver),
  Screen(label = "Screen", icon = Icons.AutoMirrored.Filled.ScreenShare),
  Settings(label = "Settings", icon = Icons.Default.Settings),
}

private enum class StatusVisual {
  Connected,
  Connecting,
  Warning,
  Error,
  Offline,
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostOnboardingTabs(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  var activeTab by rememberSaveable { mutableStateOf(HomeTab.Connect) }

  val statusText by viewModel.statusText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()

  val statusVisual =
    remember(statusText, isConnected) {
      val lower = statusText.lowercase()
      when {
        isConnected -> StatusVisual.Connected
        lower.contains("connecting") || lower.contains("reconnecting") -> StatusVisual.Connecting
        lower.contains("pairing") || lower.contains("approval") || lower.contains("auth") -> StatusVisual.Warning
        lower.contains("error") || lower.contains("failed") -> StatusVisual.Error
        else -> StatusVisual.Offline
      }
    }

  val density = LocalDensity.current
  val imeVisible = WindowInsets.ime.getBottom(density) > 0
  val hideBottomTabBar = activeTab == HomeTab.Chat && imeVisible

  Scaffold(
    modifier = modifier,
    containerColor = Color.Transparent,
    contentWindowInsets = WindowInsets(0, 0, 0, 0),
    topBar = {
      M3TopStatusBar(
        statusText = statusText,
        statusVisual = statusVisual,
      )
    },
    bottomBar = {
      if (!hideBottomTabBar) {
        M3BottomNavigationBar(
          activeTab = activeTab,
          onSelect = { activeTab = it },
        )
      }
    },
  ) { innerPadding ->
    Box(
      modifier =
        Modifier
          .fillMaxSize()
          .padding(innerPadding)
          .consumeWindowInsets(innerPadding)
          .background(MaterialTheme.colorScheme.background),
    ) {
      when (activeTab) {
        HomeTab.Connect -> ConnectTabScreen(viewModel = viewModel)
        HomeTab.Chat -> ChatSheet(viewModel = viewModel)
        HomeTab.Voice -> VoiceTabScreen(viewModel = viewModel)
        HomeTab.Screen -> ScreenTabScreen(viewModel = viewModel)
        HomeTab.Settings -> SettingsSheet(viewModel = viewModel)
      }
    }
  }
}

@Composable
private fun ScreenTabScreen(viewModel: MainViewModel) {
  val isConnected by viewModel.isConnected.collectAsState()
  val isNodeConnected by viewModel.isNodeConnected.collectAsState()
  val canvasUrl by viewModel.canvasCurrentUrl.collectAsState()
  val canvasA2uiHydrated by viewModel.canvasA2uiHydrated.collectAsState()
  val canvasRehydratePending by viewModel.canvasRehydratePending.collectAsState()
  val canvasRehydrateErrorText by viewModel.canvasRehydrateErrorText.collectAsState()
  val isA2uiUrl = canvasUrl?.contains("/__openclaw__/a2ui/") == true
  val showRestoreCta = isConnected && isNodeConnected && (canvasUrl.isNullOrBlank() || (isA2uiUrl && !canvasA2uiHydrated))
  val restoreCtaText =
    when {
      canvasRehydratePending -> "Restore requested. Waiting for agent…"
      !canvasRehydrateErrorText.isNullOrBlank() -> canvasRehydrateErrorText!!
      else -> "Canvas reset. Tap to restore dashboard."
    }

  Box(modifier = Modifier.fillMaxSize()) {
    CanvasScreen(viewModel = viewModel, modifier = Modifier.fillMaxSize())

    if (showRestoreCta) {
      Surface(
        onClick = {
          if (canvasRehydratePending) return@Surface
          viewModel.requestCanvasRehydrate(source = "screen_tab_cta")
        },
        modifier = Modifier
          .align(Alignment.TopCenter)
          .padding(horizontal = 16.dp, vertical = 16.dp),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.9f),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shadowElevation = 4.dp,
      ) {
        Text(
          text = restoreCtaText,
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
          style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
          color = MaterialTheme.colorScheme.onSurface,
        )
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun M3TopStatusBar(
  statusText: String,
  statusVisual: StatusVisual,
) {
  val safeInsets = WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)

  val (chipColors, indicatorColor) =
    when (statusVisual) {
      StatusVisual.Connected ->
        Pair(
          SuggestionChipDefaults.suggestionChipColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            labelColor = MaterialTheme.colorScheme.onPrimaryContainer,
            iconContentColor = MaterialTheme.colorScheme.primary,
          ),
          MaterialTheme.colorScheme.primary,
        )
      StatusVisual.Connecting ->
        Pair(
          SuggestionChipDefaults.suggestionChipColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            labelColor = MaterialTheme.colorScheme.onSecondaryContainer,
            iconContentColor = MaterialTheme.colorScheme.secondary,
          ),
          MaterialTheme.colorScheme.secondary,
        )
      StatusVisual.Warning ->
        Pair(
          SuggestionChipDefaults.suggestionChipColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
            labelColor = MaterialTheme.colorScheme.onTertiaryContainer,
            iconContentColor = MaterialTheme.colorScheme.tertiary,
          ),
          MaterialTheme.colorScheme.tertiary,
        )
      StatusVisual.Error ->
        Pair(
          SuggestionChipDefaults.suggestionChipColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
            labelColor = MaterialTheme.colorScheme.onErrorContainer,
            iconContentColor = MaterialTheme.colorScheme.error,
          ),
          MaterialTheme.colorScheme.error,
        )
      StatusVisual.Offline ->
        Pair(
          SuggestionChipDefaults.suggestionChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
            labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
            iconContentColor = MaterialTheme.colorScheme.outline,
          ),
          MaterialTheme.colorScheme.outline,
        )
    }

  Surface(
    modifier = Modifier
      .fillMaxWidth()
      .windowInsetsPadding(safeInsets),
    color = Color.Transparent,
    shadowElevation = 0.dp,
  ) {
    CenterAlignedTopAppBar(
      title = { },
      actions = {
        SuggestionChip(
          onClick = { },
          label = {
            Text(
              text = statusText.trim().ifEmpty { "Offline" },
              style = MaterialTheme.typography.labelMedium,
            )
          },
          icon = {
            Surface(
              modifier = Modifier
                .padding(top = 1.dp),
              color = indicatorColor,
              shape = RoundedCornerShape(999.dp),
            ) {
              Box(modifier = Modifier.padding(4.dp))
            }
          },
          colors = chipColors,
          shape = RoundedCornerShape(CornerSize(50)),
          border = null,
        )
      },
      colors = TopAppBarDefaults.topAppBarColors(
        containerColor = Color.Transparent,
      ),
    )
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun M3BottomNavigationBar(
  activeTab: HomeTab,
  onSelect: (HomeTab) -> Unit,
) {
  val safeInsets = WindowInsets.navigationBars.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)

  NavigationBar(
    modifier = Modifier.fillMaxWidth(),
    containerColor = MaterialTheme.colorScheme.surface,
    tonalElevation = 3.dp,
  ) {
    HomeTab.entries.forEach { tab ->
      val active = tab == activeTab
      val iconColor by animateColorAsState(
        targetValue = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        label = "iconColor",
      )
      val labelColor by animateColorAsState(
        targetValue = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        label = "labelColor",
      )

      NavigationBarItem(
        selected = active,
        onClick = { onSelect(tab) },
        icon = {
          Icon(
            imageVector = tab.icon,
            contentDescription = tab.label,
            tint = iconColor,
          )
        },
        label = {
          Text(
            text = tab.label,
            color = labelColor,
            style = MaterialTheme.typography.labelSmall.copy(
              fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
            ),
          )
        },
        colors =
          NavigationBarItemDefaults.colors(
            selectedIconColor = MaterialTheme.colorScheme.primary,
            selectedTextColor = MaterialTheme.colorScheme.primary,
            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
          ),
      )
    }
  }
}
