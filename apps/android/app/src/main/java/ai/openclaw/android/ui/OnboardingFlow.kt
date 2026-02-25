package ai.openclaw.android.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import ai.openclaw.android.LocationMode
import ai.openclaw.android.MainViewModel
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions

private enum class OnboardingStep(val index: Int, val label: String) {
  Welcome(1, "Welcome"),
  Gateway(2, "Gateway"),
  Permissions(3, "Permissions"),
  FinalCheck(4, "Connect"),
}

private enum class GatewayInputMode {
  SetupCode,
  Manual,
}

private val onboardingDisplayStyle = TextStyle(fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 40.sp, letterSpacing = (-0.8).sp)
private val onboardingTitle1Style = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.5).sp)
private val onboardingHeadlineStyle = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp, letterSpacing = (-0.1).sp)
private val onboardingBodyStyle = TextStyle(fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 22.sp)
private val onboardingCalloutStyle = TextStyle(fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp)
private val onboardingCaption1Style = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.2.sp)
private val onboardingCaption2Style = TextStyle(fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.4.sp)

@Composable
fun OnboardingFlow(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  val context = androidx.compose.ui.platform.LocalContext.current
  val statusText by viewModel.statusText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val serverName by viewModel.serverName.collectAsState()
  val remoteAddress by viewModel.remoteAddress.collectAsState()
  val persistedGatewayToken by viewModel.gatewayToken.collectAsState()
  val pendingTrust by viewModel.pendingGatewayTrust.collectAsState()

  var step by rememberSaveable { mutableStateOf(OnboardingStep.Welcome) }
  var setupCode by rememberSaveable { mutableStateOf("") }
  var gatewayUrl by rememberSaveable { mutableStateOf("") }
  var gatewayPassword by rememberSaveable { mutableStateOf("") }
  var gatewayInputMode by rememberSaveable { mutableStateOf(GatewayInputMode.SetupCode) }
  var gatewayAdvancedOpen by rememberSaveable { mutableStateOf(false) }
  var manualHost by rememberSaveable { mutableStateOf("10.0.2.2") }
  var manualPort by rememberSaveable { mutableStateOf("18789") }
  var manualTls by rememberSaveable { mutableStateOf(false) }
  var gatewayError by rememberSaveable { mutableStateOf<String?>(null) }
  var attemptedConnect by rememberSaveable { mutableStateOf(false) }

  var enableDiscovery by rememberSaveable { mutableStateOf(true) }
  var enableNotifications by rememberSaveable { mutableStateOf(true) }
  var enableMicrophone by rememberSaveable { mutableStateOf(false) }
  var enableCamera by rememberSaveable { mutableStateOf(false) }
  var enableSms by rememberSaveable { mutableStateOf(false) }

  val smsAvailable =
    remember(context) {
      context.packageManager?.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) == true
    }

  val selectedPermissions =
    remember(
      context,
      enableDiscovery,
      enableNotifications,
      enableMicrophone,
      enableCamera,
      enableSms,
      smsAvailable,
    ) {
      val requested = mutableListOf<String>()
      if (enableDiscovery) {
        requested += if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES else Manifest.permission.ACCESS_FINE_LOCATION
      }
      if (enableNotifications && Build.VERSION.SDK_INT >= 33) requested += Manifest.permission.POST_NOTIFICATIONS
      if (enableMicrophone) requested += Manifest.permission.RECORD_AUDIO
      if (enableCamera) requested += Manifest.permission.CAMERA
      if (enableSms && smsAvailable) requested += Manifest.permission.SEND_SMS
      requested.filterNot { isPermissionGranted(context, it) }
    }

  val enabledPermissionSummary =
    remember(enableDiscovery, enableNotifications, enableMicrophone, enableCamera, enableSms, smsAvailable) {
      val enabled = mutableListOf<String>()
      if (enableDiscovery) enabled += "Gateway discovery"
      if (Build.VERSION.SDK_INT >= 33 && enableNotifications) enabled += "Notifications"
      if (enableMicrophone) enabled += "Microphone"
      if (enableCamera) enabled += "Camera"
      if (smsAvailable && enableSms) enabled += "SMS"
      if (enabled.isEmpty()) "None selected" else enabled.joinToString(", ")
    }

  val permissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
      step = OnboardingStep.FinalCheck
    }

  val qrScanLauncher =
    rememberLauncherForActivityResult(ScanContract()) { result ->
      val contents = result.contents?.trim().orEmpty()
      if (contents.isEmpty()) {
        return@rememberLauncherForActivityResult
      }
      val scannedSetupCode = resolveScannedSetupCode(contents)
      if (scannedSetupCode == null) {
        gatewayError = "QR code did not contain a valid setup code."
        return@rememberLauncherForActivityResult
      }
      setupCode = scannedSetupCode
      gatewayInputMode = GatewayInputMode.SetupCode
      gatewayError = null
      attemptedConnect = false
    }

  if (pendingTrust != null) {
    val prompt = pendingTrust!!
    AlertDialog(
      onDismissRequest = { viewModel.declineGatewayTrustPrompt() },
      title = { Text("Trust this gateway?") },
      text = {
        Text(
          "First-time TLS connection.\n\nVerify this SHA-256 fingerprint before trusting:\n${prompt.fingerprintSha256}",
        )
      },
      confirmButton = {
        TextButton(onClick = { viewModel.acceptGatewayTrustPrompt() }) {
          Text("Trust and continue")
        }
      },
      dismissButton = {
        TextButton(onClick = { viewModel.declineGatewayTrustPrompt() }) {
          Text("Cancel")
        }
      },
    )
  }

  val colorScheme = MaterialTheme.colorScheme

  Box(
    modifier =
      modifier
        .fillMaxSize()
        .background(MaterialTheme.colorScheme.surface),
  ) {
    Column(
      modifier =
        Modifier
          .fillMaxSize()
          .imePadding()
          .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
          .navigationBarsPadding()
          .padding(horizontal = 20.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.SpaceBetween,
    ) {
      Column(
        modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(20.dp),
      ) {
        Column(
          modifier = Modifier.padding(top = 12.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text(
            "FIRST RUN",
            style = onboardingCaption1Style.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp),
            color = colorScheme.primary,
          )
          Text(
            "OpenClaw\nMobile Setup",
            style = onboardingDisplayStyle.copy(lineHeight = 38.sp),
            color = colorScheme.onSurface,
          )
          Text(
            "Step ${step.index} of 4",
            style = onboardingCaption1Style,
            color = colorScheme.primary,
          )
        }
        StepRailWrap(current = step)

        when (step) {
          OnboardingStep.Welcome -> WelcomeStep()
          OnboardingStep.Gateway ->
            GatewayStep(
              inputMode = gatewayInputMode,
              advancedOpen = gatewayAdvancedOpen,
              setupCode = setupCode,
              manualHost = manualHost,
              manualPort = manualPort,
              manualTls = manualTls,
              gatewayToken = persistedGatewayToken,
              gatewayPassword = gatewayPassword,
              gatewayError = gatewayError,
              onScanQrClick = {
                gatewayError = null
                qrScanLauncher.launch(
                  ScanOptions().apply {
                    setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                    setPrompt("Scan OpenClaw onboarding QR")
                    setBeepEnabled(false)
                    setOrientationLocked(false)
                  },
                )
              },
              onAdvancedOpenChange = { gatewayAdvancedOpen = it },
              onInputModeChange = {
                gatewayInputMode = it
                gatewayError = null
              },
              onSetupCodeChange = {
                setupCode = it
                gatewayError = null
              },
              onManualHostChange = {
                manualHost = it
                gatewayError = null
              },
              onManualPortChange = {
                manualPort = it
                gatewayError = null
              },
              onManualTlsChange = { manualTls = it },
              onTokenChange = viewModel::setGatewayToken,
              onPasswordChange = { gatewayPassword = it },
            )
          OnboardingStep.Permissions ->
            PermissionsStep(
              enableDiscovery = enableDiscovery,
              enableNotifications = enableNotifications,
              enableMicrophone = enableMicrophone,
              enableCamera = enableCamera,
              enableSms = enableSms,
              smsAvailable = smsAvailable,
              context = context,
              onDiscoveryChange = { enableDiscovery = it },
              onNotificationsChange = { enableNotifications = it },
              onMicrophoneChange = { enableMicrophone = it },
              onCameraChange = { enableCamera = it },
              onSmsChange = { enableSms = it },
            )
          OnboardingStep.FinalCheck ->
            FinalStep(
              parsedGateway = parseGatewayEndpoint(gatewayUrl),
              statusText = statusText,
              isConnected = isConnected,
              serverName = serverName,
              remoteAddress = remoteAddress,
              attemptedConnect = attemptedConnect,
              enabledPermissions = enabledPermissionSummary,
              methodLabel = if (gatewayInputMode == GatewayInputMode.SetupCode) "QR / Setup Code" else "Manual",
            )
        }
      }

      Spacer(Modifier.height(12.dp))

      Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        val backEnabled = step != OnboardingStep.Welcome
        Surface(
          modifier = Modifier.size(52.dp),
          shape = RoundedCornerShape(14.dp),
          color = colorScheme.surfaceContainerHighest,
          border = androidx.compose.foundation.BorderStroke(1.dp, if (backEnabled) colorScheme.outline else colorScheme.outlineVariant),
        ) {
          IconButton(
            onClick = {
              step =
                when (step) {
                  OnboardingStep.Welcome -> OnboardingStep.Welcome
                  OnboardingStep.Gateway -> OnboardingStep.Welcome
                  OnboardingStep.Permissions -> OnboardingStep.Gateway
                  OnboardingStep.FinalCheck -> OnboardingStep.Permissions
                }
            },
            enabled = backEnabled,
          ) {
            Icon(
              Icons.AutoMirrored.Filled.ArrowBack,
              contentDescription = "Back",
              tint = if (backEnabled) colorScheme.onSurfaceVariant else colorScheme.onSurfaceVariant.copy(alpha = 0.38f),
            )
          }
        }

        when (step) {
          OnboardingStep.Welcome -> {
            Button(
              onClick = { step = OnboardingStep.Gateway },
              modifier = Modifier.weight(1f).height(52.dp),
              shape = RoundedCornerShape(28.dp),
              colors = ButtonDefaults.buttonColors(
                containerColor = colorScheme.primary,
                contentColor = colorScheme.onPrimary,
              ),
            ) {
              Text("Next", style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold), color = colorScheme.onPrimary)
            }
          }
          OnboardingStep.Gateway -> {
            Button(
              onClick = {
                if (gatewayInputMode == GatewayInputMode.SetupCode) {
                  val parsedSetup = decodeGatewaySetupCode(setupCode)
                  if (parsedSetup == null) {
                    gatewayError = "Scan QR code first, or use Advanced setup."
                    return@Button
                  }
                  val parsedGateway = parseGatewayEndpoint(parsedSetup.url)
                  if (parsedGateway == null) {
                    gatewayError = "Setup code has invalid gateway URL."
                    return@Button
                  }
                  gatewayUrl = parsedSetup.url
                  parsedSetup.token?.let { viewModel.setGatewayToken(it) }
                  gatewayPassword = parsedSetup.password.orEmpty()
                } else {
                  val manualUrl = composeGatewayManualUrl(manualHost, manualPort, manualTls)
                  val parsedGateway = manualUrl?.let(::parseGatewayEndpoint)
                  if (parsedGateway == null) {
                    gatewayError = "Manual endpoint is invalid."
                    return@Button
                  }
                  gatewayUrl = parsedGateway.displayUrl
                }
                step = OnboardingStep.Permissions
              },
              modifier = Modifier.weight(1f).height(52.dp),
              shape = RoundedCornerShape(28.dp),
              colors = ButtonDefaults.buttonColors(
                containerColor = colorScheme.primary,
                contentColor = colorScheme.onPrimary,
              ),
            ) {
              Text("Next", style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold), color = colorScheme.onPrimary)
            }
          }
          OnboardingStep.Permissions -> {
            Button(
              onClick = {
                viewModel.setCameraEnabled(enableCamera)
                viewModel.setLocationMode(if (enableDiscovery) LocationMode.WhileUsing else LocationMode.Off)
                if (selectedPermissions.isEmpty()) {
                  step = OnboardingStep.FinalCheck
                } else {
                  permissionLauncher.launch(selectedPermissions.toTypedArray())
                }
              },
              modifier = Modifier.weight(1f).height(52.dp),
              shape = RoundedCornerShape(28.dp),
              colors = ButtonDefaults.buttonColors(
                containerColor = colorScheme.primary,
                contentColor = colorScheme.onPrimary,
              ),
            ) {
              Text("Next", style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold), color = colorScheme.onPrimary)
            }
          }
          OnboardingStep.FinalCheck -> {
            if (isConnected) {
              Button(
                onClick = { viewModel.setOnboardingCompleted(true) },
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                  containerColor = colorScheme.primary,
                  contentColor = colorScheme.onPrimary,
                ),
              ) {
                Text("Finish", style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold), color = colorScheme.onPrimary)
              }
            } else {
              Button(
                onClick = {
                  val parsed = parseGatewayEndpoint(gatewayUrl)
                  if (parsed == null) {
                    step = OnboardingStep.Gateway
                    gatewayError = "Invalid gateway URL."
                    return@Button
                  }
                  val token = persistedGatewayToken.trim()
                  val password = gatewayPassword.trim()
                  attemptedConnect = true
                  viewModel.setManualEnabled(true)
                  viewModel.setManualHost(parsed.host)
                  viewModel.setManualPort(parsed.port)
                  viewModel.setManualTls(parsed.tls)
                  if (token.isNotEmpty()) {
                    viewModel.setGatewayToken(token)
                  }
                  viewModel.setGatewayPassword(password)
                  viewModel.connectManual()
                },
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                  containerColor = colorScheme.primary,
                  contentColor = colorScheme.onPrimary,
                ),
              ) {
                Text("Connect", style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold), color = colorScheme.onPrimary)
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun StepRailWrap(current: OnboardingStep) {
  val colorScheme = MaterialTheme.colorScheme
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    HorizontalDivider(color = colorScheme.outlineVariant)
    StepRail(current = current)
    HorizontalDivider(color = colorScheme.outlineVariant)
  }
}

