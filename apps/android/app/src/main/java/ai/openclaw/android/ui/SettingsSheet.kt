package ai.openclaw.android.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrightnessMedium
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.ScreenLockPortrait
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ai.openclaw.android.BuildConfig
import ai.openclaw.android.LocationMode
import ai.openclaw.android.MainViewModel
import ai.openclaw.android.SecurePrefsThemeMode

@Composable
fun SettingsSheet(viewModel: MainViewModel) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  val instanceId by viewModel.instanceId.collectAsState()
  val displayName by viewModel.displayName.collectAsState()
  val cameraEnabled by viewModel.cameraEnabled.collectAsState()
  val locationMode by viewModel.locationMode.collectAsState()
  val locationPreciseEnabled by viewModel.locationPreciseEnabled.collectAsState()
  val preventSleep by viewModel.preventSleep.collectAsState()
  val canvasDebugStatusEnabled by viewModel.canvasDebugStatusEnabled.collectAsState()
  val themeMode by viewModel.themeMode.collectAsState()

  val listState = rememberLazyListState()
  val deviceModel =
    remember {
      listOfNotNull(Build.MANUFACTURER, Build.MODEL)
        .joinToString(" ")
        .trim()
        .ifEmpty { "Android" }
    }
  val appVersion =
    remember {
      val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
      if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) {
        "$versionName-dev"
      } else {
        versionName
      }
    }

  val permissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
      val cameraOk = perms[Manifest.permission.CAMERA] == true
      viewModel.setCameraEnabled(cameraOk)
    }

  var pendingLocationMode by remember { mutableStateOf<LocationMode?>(null) }
  var pendingPreciseToggle by remember { mutableStateOf(false) }

  val locationPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
      val fineOk = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true
      val coarseOk = perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
      val granted = fineOk || coarseOk
      val requestedMode = pendingLocationMode
      pendingLocationMode = null

      if (pendingPreciseToggle) {
        pendingPreciseToggle = false
        viewModel.setLocationPreciseEnabled(fineOk)
        return@rememberLauncherForActivityResult
      }

      if (!granted) {
        viewModel.setLocationMode(LocationMode.Off)
        return@rememberLauncherForActivityResult
      }

      if (requestedMode != null) {
        viewModel.setLocationMode(requestedMode)
        if (requestedMode == LocationMode.Always) {
          val backgroundOk =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
              PackageManager.PERMISSION_GRANTED
          if (!backgroundOk) {
            openAppSettings(context)
          }
        }
      }
    }

  var micPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val audioPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      micPermissionGranted = granted
    }

  val smsPermissionAvailable =
    remember {
      context.packageManager?.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) == true
    }
  var smsPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val smsPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      smsPermissionGranted = granted
      viewModel.refreshGatewayConnection()
    }

  DisposableEffect(lifecycleOwner, context) {
    val observer =
      LifecycleEventObserver { _, event ->
        if (event == Lifecycle.Event.ON_RESUME) {
          micPermissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
              PackageManager.PERMISSION_GRANTED
          smsPermissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) ==
              PackageManager.PERMISSION_GRANTED
        }
      }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
  }

  fun setCameraEnabledChecked(checked: Boolean) {
    if (!checked) {
      viewModel.setCameraEnabled(false)
      return
    }

    val cameraOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    if (cameraOk) {
      viewModel.setCameraEnabled(true)
    } else {
      permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
    }
  }

  fun requestLocationPermissions(targetMode: LocationMode) {
    val fineOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarseOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (fineOk || coarseOk) {
      viewModel.setLocationMode(targetMode)
      if (targetMode == LocationMode.Always) {
        val backgroundOk =
          ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (!backgroundOk) {
          openAppSettings(context)
        }
      }
    } else {
      pendingLocationMode = targetMode
      locationPermissionLauncher.launch(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
      )
    }
  }

  fun setPreciseLocationChecked(checked: Boolean) {
    if (!checked) {
      viewModel.setLocationPreciseEnabled(false)
      return
    }
    val fineOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (fineOk) {
      viewModel.setLocationPreciseEnabled(true)
    } else {
      pendingPreciseToggle = true
      locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION))
    }
  }

  Box(modifier = Modifier.fillMaxSize()) {
    LazyColumn(
      state = listState,
      modifier =
        Modifier
          .fillMaxWidth()
          .fillMaxHeight()
          .imePadding()
          .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)),
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item {
        SettingsHeader()
      }

      item {
        AppearanceSection(
          themeMode = themeMode,
          onThemeChange = viewModel::setThemeMode
        )
      }

      item {
        NodeSection(
          displayName = displayName,
          instanceId = instanceId,
          deviceModel = deviceModel,
          appVersion = appVersion,
          onDisplayNameChange = viewModel::setDisplayName
        )
      }

      item {
        VoiceSection(
          micPermissionGranted = micPermissionGranted,
          onGrantMic = { audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO) },
          onManageMic = { openAppSettings(context) }
        )
      }

      item {
        CameraSection(
          cameraEnabled = cameraEnabled,
          onCameraEnabledChange = ::setCameraEnabledChecked
        )
      }

      item {
        MessagingSection(
          smsPermissionAvailable = smsPermissionAvailable,
          smsPermissionGranted = smsPermissionGranted,
          onGrantSms = { smsPermissionLauncher.launch(Manifest.permission.SEND_SMS) },
          onManageSms = { openAppSettings(context) }
        )
      }

      item {
        LocationSection(
          locationMode = locationMode,
          locationPreciseEnabled = locationPreciseEnabled,
          onLocationModeChange = { viewModel.setLocationMode(it) },
          onPreciseChange = ::setPreciseLocationChecked,
          onRequestPermissions = { requestLocationPermissions(it) }
        )
      }

      item {
        ScreenSection(
          preventSleep = preventSleep,
          onPreventSleepChange = viewModel::setPreventSleep
        )
      }

      item {
        DebugSection(
          canvasDebugStatusEnabled = canvasDebugStatusEnabled,
          onDebugStatusChange = viewModel::setCanvasDebugStatusEnabled
        )
      }

      item {
        Spacer(modifier = Modifier.height(16.dp))
      }
    }
  }
}

