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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ai.openclaw.android.BuildConfig
import ai.openclaw.android.LocationMode
import ai.openclaw.android.MainViewModel

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
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      item {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text(
            "SETTINGS",
            style = MaterialTheme.typography.labelSmall.copy(
              fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
              letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
            ),
            color = MaterialTheme.colorScheme.primary,
          )
          Text(
            "Settings",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onSurface,
          )
          Text(
            "Manage capabilities, permissions, and diagnostics.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Order parity: Node → Voice → Camera → Messaging → Location → Screen.
      item {
        Text(
          "NODE",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        OutlinedTextField(
          value = displayName,
          onValueChange = viewModel::setDisplayName,
          label = { Text("Name", style = MaterialTheme.typography.bodySmall) },
          modifier = Modifier.fillMaxWidth(),
          textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
          shape = RoundedCornerShape(12.dp),
        )
      }
      item {
        Text(
          "Instance ID: $instanceId",
          style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      item {
        Text(
          "Device: $deviceModel",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      item {
        Text(
          "Version: $appVersion",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }

      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Voice
      item {
        Text(
          "VOICE",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        ListItem(
          headlineContent = {
            Text(
              "Microphone permission",
              style = MaterialTheme.typography.bodyLarge,
            )
          },
          supportingContent = {
            Text(
              if (micPermissionGranted) {
                "Granted. Use the Voice tab mic button to capture transcript."
              } else {
                "Required for Voice tab transcription."
              },
              style = MaterialTheme.typography.bodyMedium,
            )
          },
          trailingContent = {
            FilledTonalButton(
              onClick = {
                if (micPermissionGranted) {
                  openAppSettings(context)
                } else {
                  audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
              },
              shape = RoundedCornerShape(50),
            ) {
              Text(
                if (micPermissionGranted) "Manage" else "Grant",
                style = MaterialTheme.typography.labelLarge,
              )
            }
          },
        )
      }
      item {
        Text(
          "Voice wake and talk modes were removed. Voice now uses one mic on/off flow in the Voice tab.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }

      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Camera
      item {
        Text(
          "CAMERA",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        ListItem(
          headlineContent = {
            Text(
              "Allow Camera",
              style = MaterialTheme.typography.bodyLarge,
            )
          },
          supportingContent = {
            Text(
              "Allows the gateway to request photos or short video clips (foreground only).",
              style = MaterialTheme.typography.bodyMedium,
            )
          },
          trailingContent = {
            Switch(
              checked = cameraEnabled,
              onCheckedChange = ::setCameraEnabledChecked,
              colors = SwitchDefaults.colors(),
            )
          },
        )
      }
      item {
        Text(
          "Tip: grant Microphone permission for video clips with audio.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }

      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Messaging
      item {
        Text(
          "MESSAGING",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        val buttonLabel =
          when {
            !smsPermissionAvailable -> "Unavailable"
            smsPermissionGranted -> "Manage"
            else -> "Grant"
          }
        ListItem(
          headlineContent = {
            Text(
              "SMS Permission",
              style = MaterialTheme.typography.bodyLarge,
            )
          },
          supportingContent = {
            Text(
              if (smsPermissionAvailable) {
                "Allow the gateway to send SMS from this device."
              } else {
                "SMS requires a device with telephony hardware."
              },
              style = MaterialTheme.typography.bodyMedium,
            )
          },
          trailingContent = {
            FilledTonalButton(
              onClick = {
                if (!smsPermissionAvailable) return@FilledTonalButton
                if (smsPermissionGranted) {
                  openAppSettings(context)
                } else {
                  smsPermissionLauncher.launch(Manifest.permission.SEND_SMS)
                }
              },
              enabled = smsPermissionAvailable,
              shape = RoundedCornerShape(50),
            ) {
              Text(buttonLabel, style = MaterialTheme.typography.labelLarge)
            }
          },
        )
      }

      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Location
      item {
        Text(
          "LOCATION",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            headlineContent = {
              Text(
                "Off",
                style = MaterialTheme.typography.bodyLarge,
              )
            },
            supportingContent = {
              Text(
                "Disable location sharing.",
                style = MaterialTheme.typography.bodyMedium,
              )
            },
            trailingContent = {
              RadioButton(
                selected = locationMode == LocationMode.Off,
                onClick = { viewModel.setLocationMode(LocationMode.Off) },
                colors = RadioButtonDefaults.colors(),
              )
            },
          )
          HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            headlineContent = {
              Text(
                "While Using",
                style = MaterialTheme.typography.bodyLarge,
              )
            },
            supportingContent = {
              Text(
                "Only while OpenClaw is open.",
                style = MaterialTheme.typography.bodyMedium,
              )
            },
            trailingContent = {
              RadioButton(
                selected = locationMode == LocationMode.WhileUsing,
                onClick = { requestLocationPermissions(LocationMode.WhileUsing) },
                colors = RadioButtonDefaults.colors(),
              )
            },
          )
          HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            headlineContent = {
              Text(
                "Always",
                style = MaterialTheme.typography.bodyLarge,
              )
            },
            supportingContent = {
              Text(
                "Allow background location (requires system permission).",
                style = MaterialTheme.typography.bodyMedium,
              )
            },
            trailingContent = {
              RadioButton(
                selected = locationMode == LocationMode.Always,
                onClick = { requestLocationPermissions(LocationMode.Always) },
                colors = RadioButtonDefaults.colors(),
              )
            },
          )
          HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            headlineContent = {
              Text(
                "Precise Location",
                style = MaterialTheme.typography.bodyLarge,
              )
            },
            supportingContent = {
              Text(
                "Use precise GPS when available.",
                style = MaterialTheme.typography.bodyMedium,
              )
            },
            trailingContent = {
              Switch(
                checked = locationPreciseEnabled,
                onCheckedChange = ::setPreciseLocationChecked,
                enabled = locationMode != LocationMode.Off,
                colors = SwitchDefaults.colors(),
              )
            },
          )
        }
      }
      item {
        Text(
          "Always may require Android Settings to allow background location.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }

      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Screen
      item {
        Text(
          "SCREEN",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        ListItem(
          headlineContent = {
            Text(
              "Prevent Sleep",
              style = MaterialTheme.typography.bodyLarge,
            )
          },
          supportingContent = {
            Text(
              "Keeps the screen awake while OpenClaw is open.",
              style = MaterialTheme.typography.bodyMedium,
            )
          },
          trailingContent = {
            Switch(
              checked = preventSleep,
              onCheckedChange = viewModel::setPreventSleep,
              colors = SwitchDefaults.colors(),
            )
          },
        )
      }

      item { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) }

      // Debug
      item {
        Text(
          "DEBUG",
          style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = MaterialTheme.typography.labelSmall.fontWeight,
            letterSpacing = MaterialTheme.typography.labelSmall.letterSpacing,
          ),
          color = MaterialTheme.colorScheme.primary,
        )
      }
      item {
        ListItem(
          headlineContent = {
            Text(
              "Debug Canvas Status",
              style = MaterialTheme.typography.bodyLarge,
            )
          },
          supportingContent = {
            Text(
              "Show status text in the canvas when debug is enabled.",
              style = MaterialTheme.typography.bodyMedium,
            )
          },
          trailingContent = {
            Switch(
              checked = canvasDebugStatusEnabled,
              onCheckedChange = viewModel::setCanvasDebugStatusEnabled,
              colors = SwitchDefaults.colors(),
            )
          },
        )
      }

      item { Spacer(modifier = Modifier.height(24.dp)) }
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
