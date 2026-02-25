package ai.openclaw.android.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import ai.openclaw.android.SecurePrefsThemeMode

private val LightColorScheme = lightColorScheme(
  primary = Color(0xFF006A67),
  onPrimary = Color.White,
  primaryContainer = Color(0xFF6FF7F1),
  onPrimaryContainer = Color(0xFF00201F),
  secondary = Color(0xFF4A6362),
  onSecondary = Color.White,
  secondaryContainer = Color(0xFFCCE8E6),
  onSecondaryContainer = Color(0xFF051F1F),
  tertiary = Color(0xFF4B607C),
  onTertiary = Color.White,
  tertiaryContainer = Color(0xFFD3E4FF),
  onTertiaryContainer = Color(0xFF041C35),
  error = Color(0xFFBA1A1A),
  onError = Color.White,
  errorContainer = Color(0xFFFFDAD6),
  onErrorContainer = Color(0xFF410002),
  background = Color(0xFFFAFDFC),
  onBackground = Color(0xFF191C1C),
  surface = Color(0xFFFAFDFC),
  onSurface = Color(0xFF191C1C),
  surfaceVariant = Color(0xFFDAE5E3),
  onSurfaceVariant = Color(0xFF3F4948),
  outline = Color(0xFF6F7978),
  outlineVariant = Color(0xFFBEC9C7),
  inverseSurface = Color(0xFF2D3131),
  inverseOnSurface = Color(0xFFEFF1F0),
  inversePrimary = Color(0xFF4DDAD5),
  surfaceContainerLowest = Color.White,
  surfaceContainerLow = Color(0xFFF4F7F6),
  surfaceContainer = Color(0xFFEFF2F1),
  surfaceContainerHigh = Color(0xFFE9ECEB),
  surfaceContainerHighest = Color(0xFFE3E7E6),
)

private val DarkColorScheme = darkColorScheme(
  primary = Color(0xFF4DDAD5),
  onPrimary = Color(0xFF003735),
  primaryContainer = Color(0xFF00504D),
  onPrimaryContainer = Color(0xFF6FF7F1),
  secondary = Color(0xFFB0CCCA),
  onSecondary = Color(0xFF1B3534),
  secondaryContainer = Color(0xFF324B4A),
  onSecondaryContainer = Color(0xFFCCE8E6),
  tertiary = Color(0xFFB3C8E8),
  onTertiary = Color(0xFF1C314B),
  tertiaryContainer = Color(0xFF334863),
  onTertiaryContainer = Color(0xFFD3E4FF),
  error = Color(0xFFFFB4AB),
  onError = Color(0xFF690005),
  errorContainer = Color(0xFF93000A),
  onErrorContainer = Color(0xFFFFDAD6),
  background = Color(0xFF191C1C),
  onBackground = Color(0xFFE0E3E2),
  surface = Color(0xFF191C1C),
  onSurface = Color(0xFFE0E3E2),
  surfaceVariant = Color(0xFF3F4948),
  onSurfaceVariant = Color(0xFFBEC9C7),
  outline = Color(0xFF899392),
  outlineVariant = Color(0xFF3F4948),
  inverseSurface = Color(0xFFE0E3E2),
  inverseOnSurface = Color(0xFF2D3131),
  inversePrimary = Color(0xFF006A67),
  surfaceContainerLowest = Color(0xFF0F1413),
  surfaceContainerLow = Color(0xFF191C1C),
  surfaceContainer = Color(0xFF1D2020),
  surfaceContainerHigh = Color(0xFF272B2B),
  surfaceContainerHighest = Color(0xFF323535),
)

@Composable
fun OpenClawTheme(
  themeMode: SecurePrefsThemeMode = SecurePrefsThemeMode.System,
  dynamicColor: Boolean = true,
  content: @Composable () -> Unit,
) {
  val context = LocalContext.current
  val systemDarkTheme = isSystemInDarkTheme()
  val darkTheme = when (themeMode) {
    SecurePrefsThemeMode.System -> systemDarkTheme
    SecurePrefsThemeMode.Light -> false
    SecurePrefsThemeMode.Dark -> true
  }
  val colorScheme = when {
    dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
      if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    }
    darkTheme -> DarkColorScheme
    else -> LightColorScheme
  }

  MaterialTheme(colorScheme = colorScheme, content = content)
}

@Composable
fun overlayContainerColor(): Color {
  val scheme = MaterialTheme.colorScheme
  return if (isSystemInDarkTheme()) {
    scheme.surfaceContainerLow.copy(alpha = 0.92f)
  } else {
    scheme.surfaceContainerHigh.copy(alpha = 0.88f)
  }
}

@Composable
fun overlayIconColor(): Color {
  return MaterialTheme.colorScheme.onSurfaceVariant
}