private fun openAppSettings(context: Context) {
  val intent =
    Intent(
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
      Uri.fromParts("package", context.packageName, null),
    )
  context.startActivity(intent)
}

@Composable
private fun SettingsHeader() {
  Column(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 8.dp),
    verticalArrangement = Arrangement.spacedBy(4.dp),
  ) {
    Text(
      "Settings",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
      color = MaterialTheme.colorScheme.onSurface,
    )
    Text(
      "Manage capabilities, permissions, and diagnostics",
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun AppearanceSection(
  themeMode: SecurePrefsThemeMode,
  onThemeChange: (SecurePrefsThemeMode) -> Unit,
) {
  SectionCard(title = "Appearance", icon = Icons.Default.BrightnessMedium) {
    ThemeOption(
      title = "System",
      subtitle = "Follow system theme",
      icon = Icons.Default.BrightnessMedium,
      selected = themeMode == SecurePrefsThemeMode.System,
      onClick = { onThemeChange(SecurePrefsThemeMode.System) }
    )
    ThemeOption(
      title = "Light",
      subtitle = "Always use light theme",
      icon = Icons.Default.LightMode,
      selected = themeMode == SecurePrefsThemeMode.Light,
      onClick = { onThemeChange(SecurePrefsThemeMode.Light) }
    )
    ThemeOption(
      title = "Dark",
      subtitle = "Always use dark theme",
      icon = Icons.Default.DarkMode,
      selected = themeMode == SecurePrefsThemeMode.Dark,
      onClick = { onThemeChange(SecurePrefsThemeMode.Dark) }
    )
  }
}

@Composable
private fun ThemeOption(
  title: String,
  subtitle: String,
  icon: ImageVector,
  selected: Boolean,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f) else MaterialTheme.colorScheme.surface,
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(12.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Box(
        modifier = Modifier
          .size(40.dp)
          .clip(CircleShape)
          .background(
            if (selected) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.surfaceContainerHighest
          ),
        contentAlignment = Alignment.Center,
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.size(20.dp),
        )
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
          title,
          style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
          color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
          subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      RadioButton(
        selected = selected,
        onClick = onClick,
        colors = RadioButtonDefaults.colors(
          selectedColor = MaterialTheme.colorScheme.primary,
        ),
      )
    }
  }
}

@Composable
private fun NodeSection(
  displayName: String,
  instanceId: String,
  deviceModel: String,
  appVersion: String,
  onDisplayNameChange: (String) -> Unit,
) {
  SectionCard(title = "Device", icon = Icons.Default.PhoneAndroid) {
    OutlinedTextField(
      value = displayName,
      onValueChange = onDisplayNameChange,
      label = { Text("Display Name") },
      modifier = Modifier.fillMaxWidth(),
      textStyle = MaterialTheme.typography.bodyLarge,
      shape = RoundedCornerShape(12.dp),
      singleLine = true,
    )
    Spacer(modifier = Modifier.height(12.dp))
    InfoRow(label = "Instance ID", value = instanceId)
    InfoRow(label = "Device", value = deviceModel)
    InfoRow(label = "Version", value = appVersion)
  }
}