@Composable
private fun StepRail(current: OnboardingStep) {
  val colorScheme = MaterialTheme.colorScheme
  val steps = OnboardingStep.entries
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    steps.forEach { step ->
      val complete = step.index < current.index
      val active = step.index == current.index
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Box(
          modifier =
            Modifier
              .fillMaxWidth()
              .height(5.dp)
              .background(
                color = when {
                  complete -> colorScheme.tertiary
                  active -> colorScheme.primary
                  else -> colorScheme.surfaceContainerHighest
                },
                shape = RoundedCornerShape(999.dp),
              ),
        )
        Text(
          text = step.label,
          style = onboardingCaption2Style.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
          color = if (active) colorScheme.primary else colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

@Composable
private fun WelcomeStep() {
  val colorScheme = MaterialTheme.colorScheme
  StepShell(title = "What You Get") {
    Bullet("Control the gateway and operator chat from one mobile surface.")
    Bullet("Connect with setup code and recover pairing with CLI commands.")
    Bullet("Enable only the permissions and capabilities you want.")
    Bullet("Finish with a real connection check before entering the app.")
  }
}

@Composable
private fun GatewayStep(
  inputMode: GatewayInputMode,
  advancedOpen: Boolean,
  setupCode: String,
  manualHost: String,
  manualPort: String,
  manualTls: Boolean,
  gatewayToken: String,
  gatewayPassword: String,
  gatewayError: String?,
  onScanQrClick: () -> Unit,
  onAdvancedOpenChange: (Boolean) -> Unit,
  onInputModeChange: (GatewayInputMode) -> Unit,
  onSetupCodeChange: (String) -> Unit,
  onManualHostChange: (String) -> Unit,
  onManualPortChange: (String) -> Unit,
  onManualTlsChange: (Boolean) -> Unit,
  onTokenChange: (String) -> Unit,
  onPasswordChange: (String) -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  val resolvedEndpoint = remember(setupCode) { decodeGatewaySetupCode(setupCode)?.url?.let { parseGatewayEndpoint(it)?.displayUrl } }
  val manualResolvedEndpoint = remember(manualHost, manualPort, manualTls) { composeGatewayManualUrl(manualHost, manualPort, manualTls)?.let { parseGatewayEndpoint(it)?.displayUrl } }

  StepShell(title = "Gateway Connection") {
    GuideBlock(title = "Scan onboarding QR") {
      Text("Run these on the gateway host:", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
      CommandBlock("openclaw qr")
      Text("Then scan with this device.", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
    }
    Button(
      onClick = onScanQrClick,
      modifier = Modifier.fillMaxWidth().height(48.dp),
      shape = RoundedCornerShape(28.dp),
      colors = ButtonDefaults.buttonColors(
        containerColor = colorScheme.primary,
        contentColor = colorScheme.onPrimary,
      ),
    ) {
      Text("Scan QR code", style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold), color = colorScheme.onPrimary)
    }
    if (!resolvedEndpoint.isNullOrBlank()) {
      Text("QR captured. Review endpoint below.", style = onboardingCalloutStyle, color = colorScheme.tertiary)
      ResolvedEndpoint(endpoint = resolvedEndpoint)
    }

    ElevatedCard(
      modifier = Modifier.fillMaxWidth(),
      onClick = { onAdvancedOpenChange(!advancedOpen) },
      colors = CardDefaults.elevatedCardColors(
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
      ),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text("Advanced setup", style = onboardingHeadlineStyle, color = colorScheme.onSurface)
          Text("Paste setup code or enter host/port manually.", style = onboardingCaption1Style, color = colorScheme.onSurfaceVariant)
        }
        Icon(
          imageVector = if (advancedOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
          contentDescription = if (advancedOpen) "Collapse advanced setup" else "Expand advanced setup",
          tint = colorScheme.onSurfaceVariant,
        )
      }
    }

    AnimatedVisibility(visible = advancedOpen) {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GuideBlock(title = "Manual setup commands") {
          Text("Run these on the gateway host:", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
          CommandBlock("openclaw qr --setup-code-only")
          CommandBlock("openclaw qr --json")
          Text(
            "`--json` prints `setupCode` and `gatewayUrl`.",
            style = onboardingCalloutStyle,
            color = colorScheme.onSurfaceVariant,
          )
          Text(
            "Auto URL discovery is not wired yet. Android emulator uses `10.0.2.2`; real devices need LAN/Tailscale host.",
            style = onboardingCalloutStyle,
            color = colorScheme.onSurfaceVariant,
          )
        }
        GatewayModeToggle(inputMode = inputMode, onInputModeChange = onInputModeChange)

        if (inputMode == GatewayInputMode.SetupCode) {
          Text("SETUP CODE", style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = colorScheme.onSurfaceVariant)
          OutlinedTextField(
            value = setupCode,
            onValueChange = onSetupCodeChange,
            placeholder = { Text("Paste code from `openclaw qr --setup-code-only`", color = colorScheme.onSurfaceVariant, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 5,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = onboardingBodyStyle.copy(fontFamily = FontFamily.Monospace, color = colorScheme.onSurface),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = colorScheme.surfaceContainerLow,
              unfocusedContainerColor = colorScheme.surfaceContainerLow,
              focusedBorderColor = colorScheme.primary,
              unfocusedBorderColor = colorScheme.outline,
              focusedTextColor = colorScheme.onSurface,
              unfocusedTextColor = colorScheme.onSurface,
              cursorColor = colorScheme.primary,
            ),
          )
          if (!resolvedEndpoint.isNullOrBlank()) {
            ResolvedEndpoint(endpoint = resolvedEndpoint)
          }
        } else {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickFillChip(label = "Android Emulator", onClick = {
              onManualHostChange("10.0.2.2")
              onManualPortChange("18789")
              onManualTlsChange(false)
            })
            QuickFillChip(label = "Localhost", onClick = {
              onManualHostChange("127.0.0.1")
              onManualPortChange("18789")
              onManualTlsChange(false)
            })
          }

          Text("HOST", style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = colorScheme.onSurfaceVariant)
          OutlinedTextField(
            value = manualHost,
            onValueChange = onManualHostChange,
            placeholder = { Text("10.0.2.2", color = colorScheme.onSurfaceVariant, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            textStyle = onboardingBodyStyle.copy(color = colorScheme.onSurface),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = colorScheme.surfaceContainerLow,
              unfocusedContainerColor = colorScheme.surfaceContainerLow,
              focusedBorderColor = colorScheme.primary,
              unfocusedBorderColor = colorScheme.outline,
              focusedTextColor = colorScheme.onSurface,
              unfocusedTextColor = colorScheme.onSurface,
              cursorColor = colorScheme.primary,
            ),
          )

          Text("PORT", style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = colorScheme.onSurfaceVariant)
          OutlinedTextField(
            value = manualPort,
            onValueChange = onManualPortChange,
            placeholder = { Text("18789", color = colorScheme.onSurfaceVariant, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            textStyle = onboardingBodyStyle.copy(fontFamily = FontFamily.Monospace, color = colorScheme.onSurface),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = colorScheme.surfaceContainerLow,
              unfocusedContainerColor = colorScheme.surfaceContainerLow,
              focusedBorderColor = colorScheme.primary,
              unfocusedBorderColor = colorScheme.outline,
              focusedTextColor = colorScheme.onSurface,
              unfocusedTextColor = colorScheme.onSurface,
              cursorColor = colorScheme.primary,
            ),
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
          ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
              Text("Use TLS", style = onboardingHeadlineStyle, color = colorScheme.onSurface)
              Text("Switch to secure websocket (`wss`).", style = onboardingCalloutStyle.copy(lineHeight = 18.sp), color = colorScheme.onSurfaceVariant)
            }
            Switch(
              checked = manualTls,
              onCheckedChange = onManualTlsChange,
              colors = SwitchDefaults.colors(
                checkedTrackColor = colorScheme.primary,
                uncheckedTrackColor = colorScheme.surfaceContainerHighest,
                checkedThumbColor = colorScheme.onPrimary,
                uncheckedThumbColor = colorScheme.onSurfaceVariant,
              ),
            )
          }

          Text("TOKEN (OPTIONAL)", style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = colorScheme.onSurfaceVariant)
          OutlinedTextField(
            value = gatewayToken,
            onValueChange = onTokenChange,
            placeholder = { Text("token", color = colorScheme.onSurfaceVariant, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = onboardingBodyStyle.copy(color = colorScheme.onSurface),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = colorScheme.surfaceContainerLow,
              unfocusedContainerColor = colorScheme.surfaceContainerLow,
              focusedBorderColor = colorScheme.primary,
              unfocusedBorderColor = colorScheme.outline,
              focusedTextColor = colorScheme.onSurface,
              unfocusedTextColor = colorScheme.onSurface,
              cursorColor = colorScheme.primary,
            ),
          )

          Text("PASSWORD (OPTIONAL)", style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = colorScheme.onSurfaceVariant)
          OutlinedTextField(
            value = gatewayPassword,
            onValueChange = onPasswordChange,
            placeholder = { Text("password", color = colorScheme.onSurfaceVariant, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = onboardingBodyStyle.copy(color = colorScheme.onSurface),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = colorScheme.surfaceContainerLow,
              unfocusedContainerColor = colorScheme.surfaceContainerLow,
              focusedBorderColor = colorScheme.primary,
              unfocusedBorderColor = colorScheme.outline,
              focusedTextColor = colorScheme.onSurface,
              unfocusedTextColor = colorScheme.onSurface,
              cursorColor = colorScheme.primary,
            ),
          )

          if (!manualResolvedEndpoint.isNullOrBlank()) {
            ResolvedEndpoint(endpoint = manualResolvedEndpoint)
          }
        }
      }
    }

    if (!gatewayError.isNullOrBlank()) {
      Text(gatewayError, color = colorScheme.error, style = onboardingCaption1Style)
    }
  }
}

@Composable
private fun GuideBlock(
  title: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(modifier = Modifier.width(2.dp).fillMaxHeight().background(colorScheme.primary.copy(alpha = 0.4f)))
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(title, style = onboardingHeadlineStyle, color = colorScheme.onSurface)
      content()
    }
  }
}

@Composable
private fun GatewayModeToggle(
  inputMode: GatewayInputMode,
  onInputModeChange: (GatewayInputMode) -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
    GatewayModeChip(
      label = "Setup Code",
      active = inputMode == GatewayInputMode.SetupCode,
      onClick = { onInputModeChange(GatewayInputMode.SetupCode) },
      modifier = Modifier.weight(1f),
    )
    GatewayModeChip(
      label = "Manual",
      active = inputMode == GatewayInputMode.Manual,
      onClick = { onInputModeChange(GatewayInputMode.Manual) },
      modifier = Modifier.weight(1f),
    )
  }
}

@Composable
private fun GatewayModeChip(
  label: String,
  active: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val colorScheme = MaterialTheme.colorScheme
  Button(
    onClick = onClick,
    modifier = modifier.height(40.dp),
    shape = RoundedCornerShape(20.dp),
    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
    colors = ButtonDefaults.buttonColors(
      containerColor = if (active) colorScheme.primary else colorScheme.surfaceContainerLow,
      contentColor = if (active) colorScheme.onPrimary else colorScheme.onSurface,
    ),
    border = androidx.compose.foundation.BorderStroke(1.dp, if (active) colorScheme.primary else colorScheme.outline),
  ) {
    Text(
      text = label,
      style = onboardingCaption1Style.copy(fontWeight = FontWeight.Bold),
    )
  }
}

@Composable
private fun QuickFillChip(
  label: String,
  onClick: () -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  TextButton(
    onClick = onClick,
    shape = RoundedCornerShape(28.dp),
    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 7.dp),
    colors = ButtonDefaults.textButtonColors(
      containerColor = colorScheme.primaryContainer,
      contentColor = colorScheme.onPrimaryContainer,
    ),
  ) {
    Text(label, style = onboardingCaption1Style.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun ResolvedEndpoint(endpoint: String) {
  val colorScheme = MaterialTheme.colorScheme
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    HorizontalDivider(color = colorScheme.outlineVariant)
    Text(
      "RESOLVED ENDPOINT",
      style = onboardingCaption2Style.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.7.sp),
      color = colorScheme.onSurfaceVariant,
    )
    Text(
      endpoint,
      style = onboardingCalloutStyle.copy(fontFamily = FontFamily.Monospace),
      color = colorScheme.onSurface,
    )
    HorizontalDivider(color = colorScheme.outlineVariant)
  }
}

@Composable
private fun StepShell(
  title: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
    HorizontalDivider(color = colorScheme.outlineVariant)
    Column(modifier = Modifier.padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text(title, style = onboardingTitle1Style, color = colorScheme.onSurface)
      content()
    }
    HorizontalDivider(color = colorScheme.outlineVariant)
  }
}

@Composable
private fun InlineDivider() {
  val colorScheme = MaterialTheme.colorScheme
  HorizontalDivider(color = colorScheme.outlineVariant)
}

@Composable
private fun PermissionsStep(
  enableDiscovery: Boolean,
  enableNotifications: Boolean,
  enableMicrophone: Boolean,
  enableCamera: Boolean,
  enableSms: Boolean,
  smsAvailable: Boolean,
  context: Context,
  onDiscoveryChange: (Boolean) -> Unit,
  onNotificationsChange: (Boolean) -> Unit,
  onMicrophoneChange: (Boolean) -> Unit,
  onCameraChange: (Boolean) -> Unit,
  onSmsChange: (Boolean) -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  val discoveryPermission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES else Manifest.permission.ACCESS_FINE_LOCATION
  StepShell(title = "Permissions") {
    Text(
      "Enable only what you need now. You can change everything later in Settings.",
      style = onboardingCalloutStyle,
      color = colorScheme.onSurfaceVariant,
    )
    PermissionToggleRow(
      title = "Gateway discovery",
      subtitle = if (Build.VERSION.SDK_INT >= 33) "Nearby devices" else "Location (for NSD)",
      checked = enableDiscovery,
      granted = isPermissionGranted(context, discoveryPermission),
      onCheckedChange = onDiscoveryChange,
    )
    InlineDivider()
    if (Build.VERSION.SDK_INT >= 33) {
      PermissionToggleRow(
        title = "Notifications",
        subtitle = "Foreground service + alerts",
        checked = enableNotifications,
        granted = isPermissionGranted(context, Manifest.permission.POST_NOTIFICATIONS),
        onCheckedChange = onNotificationsChange,
      )
      InlineDivider()
    }
    PermissionToggleRow(
      title = "Microphone",
      subtitle = "Voice tab transcription",
      checked = enableMicrophone,
      granted = isPermissionGranted(context, Manifest.permission.RECORD_AUDIO),
      onCheckedChange = onMicrophoneChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = "Camera",
      subtitle = "camera.snap and camera.clip",
      checked = enableCamera,
      granted = isPermissionGranted(context, Manifest.permission.CAMERA),
      onCheckedChange = onCameraChange,
    )
    if (smsAvailable) {
      InlineDivider()
      PermissionToggleRow(
        title = "SMS",
        subtitle = "Allow gateway-triggered SMS sending",
        checked = enableSms,
        granted = isPermissionGranted(context, Manifest.permission.SEND_SMS),
        onCheckedChange = onSmsChange,
      )
    }
    Text("All settings can be changed later in Settings.", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
  }
}

@Composable
private fun PermissionToggleRow(
  title: String,
  subtitle: String,
  checked: Boolean,
  granted: Boolean,
  onCheckedChange: (Boolean) -> Unit,
) {
  val colorScheme = MaterialTheme.colorScheme
  Row(
    modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(title, style = onboardingHeadlineStyle, color = colorScheme.onSurface)
      Text(subtitle, style = onboardingCalloutStyle.copy(lineHeight = 18.sp), color = colorScheme.onSurfaceVariant)
      Text(
        if (granted) "Granted" else "Not granted",
        style = onboardingCaption1Style,
        color = if (granted) colorScheme.tertiary else colorScheme.onSurfaceVariant,
      )
    }
    Switch(
      checked = checked,
      onCheckedChange = onCheckedChange,
      colors = SwitchDefaults.colors(
        checkedTrackColor = colorScheme.primary,
        uncheckedTrackColor = colorScheme.surfaceContainerHighest,
        checkedThumbColor = colorScheme.onPrimary,
        uncheckedThumbColor = colorScheme.onSurfaceVariant,
      ),
    )
  }
}

@Composable
private fun FinalStep(
  parsedGateway: GatewayEndpointConfig?,
  statusText: String,
  isConnected: Boolean,
  serverName: String?,
  remoteAddress: String?,
  attemptedConnect: Boolean,
  enabledPermissions: String,
  methodLabel: String,
) {
  val colorScheme = MaterialTheme.colorScheme
  StepShell(title = "Review") {
    SummaryField(label = "Method", value = methodLabel)
    SummaryField(label = "Gateway", value = parsedGateway?.displayUrl ?: "Invalid gateway URL")
    SummaryField(label = "Enabled Permissions", value = enabledPermissions)

    if (!attemptedConnect) {
      Text("Press Connect to verify gateway reachability and auth.", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
    } else {
      Text("Status: $statusText", style = onboardingCalloutStyle, color = if (isConnected) colorScheme.tertiary else colorScheme.onSurfaceVariant)
      if (isConnected) {
        Text("Connected to ${serverName ?: remoteAddress ?: "gateway"}", style = onboardingCalloutStyle, color = colorScheme.tertiary)
      } else {
        GuideBlock(title = "Pairing Required") {
          Text("Run these on the gateway host:", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
          CommandBlock("openclaw nodes pending")
          CommandBlock("openclaw nodes approve <requestId>")
          Text("Then tap Connect again.", style = onboardingCalloutStyle, color = colorScheme.onSurfaceVariant)
        }
      }
    }
  }
}

@Composable
private fun SummaryField(label: String, value: String) {
  val colorScheme = MaterialTheme.colorScheme
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(
      label,
      style = onboardingCaption2Style.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp),
      color = colorScheme.onSurfaceVariant,
    )
    Text(value, style = onboardingHeadlineStyle, color = colorScheme.onSurface)
    HorizontalDivider(color = colorScheme.outlineVariant)
  }
}

@Composable
private fun CommandBlock(command: String) {
  val colorScheme = MaterialTheme.colorScheme
  Row(
    modifier =
      Modifier
        .fillMaxWidth()
        .background(colorScheme.surfaceContainerHighest, RoundedCornerShape(12.dp))
        .border(width = 1.dp, color = colorScheme.outlineVariant, shape = RoundedCornerShape(12.dp)),
  ) {
    Box(modifier = Modifier.width(3.dp).height(42.dp).background(colorScheme.tertiary))
    Text(
      command,
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      style = onboardingCalloutStyle,
      fontFamily = FontFamily.Monospace,
      color = colorScheme.onSurface,
    )
  }
}

@Composable
private fun Bullet(text: String) {
  val colorScheme = MaterialTheme.colorScheme
  Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
    Box(
      modifier =
        Modifier
          .padding(top = 7.dp)
          .size(8.dp)
          .background(colorScheme.primaryContainer, CircleShape),
    )
    Box(
      modifier =
        Modifier
          .padding(top = 9.dp)
          .size(4.dp)
          .background(colorScheme.primary, CircleShape),
    )
    Text(text, style = onboardingBodyStyle, color = colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
  }
}

private fun isPermissionGranted(context: Context, permission: String): Boolean {
  return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}