@Composable
private fun VoiceSection(
  micPermissionGranted: Boolean,
  onGrantMic: () -> Unit,
  onManageMic: () -> Unit,
) {
  SectionCard(title = "Voice", icon = Icons.Default.Mic) {
    PermissionCard(
      title = "Microphone",
      subtitle = if (micPermissionGranted) "Permission granted" else "Required for voice transcription",
      granted = micPermissionGranted,
      onGrant = onGrantMic,
      onManage = onManageMic,
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
      "Voice uses a simple on/off mic flow in the Voice tab",
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun CameraSection(
  cameraEnabled: Boolean,
  onCameraEnabledChange: (Boolean) -> Unit,
) {
  SectionCard(title = "Camera", icon = Icons.Default.CameraAlt) {
    ToggleRow(
      title = "Allow Camera",
      subtitle = "Gateway can request photos and video clips",
      checked = cameraEnabled,
      onCheckedChange = onCameraEnabledChange,
    )
  }
}

@Composable
private fun MessagingSection(
  smsPermissionAvailable: Boolean,
  smsPermissionGranted: Boolean,
  onGrantSms: () -> Unit,
  onManageSms: () -> Unit,
) {
  SectionCard(title = "Messaging", icon = Icons.Default.Sms) {
    if (!smsPermissionAvailable) {
      Text(
        "SMS requires a device with telephony hardware",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    } else {
      PermissionCard(
        title = "SMS Permission",
        subtitle = "Allow gateway to send SMS",
        granted = smsPermissionGranted,
        onGrant = onGrantSms,
        onManage = onManageSms,
      )
    }
  }
}

@Composable
private fun LocationSection(
  locationMode: LocationMode,
  locationPreciseEnabled: Boolean,
  onLocationModeChange: (LocationMode) -> Unit,
  onPreciseChange: (Boolean) -> Unit,
  onRequestPermissions: (LocationMode) -> Unit,
) {
  SectionCard(title = "Location", icon = Icons.Default.LocationOn) {
    LocationOption(
      title = "Off",
      subtitle = "Disable location sharing",
      selected = locationMode == LocationMode.Off,
      onClick = { onLocationModeChange(LocationMode.Off) }
    )
    LocationOption(
      title = "While Using",
      subtitle = "Only while app is open",
      selected = locationMode == LocationMode.WhileUsing,
      onClick = { onRequestPermissions(LocationMode.WhileUsing) }
    )
    LocationOption(
      title = "Always",
      subtitle = "Allow background location",
      selected = locationMode == LocationMode.Always,
      onClick = { onRequestPermissions(LocationMode.Always) }
    )
    Spacer(modifier = Modifier.height(8.dp))
    ToggleRow(
      title = "Precise Location",
      subtitle = "Use GPS when available",
      checked = locationPreciseEnabled,
      onCheckedChange = onPreciseChange,
      enabled = locationMode != LocationMode.Off,
    )
  }
}

@Composable
private fun LocationOption(
  title: String,
  subtitle: String,
  selected: Boolean,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) else MaterialTheme.colorScheme.surface,
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(12.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
          title,
          style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
          color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
          subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      RadioButton(
        selected = selected,
        onClick = onClick,
        colors = RadioButtonDefaults.colors(
          selectedColor = MaterialTheme.colorScheme.primary,
        ),
      )
    }
  }
}

@Composable
private fun ScreenSection(
  preventSleep: Boolean,
  onPreventSleepChange: (Boolean) -> Unit,
) {
  SectionCard(title = "Screen", icon = Icons.Default.ScreenLockPortrait) {
    ToggleRow(
      title = "Prevent Sleep",
      subtitle = "Keep screen awake while app is open",
      checked = preventSleep,
      onCheckedChange = onPreventSleepChange,
    )
  }
}

@Composable
private fun DebugSection(
  canvasDebugStatusEnabled: Boolean,
  onDebugStatusChange: (Boolean) -> Unit,
) {
  SectionCard(title = "Debug", icon = Icons.Outlined.BugReport) {
    ToggleRow(
      title = "Canvas Status",
      subtitle = "Show status text on canvas",
      checked = canvasDebugStatusEnabled,
      onCheckedChange = onDebugStatusChange,
    )
  }
}

@Composable
private fun SectionCard(
  title: String,
  icon: ImageVector,
  content: @Composable () -> Unit,
) {
  ElevatedCard(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    colors = CardDefaults.elevatedCardColors(
      containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
    ),
  ) {
    Column(
      modifier = Modifier.padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(20.dp),
        )
        Text(
          title,
          style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
          color = MaterialTheme.colorScheme.onSurface,
        )
      }
      content()
    }
  }
}

@Composable
private fun InfoRow(label: String, value: String) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 2.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Text(
      label,
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Text(
      value,
      style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
      color = MaterialTheme.colorScheme.onSurface,
    )
  }
}

@Composable
private fun PermissionCard(
  title: String,
  subtitle: String,
  granted: Boolean,
  onGrant: () -> Unit,
  onManage: () -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(
        title,
        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
        color = MaterialTheme.colorScheme.onSurface,
      )
      Text(
        subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = if (granted) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
    FilledTonalButton(
      onClick = if (granted) onManage else onGrant,
      shape = RoundedCornerShape(20.dp),
    ) {
      Text(if (granted) "Manage" else "Grant")
    }
  }
}

@Composable
private fun ToggleRow(
  title: String,
  subtitle: String,
  checked: Boolean,
  onCheckedChange: (Boolean) -> Unit,
  enabled: Boolean = true,
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(
        title,
        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
        color = MaterialTheme.colorScheme.onSurface,
      )
      Text(
        subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
    Switch(
      checked = checked,
      onCheckedChange = onCheckedChange,
      enabled = enabled,
      colors = SwitchDefaults.colors(
        checkedThumbColor = MaterialTheme.colorScheme.primary,
        checkedTrackColor = MaterialTheme.colorScheme.primaryContainer,
      ),
    )
  }
}
