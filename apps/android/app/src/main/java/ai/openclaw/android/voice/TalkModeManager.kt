package ai.openclaw.android.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.content.ContextCompat
import ai.openclaw.android.gateway.GatewaySession
import ai.openclaw.android.normalizeMainKey
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.ArrayList
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlin.math.max

class TalkModeManager(
  private val context: Context,
  private val scope: CoroutineScope,
  private val session: GatewaySession,
  private val supportsChatSubscribe: Boolean,
  private val isConnected: () -> Boolean,
) {
  companion object {
    private const val tag = "TalkMode"
    private const val defaultModelIdFallback = "eleven_v3"
    private const val defaultOutputFormatFallback = "pcm_24000"
    private const val defaultTalkSessionKey = "agent:voice:main"
    private val defaultRecognitionLanguages = listOf("en-US", "fr-FR")
    private const val stickyLanguageVoteThreshold = 2
    private const val stickyLanguagePersistTtlMs = 10 * 60 * 1000L
    private const val languageDetectionClientCooldownMs = 8_000L
    private const val languageDetectionUnavailableCooldownMs = 30_000L
    private const val autoLanguageConfidenceThreshold = 0.45
    private const val autoLanguageConfidenceLockThreshold = 0.95
    private const val stickyLanguagePrefsName = "talk_mode_state"
    private const val stickyLanguageTagKey = "sticky_language_tag"
    private const val stickyLanguageCodeKey = "sticky_language_code"
    private const val stickyLanguageLockedAtKey = "sticky_language_locked_at_ms"
    private val frenchAccentRegex = Regex("[àâçéèêëîïôûùüÿœæ]", RegexOption.IGNORE_CASE)
    private val frenchMarkers =
      setOf(
        "bonjour",
        "salut",
        "merci",
        "francais",
        "français",
        "avec",
        "pour",
        "vous",
        "nous",
        "comment",
        "pourquoi",
        "aujourd",
        "demain",
      )
    private val englishMarkers =
      setOf(
        "hello",
        "thanks",
        "please",
        "with",
        "for",
        "what",
        "why",
        "today",
        "tomorrow",
      )
    private val switchToFrenchRegexes =
      listOf(
        Regex("\\bspeak\\s+french\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(parle|parlez|réponds|reponds)\\s+(en\\s+)?fran[cç]ais\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(switch|change|set|continue|reply|respond|talk)\\s+(to\\s+|in\\s+)?french\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(french\\s+mode|mode\\s+fran[cç]ais)\\b", RegexOption.IGNORE_CASE),
      )
    private val switchToEnglishRegexes =
      listOf(
        Regex("\\bspeak\\s+english\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(parle|parlez|réponds|reponds)\\s+(en\\s+)?anglais\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(switch|change|set|continue|reply|respond|talk)\\s+(to\\s+|in\\s+)?english\\b", RegexOption.IGNORE_CASE),
        Regex("\\b(english\\s+mode|mode\\s+anglais)\\b", RegexOption.IGNORE_CASE),
      )
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val json = Json { ignoreUnknownKeys = true }

  private val _isEnabled = MutableStateFlow(false)
  val isEnabled: StateFlow<Boolean> = _isEnabled

  private val _isListening = MutableStateFlow(false)
  val isListening: StateFlow<Boolean> = _isListening

  private val _isSpeaking = MutableStateFlow(false)
  val isSpeaking: StateFlow<Boolean> = _isSpeaking

  private val _statusText = MutableStateFlow("Off")
  val statusText: StateFlow<String> = _statusText

  private val _lastAssistantText = MutableStateFlow<String?>(null)
  val lastAssistantText: StateFlow<String?> = _lastAssistantText

  private val _usingFallbackTts = MutableStateFlow(false)
  val usingFallbackTts: StateFlow<Boolean> = _usingFallbackTts

  private var recognizer: SpeechRecognizer? = null
  private var restartJob: Job? = null
  private var stopRequested = false
  private var listeningMode = false

  private var silenceJob: Job? = null
  private val silenceWindowMs = 700L
  private val assistantStabilizeWindowMs = 600L
  private var lastTranscript: String = ""
  private var lastHeardAtMs: Long? = null
  private var lastSpokenText: String? = null
  private var lastSpeechStartedAtMs: Long = 0L
  private var lastInterruptedAtSeconds: Double? = null
  private val interruptMinDelayMs = 900L
  private val interruptMinCharsPartial = 14

  private var defaultVoiceId: String? = null
  private var currentVoiceId: String? = null
  private var fallbackVoiceId: String? = null
  private var defaultModelId: String? = null
  private var currentModelId: String? = null
  private var defaultOutputFormat: String? = null
  private var apiKey: String? = null
  private var apiBaseUrl: String? = null
  private var recognitionLanguage: String? = null
  private var recognitionLanguages: List<String> = emptyList()
  private var recognitionLanguageExtrasEnabled = true
  private var stickyLanguageTag: String = "en-US"
  private var stickyLanguageCode: String = "en"
  private var stickyLanguageLocked = false
  private var stickyFrenchVotes = 0
  private var stickyEnglishVotes = 0
  private var stickyFrenchConfidence = 0.0
  private var stickyEnglishConfidence = 0.0
  private var languageDetectionExtrasSuspendedUntilMs = 0L
  private var recognizerClientErrorStreak = 0
  private var lastRecognizerEventAtMs = 0L
  private val recognizerStallTimeoutMs = 12_000L
  private var voiceAliases: Map<String, String> = emptyMap()
  private var interruptOnSpeech: Boolean = true
  private var voiceOverrideActive = false
  private var modelOverrideActive = false
  private var mainSessionKey: String = defaultTalkSessionKey
  private var pinnedTalkSessionKey: String? = defaultTalkSessionKey

  private var pendingRunId: String? = null
  private var pendingFinal: CompletableDeferred<Boolean>? = null
  private var chatSubscribedSessionKey: String? = null
  private val finalizeStateLock = Any()
  private var finalizeInFlight = false
  private var lastAssistantFingerprint: String? = null
  private var lastAssistantSpokenAtMs = 0L
  private val assistantDedupWindowMs = 8_000L

  private var player: MediaPlayer? = null
  private var streamingSource: StreamingMediaDataSource? = null
  private var pcmTrack: AudioTrack? = null
  @Volatile private var pcmStopRequested = false
  private var systemTts: TextToSpeech? = null
  private var systemTtsPending: CompletableDeferred<Unit>? = null
  private var systemTtsPendingId: String? = null

  fun setMainSessionKey(sessionKey: String?) {
    val trimmed = sessionKey?.trim().orEmpty()
    if (trimmed.isEmpty()) return
    if (!pinnedTalkSessionKey.isNullOrBlank()) return
    mainSessionKey = trimmed
  }

  fun setEnabled(enabled: Boolean) {
    if (_isEnabled.value == enabled) return
    _isEnabled.value = enabled
    if (enabled) {
      recognitionLanguageExtrasEnabled = true
      recognizerClientErrorStreak = 0
      languageDetectionExtrasSuspendedUntilMs = 0L
      lastRecognizerEventAtMs = 0L
      restoreStickyLanguageStateIfFresh()
      logLanguageState("enabled")
      start()
    } else {
      Log.d(tag, "disabled")
      stop()
    }
  }

  fun handleGatewayEvent(event: String, payloadJson: String?) {
    if (event != "chat") return
    if (payloadJson.isNullOrBlank()) return
    val pending = pendingRunId ?: return
    val obj =
      try {
        json.parseToJsonElement(payloadJson).asObjectOrNull()
      } catch (_: Throwable) {
        null
      } ?: return
    val runId = obj["runId"].asStringOrNull() ?: return
    if (runId != pending) return
    val state = obj["state"].asStringOrNull() ?: return
    if (state == "final") {
      pendingFinal?.complete(true)
      pendingFinal = null
      pendingRunId = null
    }
  }

  private fun start() {
    mainHandler.post {
      if (_isListening.value) return@post
      stopRequested = false
      listeningMode = true
      Log.d(tag, "start")

      if (!SpeechRecognizer.isRecognitionAvailable(context)) {
        _statusText.value = "Speech recognizer unavailable"
        Log.w(tag, "speech recognizer unavailable")
        return@post
      }

      val micOk =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
          PackageManager.PERMISSION_GRANTED
      if (!micOk) {
        _statusText.value = "Microphone permission required"
        Log.w(tag, "microphone permission required")
        return@post
      }

      try {
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(listener) }
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
        startListeningInternal(markListening = true)
        startSilenceMonitor()
        Log.d(tag, "listening")
      } catch (err: Throwable) {
        _statusText.value = "Start failed: ${err.message ?: err::class.simpleName}"
        Log.w(tag, "start failed: ${err.message ?: err::class.simpleName}")
      }
    }
  }

  private fun stop() {
    stopRequested = true
    listeningMode = false
    synchronized(finalizeStateLock) {
      finalizeInFlight = false
    }
    restartJob?.cancel()
    restartJob = null
    silenceJob?.cancel()
    silenceJob = null
    lastTranscript = ""
    lastHeardAtMs = null
    _isListening.value = false
    _statusText.value = "Off"
    stopSpeaking()
    _usingFallbackTts.value = false
    chatSubscribedSessionKey = null

    mainHandler.post {
      recognizer?.cancel()
      recognizer?.destroy()
      recognizer = null
    }
    systemTts?.stop()
    systemTtsPending?.cancel()
    systemTtsPending = null
    systemTtsPendingId = null
    if (stickyLanguageLocked) {
      saveStickyLanguageState()
    }
    stickyLanguageLocked = false
    stickyFrenchVotes = 0
    stickyEnglishVotes = 0
    stickyFrenchConfidence = 0.0
    stickyEnglishConfidence = 0.0
  }

  private fun startListeningInternal(markListening: Boolean) {
    val r = recognizer ?: return
    maybeRestoreLanguageDetectionExtras()
    val useLanguageDetectionExtras = !stickyLanguageLocked && recognitionLanguageExtrasEnabled && recognitionLanguages.isNotEmpty()
    val recognizerLanguage =
      if (stickyLanguageLocked) {
        stickyLanguageTag
      } else {
        resolvedRecognizerLanguage(useLanguageDetectionExtras)
      }
    val intent =
      Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)

        recognizerLanguage?.let { languageTag ->
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag)
        }

        if (useLanguageDetectionExtras) {
          putExtra("android.speech.extra.ENABLE_LANGUAGE_DETECTION", true)
          putStringArrayListExtra(
            "android.speech.extra.LANGUAGE_DETECTION_ALLOWED_LANGUAGES",
            ArrayList(recognitionLanguages),
          )
          putExtra("android.speech.extra.ENABLE_LANGUAGE_SWITCH", true)
          putStringArrayListExtra(
            "android.speech.extra.LANGUAGE_SWITCH_ALLOWED_LANGUAGES",
            ArrayList(recognitionLanguages),
          )
        }
      }

    Log.d(
      tag,
      "startListening: lang=${recognizerLanguage ?: "auto"} detectExtras=$useLanguageDetectionExtras locked=$stickyLanguageLocked sticky=$stickyLanguageTag langs=${recognitionLanguages.joinToString(",")}",
    )
    if (markListening) {
      _statusText.value = "Listening"
      _isListening.value = true
    }
    try {
      r.startListening(intent)
      lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
    } catch (err: Throwable) {
      if (markListening) {
        _isListening.value = false
      }
      throw err
    }
  }

  private fun resolvedRecognizerLanguage(useLanguageDetectionExtras: Boolean): String? {
    recognitionLanguage?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    if (useLanguageDetectionExtras) return null
    if (recognitionLanguages.isEmpty()) return null

    val localeTag = Locale.getDefault().toLanguageTag().lowercase()
    val localeLang = Locale.getDefault().language.lowercase()
    val exact = recognitionLanguages.firstOrNull { it.lowercase() == localeTag }
    if (exact != null) return exact
    val prefix = recognitionLanguages.firstOrNull { it.lowercase().startsWith("$localeLang-") }
    if (prefix != null) return prefix
    return recognitionLanguages.firstOrNull()
  }

  private fun languageDetectionSuspendedRemainingMs(): Long {
    val now = SystemClock.elapsedRealtime()
    return if (languageDetectionExtrasSuspendedUntilMs > now) {
      languageDetectionExtrasSuspendedUntilMs - now
    } else {
      0L
    }
  }

  private fun maybeRestoreLanguageDetectionExtras() {
    if (recognitionLanguageExtrasEnabled) return
    if (recognitionLanguages.isEmpty()) return
    if (languageDetectionSuspendedRemainingMs() > 0L) return
    recognitionLanguageExtrasEnabled = true
    recognizerClientErrorStreak = 0
    languageDetectionExtrasSuspendedUntilMs = 0L
    logLanguageState("language_detection_reenabled")
  }

  private fun suspendLanguageDetectionExtras(reason: String, cooldownMs: Long) {
    recognitionLanguageExtrasEnabled = false
    languageDetectionExtrasSuspendedUntilMs =
      max(languageDetectionExtrasSuspendedUntilMs, SystemClock.elapsedRealtime() + cooldownMs)
    logLanguageState("language_detection_suspended", "reason=$reason cooldownMs=$cooldownMs")
  }

  private fun logLanguageState(event: String, detail: String? = null) {
    val remaining = languageDetectionSuspendedRemainingMs()
    val suffix = detail?.takeIf { it.isNotBlank() }?.let { " $it" } ?: ""
    Log.d(
      tag,
      "lang_state event=$event code=$stickyLanguageCode tag=$stickyLanguageTag locked=$stickyLanguageLocked frVotes=$stickyFrenchVotes enVotes=$stickyEnglishVotes frConf=${String.format(Locale.US, "%.2f", stickyFrenchConfidence)} enConf=${String.format(Locale.US, "%.2f", stickyEnglishConfidence)} detectExtras=$recognitionLanguageExtrasEnabled detectCooldownMs=$remaining$suffix",
    )
  }

  private fun scheduleRestart(delayMs: Long = 350) {
    if (stopRequested) return
    restartJob?.cancel()
    restartJob =
      scope.launch {
        delay(delayMs)
        mainHandler.post {
          if (stopRequested) return@post
          try {
            recognizer?.cancel()
            val shouldListen = listeningMode
            val shouldInterrupt = _isSpeaking.value && interruptOnSpeech
            if (!shouldListen && !shouldInterrupt) return@post
            startListeningInternal(markListening = shouldListen)
          } catch (err: Throwable) {
            Log.w(tag, "restart failed: ${err.message ?: err::class.simpleName}")
            _isListening.value = false
            recreateRecognizer("restart_failure")
            if (!stopRequested) {
              scheduleRestart(delayMs = 900)
            }
          }
        }
      }
  }

  private fun handleTranscript(text: String, isFinal: Boolean) {
    val trimmed = text.trim()
    if (_isSpeaking.value && interruptOnSpeech) {
      if (shouldInterrupt(trimmed, isFinal = isFinal)) {
        Log.d(tag, "speech interrupt accepted: final=$isFinal text=${trimmed.take(64)}")
        stopSpeaking()
      }
      return
    }

    if (!_isListening.value) return

    if (trimmed.isNotEmpty()) {
      updateStickyLanguageFromTranscript(trimmed, isFinal = isFinal)
      lastTranscript = trimmed
      lastHeardAtMs = SystemClock.elapsedRealtime()
    }

    if (isFinal) {
      lastTranscript = trimmed
    }
  }

  private fun startSilenceMonitor() {
    silenceJob?.cancel()
    silenceJob =
      scope.launch {
        while (_isEnabled.value) {
          delay(200)
          checkSilence()
        }
      }
  }

  private fun checkSilence() {
    if (!_isListening.value) return
    val now = SystemClock.elapsedRealtime()
    if (!_isSpeaking.value && lastRecognizerEventAtMs > 0) {
      val idleMs = now - lastRecognizerEventAtMs
      if (idleMs >= recognizerStallTimeoutMs) {
        Log.w(tag, "recognizer stall detected idleMs=$idleMs; forcing restart")
        lastRecognizerEventAtMs = now
        _statusText.value = "Listening restart…"
        recreateRecognizer("stall_watchdog")
        scheduleRestart(delayMs = 300)
        return
      }
    }
    val transcript = lastTranscript.trim()
    if (transcript.isEmpty()) return
    val lastHeard = lastHeardAtMs ?: return
    val elapsed = now - lastHeard
    if (elapsed < silenceWindowMs) return
    if (!beginFinalizeIfIdle()) return
    scope.launch {
      try {
        finalizeTranscript(transcript)
      } finally {
        endFinalize()
      }
    }
  }

  private fun beginFinalizeIfIdle(): Boolean =
    synchronized(finalizeStateLock) {
      if (finalizeInFlight) return@synchronized false
      finalizeInFlight = true
      true
    }

  private fun endFinalize() {
    synchronized(finalizeStateLock) {
      finalizeInFlight = false
    }
  }

  private suspend fun finalizeTranscript(transcript: String) {
    listeningMode = false
    _isListening.value = false
    _statusText.value = "Thinking…"
    lastTranscript = ""
    lastHeardAtMs = null

    reloadConfig()
    val prompt = buildPrompt(transcript)
    if (!isConnected()) {
      _statusText.value = "Gateway not connected"
      Log.w(tag, "finalize: gateway not connected")
      start()
      return
    }

    try {
      val startedAt = System.currentTimeMillis().toDouble() / 1000.0
      subscribeChatIfNeeded(session = session, sessionKey = mainSessionKey)
      Log.d(tag, "chat.send start sessionKey=${mainSessionKey.ifBlank { "main" }} chars=${prompt.length}")
      val runId = sendChat(prompt, session)
      Log.d(tag, "chat.send ok runId=$runId")
      val ok = waitForChatFinal(runId)
      if (!ok) {
        Log.w(tag, "chat final timeout runId=$runId; attempting history fallback")
      }
      val assistant = waitForAssistantText(session, startedAt, if (ok) 12_000 else 25_000)
      if (assistant.isNullOrBlank()) {
        _statusText.value = "No reply"
        Log.w(tag, "assistant text timeout runId=$runId")
        start()
        return
      }
      Log.d(tag, "assistant text ok chars=${assistant.length}")
      playAssistant(assistant)
    } catch (err: Throwable) {
      _statusText.value = "Talk failed: ${err.message ?: err::class.simpleName}"
      Log.w(tag, "finalize failed: ${err.message ?: err::class.simpleName}")
    }

    if (_isEnabled.value) {
      start()
    }
  }

  private suspend fun subscribeChatIfNeeded(session: GatewaySession, sessionKey: String) {
    if (!supportsChatSubscribe) return
    val key = sessionKey.trim()
    if (key.isEmpty()) return
    if (chatSubscribedSessionKey == key) return
    try {
      session.sendNodeEvent("chat.subscribe", """{"sessionKey":"$key"}""")
      chatSubscribedSessionKey = key
      Log.d(tag, "chat.subscribe ok sessionKey=$key")
    } catch (err: Throwable) {
      Log.w(tag, "chat.subscribe failed sessionKey=$key err=${err.message ?: err::class.java.simpleName}")
    }
  }

  private fun buildPrompt(transcript: String): String {
    val lines = mutableListOf(
      "Talk Mode active. Reply in a concise, spoken tone.",
      "Return plain text only. Do not call tools, including any TTS/audio tools.",
      "Do not emit JSON, metadata, or voice directives unless explicitly requested by the user.",
    )
    if (stickyLanguageLocked && stickyLanguageCode == "fr") {
      lines.add("System Note: The user is in French mode. Respond only in French unless explicitly asked to switch language.")
    } else if (stickyLanguageLocked && stickyLanguageCode == "en") {
      lines.add("System Note: The user is in English mode. Respond only in English unless explicitly asked to switch language.")
    }
    lastInterruptedAtSeconds?.let {
      lines.add("Assistant speech interrupted at ${"%.1f".format(it)}s.")
      lastInterruptedAtSeconds = null
    }
    lines.add("")
    lines.add(transcript)
    return lines.joinToString("\n")
  }

  private suspend fun sendChat(message: String, session: GatewaySession): String {
    val runId = UUID.randomUUID().toString()
    val params =
      buildJsonObject {
        put("sessionKey", JsonPrimitive(mainSessionKey.ifBlank { "main" }))
        put("message", JsonPrimitive(message))
        put("thinking", JsonPrimitive("off"))
        put("timeoutMs", JsonPrimitive(30_000))
        put("idempotencyKey", JsonPrimitive(runId))
      }
    val res = session.request("chat.send", params.toString())
    val parsed = parseRunId(res) ?: runId
    if (parsed != runId) {
      pendingRunId = parsed
    }
    return parsed
  }

  private suspend fun waitForChatFinal(runId: String): Boolean {
    pendingFinal?.cancel()
    val deferred = CompletableDeferred<Boolean>()
    pendingRunId = runId
    pendingFinal = deferred

    val result =
      withContext(Dispatchers.IO) {
        try {
          kotlinx.coroutines.withTimeout(120_000) { deferred.await() }
        } catch (_: Throwable) {
          false
        }
      }

    if (!result) {
      pendingFinal = null
      pendingRunId = null
    }
    return result
  }

  private suspend fun waitForAssistantText(
    session: GatewaySession,
    sinceSeconds: Double,
    timeoutMs: Long,
  ): String? {
    val deadline = SystemClock.elapsedRealtime() + timeoutMs
    while (SystemClock.elapsedRealtime() < deadline) {
      val text = fetchLatestAssistantText(session, sinceSeconds)
      if (!text.isNullOrBlank()) return text
      delay(300)
    }
    // Fallback for device/server clock skew or odd timestamp formatting.
    return fetchLatestAssistantText(session, sinceSeconds = null)
  }

  private suspend fun fetchLatestAssistantText(
    session: GatewaySession,
    sinceSeconds: Double? = null,
  ): String? {
    val key = mainSessionKey.ifBlank { "main" }
    val res = session.request("chat.history", "{\"sessionKey\":\"$key\"}")
    val root = json.parseToJsonElement(res).asObjectOrNull() ?: return null
    val messages = root["messages"] as? JsonArray ?: return null
    for (item in messages.reversed()) {
      val obj = item.asObjectOrNull() ?: continue
      if (obj["role"].asStringOrNull() != "assistant") continue
      if (sinceSeconds != null) {
        val timestamp = obj["timestamp"].asDoubleOrNull()
        if (timestamp != null && !TalkModeRuntime.isMessageTimestampAfter(timestamp, sinceSeconds)) continue
      }
      val content = obj["content"] as? JsonArray ?: continue
      val text =
        content.mapNotNull { entry ->
          entry.asObjectOrNull()?.get("text")?.asStringOrNull()?.trim()
        }.filter { it.isNotEmpty() }
      if (text.isNotEmpty()) return text.joinToString("\n")
    }
    return null
  }

  private suspend fun playAssistant(text: String) {
    val parsed = TalkDirectiveParser.parse(text)
    if (parsed.unknownKeys.isNotEmpty()) {
      Log.w(tag, "Unknown talk directive keys: ${parsed.unknownKeys}")
    }
    val directive = parsed.directive
    val cleaned = sanitizeSpokenText(parsed.stripped.trim())
    if (cleaned.isEmpty()) return
    val stickyVoice = if (stickyLanguageLocked) preferredVoiceForLanguageCode(stickyLanguageCode) else null
    val now = SystemClock.elapsedRealtime()
    val fingerprint = cleaned.lowercase(Locale.ROOT).replace(Regex("\\s+"), " ").trim()
    lastAssistantFingerprint = fingerprint
    lastAssistantSpokenAtMs = now
    _lastAssistantText.value = cleaned

    val requestedVoice = if (stickyVoice != null) null else directive?.voiceId?.trim()?.takeIf { it.isNotEmpty() }
    val resolvedVoice = resolveVoiceAlias(requestedVoice)
    if (requestedVoice != null && resolvedVoice == null) {
      Log.w(tag, "unknown voice alias: $requestedVoice")
    }

    if (directive?.voiceId != null && stickyVoice == null) {
      if (directive.once != true) {
        currentVoiceId = resolvedVoice
        voiceOverrideActive = true
      }
    }
    if (directive?.modelId != null) {
      if (directive.once != true) {
        currentModelId = directive.modelId
        modelOverrideActive = true
      }
    }

    val apiKey =
      apiKey?.trim()?.takeIf { it.isNotEmpty() }
        ?: System.getenv("ELEVENLABS_API_KEY")?.trim()
    val preferredVoice =
      stickyVoice
        ?: resolvedVoice
        ?: if (!voiceOverrideActive) preferredVoiceForLanguageCode(stickyLanguageCode) else null
        ?: currentVoiceId
        ?: defaultVoiceId
    val voiceId =
      if (!apiKey.isNullOrEmpty()) {
        resolveVoiceId(preferredVoice, apiKey)
      } else {
        null
      }

    _statusText.value = "Speaking…"
    _isSpeaking.value = true
    lastSpeechStartedAtMs = SystemClock.elapsedRealtime()
    lastSpokenText = cleaned
    ensureInterruptListener()

    try {
      val canUseElevenLabs = !voiceId.isNullOrBlank() && !apiKey.isNullOrEmpty()
      if (!canUseElevenLabs) {
        if (voiceId.isNullOrBlank()) {
          Log.w(tag, "missing voiceId; falling back to system voice")
        }
        if (apiKey.isNullOrEmpty()) {
          Log.w(tag, "missing ELEVENLABS_API_KEY; falling back to system voice")
        }
        _usingFallbackTts.value = true
        _statusText.value = "Speaking (System)…"
        speakWithSystemTts(cleaned)
      } else {
        _usingFallbackTts.value = false
        val ttsStarted = SystemClock.elapsedRealtime()
        val modelId = directive?.modelId ?: currentModelId ?: defaultModelId
        val request =
          ElevenLabsRequest(
            text = cleaned,
            modelId = modelId,
            outputFormat =
              TalkModeRuntime.validatedOutputFormat(directive?.outputFormat ?: defaultOutputFormat),
            speed = TalkModeRuntime.resolveSpeed(directive?.speed, directive?.rateWpm),
            stability = TalkModeRuntime.validatedStability(directive?.stability, modelId),
            similarity = TalkModeRuntime.validatedUnit(directive?.similarity),
            style = TalkModeRuntime.validatedUnit(directive?.style),
            speakerBoost = directive?.speakerBoost,
            seed = TalkModeRuntime.validatedSeed(directive?.seed),
            normalize = TalkModeRuntime.validatedNormalize(directive?.normalize),
            language =
              if (stickyLanguageLocked) {
                stickyLanguageCode
              } else {
                TalkModeRuntime.validatedLanguage(directive?.language ?: stickyLanguageCode)
              },
            latencyTier = TalkModeRuntime.validatedLatencyTier(directive?.latencyTier),
          )
        streamAndPlay(voiceId = voiceId!!, apiKey = apiKey!!, request = request)
        Log.d(tag, "elevenlabs stream ok durMs=${SystemClock.elapsedRealtime() - ttsStarted}")
      }
    } catch (err: Throwable) {
      Log.w(tag, "speak failed: ${err.message ?: err::class.simpleName}; falling back to system voice")
      try {
        _usingFallbackTts.value = true
        _statusText.value = "Speaking (System)…"
        speakWithSystemTts(cleaned)
      } catch (fallbackErr: Throwable) {
        _statusText.value = "Speak failed: ${fallbackErr.message ?: fallbackErr::class.simpleName}"
        Log.w(tag, "system voice failed: ${fallbackErr.message ?: fallbackErr::class.simpleName}")
      }
    }

    _isSpeaking.value = false
  }

  private suspend fun streamAndPlay(voiceId: String, apiKey: String, request: ElevenLabsRequest) {
    stopSpeaking(resetInterrupt = false)

    pcmStopRequested = false
    val pcmSampleRate = TalkModeRuntime.parsePcmSampleRate(request.outputFormat)
    if (pcmSampleRate != null) {
      try {
        streamAndPlayPcm(voiceId = voiceId, apiKey = apiKey, request = request, sampleRate = pcmSampleRate)
        return
      } catch (err: Throwable) {
        if (pcmStopRequested) return
        Log.w(tag, "pcm playback failed; falling back to mp3: ${err.message ?: err::class.simpleName}")
      }
    }

    streamAndPlayMp3(voiceId = voiceId, apiKey = apiKey, request = request)
  }

  private suspend fun streamAndPlayMp3(voiceId: String, apiKey: String, request: ElevenLabsRequest) {
    val dataSource = StreamingMediaDataSource()
    streamingSource = dataSource

    val player = MediaPlayer()
    this.player = player

    val prepared = CompletableDeferred<Unit>()
    val finished = CompletableDeferred<Unit>()

    player.setAudioAttributes(
      AudioAttributes.Builder()
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .build(),
    )
    player.setOnPreparedListener {
      it.start()
      prepared.complete(Unit)
    }
    player.setOnCompletionListener {
      finished.complete(Unit)
    }
    player.setOnErrorListener { _, _, _ ->
      finished.completeExceptionally(IllegalStateException("MediaPlayer error"))
      true
    }

    player.setDataSource(dataSource)
    withContext(Dispatchers.Main) {
      player.prepareAsync()
    }

    val fetchError = CompletableDeferred<Throwable?>()
    val fetchJob =
      scope.launch(Dispatchers.IO) {
        try {
          streamTts(voiceId = voiceId, apiKey = apiKey, request = request, sink = dataSource)
          fetchError.complete(null)
        } catch (err: Throwable) {
          dataSource.fail()
          fetchError.complete(err)
        }
      }

    Log.d(tag, "play start")
    try {
      prepared.await()
      finished.await()
      fetchError.await()?.let { throw it }
    } finally {
      fetchJob.cancel()
      cleanupPlayer()
    }
    Log.d(tag, "play done")
  }

  private suspend fun streamAndPlayPcm(
    voiceId: String,
    apiKey: String,
    request: ElevenLabsRequest,
    sampleRate: Int,
  ) {
    val minBuffer =
      AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
    if (minBuffer <= 0) {
      throw IllegalStateException("AudioTrack buffer size invalid: $minBuffer")
    }

    val bufferSize = max(minBuffer * 2, 8 * 1024)
    val track =
      AudioTrack(
        AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .setUsage(AudioAttributes.USAGE_ASSISTANT)
          .build(),
        AudioFormat.Builder()
          .setSampleRate(sampleRate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .build(),
        bufferSize,
        AudioTrack.MODE_STREAM,
        AudioManager.AUDIO_SESSION_ID_GENERATE,
      )
    if (track.state != AudioTrack.STATE_INITIALIZED) {
      track.release()
      throw IllegalStateException("AudioTrack init failed")
    }
    pcmTrack = track
    track.play()

    Log.d(tag, "pcm play start sampleRate=$sampleRate bufferSize=$bufferSize")
    try {
      streamPcm(voiceId = voiceId, apiKey = apiKey, request = request, track = track)
    } finally {
      cleanupPcmTrack()
    }
    Log.d(tag, "pcm play done")
  }

  private suspend fun speakWithSystemTts(text: String) {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return
    val ok = ensureSystemTts()
    if (!ok) {
      throw IllegalStateException("system TTS unavailable")
    }

    val tts = systemTts ?: throw IllegalStateException("system TTS unavailable")
    val utteranceId = "talk-${UUID.randomUUID()}"
    val deferred = CompletableDeferred<Unit>()
    systemTtsPending?.cancel()
    systemTtsPending = deferred
    systemTtsPendingId = utteranceId

    withContext(Dispatchers.Main) {
      val params = Bundle()
      tts.speak(trimmed, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
    }

    withContext(Dispatchers.IO) {
      try {
        kotlinx.coroutines.withTimeout(180_000) { deferred.await() }
      } catch (err: Throwable) {
        throw err
      }
    }
  }

  private suspend fun ensureSystemTts(): Boolean {
    if (systemTts != null) return true
    return withContext(Dispatchers.Main) {
      val deferred = CompletableDeferred<Boolean>()
      val tts =
        try {
          TextToSpeech(context) { status ->
            deferred.complete(status == TextToSpeech.SUCCESS)
          }
        } catch (_: Throwable) {
          deferred.complete(false)
          null
        }
      if (tts == null) return@withContext false

      tts.setOnUtteranceProgressListener(
        object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String?) {}

          override fun onDone(utteranceId: String?) {
            if (utteranceId == null) return
            if (utteranceId != systemTtsPendingId) return
            systemTtsPending?.complete(Unit)
            systemTtsPending = null
            systemTtsPendingId = null
          }

          @Suppress("OVERRIDE_DEPRECATION")
          @Deprecated("Deprecated in Java")
          override fun onError(utteranceId: String?) {
            if (utteranceId == null) return
            if (utteranceId != systemTtsPendingId) return
            systemTtsPending?.completeExceptionally(IllegalStateException("system TTS error"))
            systemTtsPending = null
            systemTtsPendingId = null
          }

          override fun onError(utteranceId: String?, errorCode: Int) {
            if (utteranceId == null) return
            if (utteranceId != systemTtsPendingId) return
            systemTtsPending?.completeExceptionally(IllegalStateException("system TTS error $errorCode"))
            systemTtsPending = null
            systemTtsPendingId = null
          }
        },
      )

      val ok =
        try {
          deferred.await()
        } catch (_: Throwable) {
          false
        }
      if (ok) {
        systemTts = tts
      } else {
        tts.shutdown()
      }
      ok
    }
  }

  private fun stopSpeaking(resetInterrupt: Boolean = true) {
    pcmStopRequested = true
    if (!_isSpeaking.value) {
      cleanupPlayer()
      cleanupPcmTrack()
      systemTts?.stop()
      systemTtsPending?.cancel()
      systemTtsPending = null
      systemTtsPendingId = null
      return
    }
    if (resetInterrupt) {
      val currentMs = player?.currentPosition?.toDouble() ?: 0.0
      lastInterruptedAtSeconds = currentMs / 1000.0
    }
    cleanupPlayer()
    cleanupPcmTrack()
    systemTts?.stop()
    systemTtsPending?.cancel()
    systemTtsPending = null
    systemTtsPendingId = null
    _isSpeaking.value = false
  }

  private fun cleanupPlayer() {
    player?.stop()
    player?.release()
    player = null
    streamingSource?.close()
    streamingSource = null
  }

  private fun cleanupPcmTrack() {
    val track = pcmTrack ?: return
    try {
      track.pause()
      track.flush()
      track.stop()
    } catch (_: Throwable) {
      // ignore cleanup errors
    } finally {
      track.release()
    }
    pcmTrack = null
  }

  private fun shouldInterrupt(transcript: String, isFinal: Boolean): Boolean {
    val trimmed = transcript.trim()
    if (trimmed.length < 3) return false
    val elapsedSinceSpeechStart = SystemClock.elapsedRealtime() - lastSpeechStartedAtMs
    if (elapsedSinceSpeechStart < interruptMinDelayMs) return false

    val normalized = trimmed.lowercase(Locale.ROOT)
    val wordCount = normalized.split(Regex("\\s+")).count { it.isNotEmpty() }
    if (!isFinal && (trimmed.length < interruptMinCharsPartial || wordCount < 3)) return false

    val spoken = lastSpokenText?.lowercase(Locale.ROOT)
    if (spoken != null && spoken.contains(normalized)) return false
    return true
  }

  private fun sanitizeSpokenText(raw: String): String {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return trimmed
    val normalized = trimmed.lowercase(Locale.ROOT)
    val prefixes =
      listOf(
        "checking context",
        "checking the context",
        "let me check",
        "one moment",
        "un instant",
        "je verifie",
        "je vérifie",
      )
    for (prefix in prefixes) {
      if (!normalized.startsWith(prefix)) continue
      val tail = trimmed.substring(prefix.length).trimStart(' ', ':', '-', '.', ',', ';')
      if (tail.length >= 8) {
        return tail
      }
    }
    return trimmed
  }

  private suspend fun reloadConfig() {
    val envVoice = System.getenv("ELEVENLABS_VOICE_ID")?.trim()
    val sagVoice = System.getenv("SAG_VOICE_ID")?.trim()
    val envKey = System.getenv("ELEVENLABS_API_KEY")?.trim()
    try {
      val res = session.request("config.get", "{}")
      val root = json.parseToJsonElement(res).asObjectOrNull()
      val config = root?.get("config").asObjectOrNull()
      val talk = config?.get("talk").asObjectOrNull()
      val messages = config?.get("messages").asObjectOrNull()
      val tts = messages?.get("tts").asObjectOrNull()
      val elevenlabs = tts?.get("elevenlabs").asObjectOrNull()
      val sessionCfg = config?.get("session").asObjectOrNull()
      val mainKey = normalizeMainKey(sessionCfg?.get("mainKey").asStringOrNull())
      val talkSessionKey = talk?.get("sessionKey")?.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
      val voice = talk?.get("voiceId")?.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
      val aliases =
        talk?.get("voiceAliases").asObjectOrNull()?.entries?.mapNotNull { (key, value) ->
          val id = value.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
          normalizeAliasKey(key).takeIf { it.isNotEmpty() }?.let { it to id }
        }?.toMap().orEmpty()
      val model = talk?.get("modelId")?.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
      val outputFormat = talk?.get("outputFormat")?.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
      val key =
        talk?.get("apiKey")?.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
          ?: elevenlabs?.get("apiKey")?.asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
      val baseUrl =
        TalkModeRuntime.validatedHttpBaseUrl(
          talk?.get("apiBaseUrl")?.asStringOrNull()?.trim()
            ?: elevenlabs?.get("baseUrl")?.asStringOrNull()?.trim(),
        )
      val recognitionLanguage =
        TalkModeRuntime.validatedLocaleTag(
          talk?.get("recognitionLanguage")?.asStringOrNull()?.trim()
            ?: elevenlabs?.get("languageCode")?.asStringOrNull()?.trim(),
        )
      val configuredRecognitionLanguages =
        ((talk?.get("recognitionLanguages") as? JsonArray) ?: JsonArray(emptyList()))
          .mapNotNull { TalkModeRuntime.validatedLocaleTag(it.asStringOrNull()?.trim()) }
          .distinct()
      val recognitionLanguages =
        when {
          configuredRecognitionLanguages.isNotEmpty() -> configuredRecognitionLanguages
          recognitionLanguage != null -> listOf(recognitionLanguage)
          else -> defaultRecognitionLanguages
        }
      val interrupt = talk?.get("interruptOnSpeech")?.asBooleanOrNull()

      val resolvedSessionKey = talkSessionKey ?: pinnedTalkSessionKey ?: defaultTalkSessionKey
      pinnedTalkSessionKey = resolvedSessionKey
      mainSessionKey = resolvedSessionKey.ifBlank { mainKey }
      defaultVoiceId = voice ?: envVoice?.takeIf { it.isNotEmpty() } ?: sagVoice?.takeIf { it.isNotEmpty() }
      voiceAliases = aliases
      if (!voiceOverrideActive) currentVoiceId = defaultVoiceId
      defaultModelId = model ?: defaultModelIdFallback
      if (!modelOverrideActive) currentModelId = defaultModelId
      defaultOutputFormat = outputFormat ?: defaultOutputFormatFallback
      apiKey = key ?: envKey?.takeIf { it.isNotEmpty() }
      apiBaseUrl = baseUrl
      this.recognitionLanguages = recognitionLanguages
      this.recognitionLanguage = recognitionLanguage
      syncStickyLanguageDefaults()
      if (!voiceOverrideActive) {
        preferredVoiceForLanguageCode(stickyLanguageCode)?.let { currentVoiceId = it }
      }
      if (interrupt != null) interruptOnSpeech = interrupt
      Log.d(
        tag,
        "config loaded: sessionKey=${mainSessionKey.ifBlank { "main" }} ttsBaseUrl=${apiBaseUrl ?: "default"} recognitionLanguage=${this.recognitionLanguage ?: "auto"} recognitionLanguages=${this.recognitionLanguages.joinToString(",")} sticky=${stickyLanguageTag}/${stickyLanguageCode} locked=$stickyLanguageLocked",
      )
    } catch (_: Throwable) {
      defaultVoiceId = envVoice?.takeIf { it.isNotEmpty() } ?: sagVoice?.takeIf { it.isNotEmpty() }
      defaultModelId = defaultModelIdFallback
      if (!modelOverrideActive) currentModelId = defaultModelId
      apiKey = envKey?.takeIf { it.isNotEmpty() }
      apiBaseUrl = null
      recognitionLanguage = null
      recognitionLanguages = emptyList()
      recognitionLanguageExtrasEnabled = true
      recognizerClientErrorStreak = 0
      languageDetectionExtrasSuspendedUntilMs = 0L
      if (pinnedTalkSessionKey.isNullOrBlank()) {
        pinnedTalkSessionKey = defaultTalkSessionKey
      }
      mainSessionKey = pinnedTalkSessionKey ?: defaultTalkSessionKey
      voiceAliases = emptyMap()
      defaultOutputFormat = defaultOutputFormatFallback
      syncStickyLanguageDefaults()
    }
  }

  private fun parseRunId(jsonString: String): String? {
    val obj = json.parseToJsonElement(jsonString).asObjectOrNull() ?: return null
    return obj["runId"].asStringOrNull()
  }

  private suspend fun streamTts(
    voiceId: String,
    apiKey: String,
    request: ElevenLabsRequest,
    sink: StreamingMediaDataSource,
  ) {
    withContext(Dispatchers.IO) {
      val conn = openTtsConnection(voiceId = voiceId, apiKey = apiKey, request = request)
      try {
        val payload = buildRequestPayload(request)
        conn.outputStream.use { it.write(payload.toByteArray()) }

        val code = conn.responseCode
        if (code >= 400) {
          val message = conn.errorStream?.readBytes()?.toString(Charsets.UTF_8) ?: ""
          sink.fail()
          throw IllegalStateException("ElevenLabs failed: $code $message")
        }

        val buffer = ByteArray(8 * 1024)
        conn.inputStream.use { input ->
          while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            sink.append(buffer.copyOf(read))
          }
        }
        sink.finish()
      } finally {
        conn.disconnect()
      }
    }
  }

  private suspend fun streamPcm(
    voiceId: String,
    apiKey: String,
    request: ElevenLabsRequest,
    track: AudioTrack,
  ) {
    withContext(Dispatchers.IO) {
      val conn = openTtsConnection(voiceId = voiceId, apiKey = apiKey, request = request)
      try {
        val payload = buildRequestPayload(request)
        conn.outputStream.use { it.write(payload.toByteArray()) }

        val code = conn.responseCode
        if (code >= 400) {
          val message = conn.errorStream?.readBytes()?.toString(Charsets.UTF_8) ?: ""
          throw IllegalStateException("ElevenLabs failed: $code $message")
        }

        val buffer = ByteArray(8 * 1024)
        conn.inputStream.use { input ->
          while (true) {
            if (pcmStopRequested) return@withContext
            val read = input.read(buffer)
            if (read <= 0) break
            var offset = 0
            while (offset < read) {
              if (pcmStopRequested) return@withContext
              val wrote =
                try {
                  track.write(buffer, offset, read - offset)
                } catch (err: Throwable) {
                  if (pcmStopRequested) return@withContext
                  throw err
                }
              if (wrote <= 0) {
                if (pcmStopRequested) return@withContext
                throw IllegalStateException("AudioTrack write failed: $wrote")
              }
              offset += wrote
            }
          }
        }
      } finally {
        conn.disconnect()
      }
    }
  }

  private fun openTtsConnection(
    voiceId: String,
    apiKey: String,
    request: ElevenLabsRequest,
  ): HttpURLConnection {
    val baseUrl = "${resolvedTtsApiBaseUrl()}/v1/text-to-speech/$voiceId/stream"
    val latencyTier = request.latencyTier
    Log.d(tag, "tts request: baseUrl=$baseUrl language=${request.language ?: "auto"}")
    val url =
      if (latencyTier != null) {
        URL("$baseUrl?optimize_streaming_latency=$latencyTier")
      } else {
        URL(baseUrl)
      }
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "POST"
    conn.connectTimeout = 30_000
    conn.readTimeout = 30_000
    conn.setRequestProperty("Content-Type", "application/json")
    conn.setRequestProperty("Accept", resolveAcceptHeader(request.outputFormat))
    conn.setRequestProperty("xi-api-key", apiKey)
    conn.doOutput = true
    return conn
  }

  private fun resolveAcceptHeader(outputFormat: String?): String {
    val normalized = outputFormat?.trim()?.lowercase().orEmpty()
    return if (normalized.startsWith("pcm_")) "audio/pcm" else "audio/mpeg"
  }

  private fun buildRequestPayload(request: ElevenLabsRequest): String {
    val voiceSettingsEntries =
      buildJsonObject {
        request.speed?.let { put("speed", JsonPrimitive(it)) }
        request.stability?.let { put("stability", JsonPrimitive(it)) }
        request.similarity?.let { put("similarity_boost", JsonPrimitive(it)) }
        request.style?.let { put("style", JsonPrimitive(it)) }
        request.speakerBoost?.let { put("use_speaker_boost", JsonPrimitive(it)) }
      }

    val payload =
      buildJsonObject {
        put("text", JsonPrimitive(request.text))
        request.modelId?.takeIf { it.isNotEmpty() }?.let { put("model_id", JsonPrimitive(it)) }
        request.outputFormat?.takeIf { it.isNotEmpty() }?.let { put("output_format", JsonPrimitive(it)) }
        request.seed?.let { put("seed", JsonPrimitive(it)) }
        request.normalize?.let { put("apply_text_normalization", JsonPrimitive(it)) }
        request.language?.let { put("language_code", JsonPrimitive(it)) }
        if (voiceSettingsEntries.isNotEmpty()) {
          put("voice_settings", voiceSettingsEntries)
        }
      }

    return payload.toString()
  }

  private data class ElevenLabsRequest(
    val text: String,
    val modelId: String?,
    val outputFormat: String?,
    val speed: Double?,
    val stability: Double?,
    val similarity: Double?,
    val style: Double?,
    val speakerBoost: Boolean?,
    val seed: Long?,
    val normalize: String?,
    val language: String?,
    val latencyTier: Int?,
  )

  private object TalkModeRuntime {
    fun resolveSpeed(speed: Double?, rateWpm: Int?): Double? {
      if (rateWpm != null && rateWpm > 0) {
        val resolved = rateWpm.toDouble() / 175.0
        if (resolved <= 0.5 || resolved >= 2.0) return null
        return resolved
      }
      if (speed != null) {
        if (speed <= 0.5 || speed >= 2.0) return null
        return speed
      }
      return null
    }

    fun validatedUnit(value: Double?): Double? {
      if (value == null) return null
      if (value < 0 || value > 1) return null
      return value
    }

    fun validatedStability(value: Double?, modelId: String?): Double? {
      if (value == null) return null
      val normalized = modelId?.trim()?.lowercase()
      if (normalized == "eleven_v3") {
        return if (value == 0.0 || value == 0.5 || value == 1.0) value else null
      }
      return validatedUnit(value)
    }

    fun validatedSeed(value: Long?): Long? {
      if (value == null) return null
      if (value < 0 || value > 4294967295L) return null
      return value
    }

    fun validatedNormalize(value: String?): String? {
      val normalized = value?.trim()?.lowercase() ?: return null
      return if (normalized in listOf("auto", "on", "off")) normalized else null
    }

    fun validatedLanguage(value: String?): String? {
      val normalized = value?.trim()?.lowercase() ?: return null
      if (normalized.length != 2) return null
      if (!normalized.all { it in 'a'..'z' }) return null
      return normalized
    }

    fun validatedLocaleTag(value: String?): String? {
      val normalized = value?.trim()?.replace('_', '-') ?: return null
      if (normalized.isEmpty()) return null
      if (normalized.length > 16) return null
      if (!normalized.all { it.isLetterOrDigit() || it == '-' }) return null
      return normalized
    }

    fun validatedHttpBaseUrl(value: String?): String? {
      val normalized = value?.trim()?.trimEnd('/') ?: return null
      if (normalized.isEmpty()) return null
      if (!(normalized.startsWith("http://") || normalized.startsWith("https://"))) return null
      return normalized
    }

    fun isLoopbackHost(raw: String?): Boolean {
      val host = raw?.trim()?.removePrefix("[")?.removeSuffix("]")?.lowercase().orEmpty()
      if (host.isEmpty()) return false
      if (host == "localhost") return true
      if (host == "::1") return true
      if (host == "0.0.0.0" || host == "::") return true
      return host.startsWith("127.")
    }

    fun validatedOutputFormat(value: String?): String? {
      val trimmed = value?.trim()?.lowercase() ?: return null
      if (trimmed.isEmpty()) return null
      if (trimmed.startsWith("mp3_")) return trimmed
      return if (parsePcmSampleRate(trimmed) != null) trimmed else null
    }

    fun validatedLatencyTier(value: Int?): Int? {
      if (value == null) return null
      if (value < 0 || value > 4) return null
      return value
    }

    fun parsePcmSampleRate(value: String?): Int? {
      val trimmed = value?.trim()?.lowercase() ?: return null
      if (!trimmed.startsWith("pcm_")) return null
      val suffix = trimmed.removePrefix("pcm_")
      val digits = suffix.takeWhile { it.isDigit() }
      val rate = digits.toIntOrNull() ?: return null
      return if (rate in setOf(16000, 22050, 24000, 44100)) rate else null
    }

    fun isMessageTimestampAfter(timestamp: Double, sinceSeconds: Double): Boolean {
      val sinceMs = sinceSeconds * 1000
      return if (timestamp > 10_000_000_000) {
        timestamp >= sinceMs - 500
      } else {
        timestamp >= sinceSeconds - 0.5
      }
    }
  }

  private fun ensureInterruptListener() {
    if (!interruptOnSpeech || !_isEnabled.value) return
    mainHandler.post {
      if (stopRequested) return@post
      if (!SpeechRecognizer.isRecognitionAvailable(context)) return@post
      try {
        if (recognizer == null) {
          recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(listener) }
        }
        recognizer?.cancel()
        startListeningInternal(markListening = false)
      } catch (_: Throwable) {
        // ignore
      }
    }
  }

  private fun resolveVoiceAlias(value: String?): String? {
    val trimmed = value?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    val normalized = normalizeAliasKey(trimmed)
    voiceAliases[normalized]?.let { return it }
    if (voiceAliases.values.any { it.equals(trimmed, ignoreCase = true) }) return trimmed
    return if (isLikelyVoiceId(trimmed)) trimmed else null
  }

  private fun preferredVoiceForLanguageCode(code: String?): String? {
    val normalized = code?.trim()?.lowercase().orEmpty()
    val alias = if (normalized == "fr") "mia" else "aria"
    return resolveVoiceAlias(alias)
  }

  private fun saveStickyLanguageState() {
    if (!stickyLanguageLocked) return
    runCatching {
      context
        .getSharedPreferences(stickyLanguagePrefsName, Context.MODE_PRIVATE)
        .edit()
        .putString(stickyLanguageTagKey, stickyLanguageTag)
        .putString(stickyLanguageCodeKey, stickyLanguageCode)
        .putLong(stickyLanguageLockedAtKey, System.currentTimeMillis())
        .apply()
    }.onFailure { err ->
      Log.w(tag, "failed to persist sticky language: ${err.message ?: err::class.simpleName}")
    }
  }

  private fun clearStickyLanguageState() {
    runCatching {
      context
        .getSharedPreferences(stickyLanguagePrefsName, Context.MODE_PRIVATE)
        .edit()
        .remove(stickyLanguageTagKey)
        .remove(stickyLanguageCodeKey)
        .remove(stickyLanguageLockedAtKey)
        .apply()
    }
  }

  private fun restoreStickyLanguageStateIfFresh() {
    if (stickyLanguageLocked) return
    val prefs =
      runCatching { context.getSharedPreferences(stickyLanguagePrefsName, Context.MODE_PRIVATE) }.getOrNull()
        ?: return
    val lockedAtMs = prefs.getLong(stickyLanguageLockedAtKey, 0L)
    if (lockedAtMs <= 0L) return
    val ageMs = System.currentTimeMillis() - lockedAtMs
    if (ageMs < 0L || ageMs > stickyLanguagePersistTtlMs) {
      clearStickyLanguageState()
      return
    }
    val storedCode = prefs.getString(stickyLanguageCodeKey, null)?.trim()?.lowercase().orEmpty()
    val restoredCode = if (storedCode == "fr") "fr" else if (storedCode == "en") "en" else return
    val restoredTag =
      normalizedStickyLanguageTag(prefs.getString(stickyLanguageTagKey, null))
        ?: preferredLocaleForCode(restoredCode)
    stickyLanguageTag = restoredTag
    stickyLanguageCode = restoredCode
    stickyLanguageLocked = true
    stickyFrenchVotes = 0
    stickyEnglishVotes = 0
    stickyFrenchConfidence = 0.0
    stickyEnglishConfidence = 0.0
    if (!voiceOverrideActive) {
      preferredVoiceForLanguageCode(restoredCode)?.let { currentVoiceId = it }
    }
    logLanguageState("sticky_restored", "ageMs=$ageMs")
  }

  private fun syncStickyLanguageDefaults() {
    if (stickyLanguageLocked) return
    val base =
      normalizedStickyLanguageTag(recognitionLanguage)
        ?: normalizedStickyLanguageTag(recognitionLanguages.firstOrNull())
        ?: normalizedStickyLanguageTag(stickyLanguageTag)
        ?: "en-US"
    stickyLanguageTag = base
    stickyLanguageCode = stickyLanguageCodeFromTag(base)
    stickyFrenchVotes = 0
    stickyEnglishVotes = 0
    stickyFrenchConfidence = 0.0
    stickyEnglishConfidence = 0.0
  }

  private fun normalizedStickyLanguageTag(value: String?): String? {
    val raw = value?.trim()?.replace('_', '-')?.lowercase().orEmpty()
    if (raw.isEmpty()) return null
    return when {
      raw.startsWith("fr") -> preferredLocaleForCode("fr")
      raw.startsWith("en") -> preferredLocaleForCode("en")
      else -> null
    }
  }

  private fun stickyLanguageCodeFromTag(tag: String): String {
    return if (tag.lowercase().startsWith("fr")) "fr" else "en"
  }

  private fun preferredLocaleForCode(code: String): String {
    val normalized = code.trim().lowercase()
    val exact =
      recognitionLanguages.firstOrNull {
        val candidate = it.trim().lowercase()
        candidate == normalized || candidate.startsWith("$normalized-")
      }
    if (exact != null) return exact
    return if (normalized == "fr") "fr-FR" else "en-US"
  }

  private fun updateStickyLanguageFromTranscript(text: String, isFinal: Boolean) {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return
    val lower = trimmed.lowercase(Locale.ROOT)
    val tokens = Regex("[a-zA-ZÀ-ÿ']+").findAll(lower).map { it.value }.toList()
    val shortCommand = tokens.size in 1..6
    val asksFrenchWord = lower.contains("french") || lower.contains("français") || lower.contains("francais")
    val asksEnglishWord = lower.contains("english") || lower.contains("anglais")
    val englishControlWords = listOf("switch", "change", "set", "continue", "reply", "respond", "talk", "speak", "mode")

    if (switchToFrenchRegexes.any { it.containsMatchIn(lower) }) {
      Log.i(tag, "manual french trigger matched: \"$trimmed\"")
      lockStickyLanguage("fr", reason = "manual")
      return
    }
    if (switchToEnglishRegexes.any { it.containsMatchIn(lower) }) {
      Log.i(tag, "manual english trigger matched: \"$trimmed\"")
      lockStickyLanguage("en", reason = "manual")
      return
    }
    if (isFinal && shortCommand && asksFrenchWord) {
      Log.i(tag, "manual french trigger (short command): \"$trimmed\"")
      lockStickyLanguage("fr", reason = "manual_short")
      return
    }
    if (isFinal && shortCommand && asksEnglishWord) {
      Log.i(tag, "manual english trigger (short command): \"$trimmed\"")
      lockStickyLanguage("en", reason = "manual_short")
      return
    }
    if (
      isFinal &&
      asksFrenchWord &&
      englishControlWords.any { lower.contains(it) }
    ) {
      Log.i(tag, "manual french trigger (fallback heuristic): \"$trimmed\"")
      lockStickyLanguage("fr", reason = "manual_fallback")
      return
    }
    if (
      isFinal &&
      asksEnglishWord &&
      englishControlWords.any { lower.contains(it) }
    ) {
      Log.i(tag, "manual english trigger (fallback heuristic): \"$trimmed\"")
      lockStickyLanguage("en", reason = "manual_fallback")
      return
    }

    if (stickyLanguageLocked) return

    val signal = inferLanguageSignalFromText(lower, tokens) ?: return
    if (signal.confidence < autoLanguageConfidenceThreshold) return
    applyAutoLanguageVote(signal.code, signal.confidence, isFinal = isFinal, reason = "transcript")
  }

  private fun updateStickyLanguageFromDetectedTag(detectedTag: String, isFinal: Boolean) {
    if (stickyLanguageLocked) return
    val code = stickyLanguageCodeFromTag(detectedTag)
    applyAutoLanguageVote(code, confidence = 0.9, isFinal = isFinal, reason = "asr_detected")
  }

  private fun applyAutoLanguageVote(code: String, confidence: Double, isFinal: Boolean, reason: String) {
    if (stickyLanguageLocked) return
    val clamped = confidence.coerceIn(0.0, 1.0)
    val weight = if (isFinal) 1.0 else 0.65
    val weighted = clamped * weight

    when (code) {
      "fr" -> {
        stickyFrenchVotes += if (isFinal) 2 else 1
        stickyEnglishVotes = 0
        stickyFrenchConfidence = (stickyFrenchConfidence + weighted).coerceAtMost(3.0)
        stickyEnglishConfidence = 0.0
        logLanguageState(
          "vote_fr",
          "reason=$reason conf=${String.format(Locale.US, "%.2f", clamped)} weighted=${String.format(Locale.US, "%.2f", weighted)} final=$isFinal",
        )
        if (
          stickyFrenchVotes >= stickyLanguageVoteThreshold &&
          stickyFrenchConfidence >= autoLanguageConfidenceLockThreshold
        ) {
          lockStickyLanguage("fr", reason = "auto_vote_$reason")
        }
      }

      "en" -> {
        stickyEnglishVotes += if (isFinal) 1 else 0
        stickyFrenchVotes = 0
        stickyEnglishConfidence = (stickyEnglishConfidence + weighted).coerceAtMost(3.0)
        stickyFrenchConfidence = 0.0
        logLanguageState(
          "vote_en",
          "reason=$reason conf=${String.format(Locale.US, "%.2f", clamped)} weighted=${String.format(Locale.US, "%.2f", weighted)} final=$isFinal",
        )
      }
    }
  }

  private fun inferLanguageSignalFromText(lower: String, tokens: List<String>): LanguageSignal? {
    if (tokens.isEmpty()) return null

    val frHits = tokens.count { it in frenchMarkers }
    val enHits = tokens.count { it in englishMarkers }
    var frScore = 0.0
    var enScore = 0.0

    if (frenchAccentRegex.containsMatchIn(lower)) {
      frScore += 0.8
    }
    frScore += minOf(1.0, frHits * 0.35)
    enScore += minOf(1.0, enHits * 0.35)

    if (frScore >= autoLanguageConfidenceThreshold && frScore >= enScore + 0.15) {
      return LanguageSignal("fr", frScore.coerceAtMost(0.99))
    }
    if (enScore >= autoLanguageConfidenceThreshold && enScore >= frScore + 0.15) {
      return LanguageSignal("en", enScore.coerceAtMost(0.99))
    }
    return null
  }

  private fun lockStickyLanguage(code: String, reason: String) {
    val normalizedCode = if (code.lowercase() == "fr") "fr" else "en"
    val targetTag = preferredLocaleForCode(normalizedCode)
    val changed = !stickyLanguageTag.equals(targetTag, ignoreCase = true) || !stickyLanguageLocked
    stickyLanguageTag = targetTag
    stickyLanguageCode = normalizedCode
    stickyLanguageLocked = true
    stickyFrenchVotes = 0
    stickyEnglishVotes = 0
    stickyFrenchConfidence = 0.0
    stickyEnglishConfidence = 0.0
    saveStickyLanguageState()
    if (!voiceOverrideActive) {
      preferredVoiceForLanguageCode(normalizedCode)?.let { currentVoiceId = it }
    }
    logLanguageState("locked", "reason=$reason changed=$changed")
    if (changed && _isEnabled.value) {
      recreateRecognizer("sticky_language_$normalizedCode")
      scheduleRestart(delayMs = 250)
    }
  }

  private fun resolvedTtsApiBaseUrl(): String {
    val configured = apiBaseUrl?.trim()?.trimEnd('/')?.takeIf { it.isNotEmpty() } ?: return "https://api.elevenlabs.io"
    return normalizeLoopbackBaseUrl(configured)
  }

  private fun normalizeLoopbackBaseUrl(baseUrl: String): String {
    val uri = runCatching { URI(baseUrl) }.getOrNull() ?: return baseUrl
    if (!TalkModeRuntime.isLoopbackHost(uri.host)) return baseUrl

    val canvasHostUrl = session.currentCanvasHostUrl()
    val canvasUri = canvasHostUrl?.let { runCatching { URI(it) }.getOrNull() }
    val remoteHost = canvasUri?.host?.trim().orEmpty()
    if (remoteHost.isEmpty()) {
      Log.w(tag, "loopback TTS baseUrl cannot be normalized: canvas host unavailable")
      return baseUrl
    }

    val scheme =
      uri.scheme?.trim()?.takeIf { it.isNotEmpty() }
        ?: canvasUri?.scheme?.trim()?.takeIf { it.isNotEmpty() }
        ?: "http"
    val port = if (uri.port > 0) uri.port else if (scheme == "https") 443 else 80
    val formattedHost = if (remoteHost.contains(":")) "[${remoteHost}]" else remoteHost
    val path = uri.rawPath?.takeIf { it.isNotEmpty() }.orEmpty()
    val query = uri.rawQuery?.takeIf { it.isNotEmpty() }?.let { "?$it" }.orEmpty()
    val normalized = "$scheme://$formattedHost:$port$path$query".trimEnd('/')
    if (!normalized.equals(baseUrl, ignoreCase = true)) {
      Log.d(tag, "normalized loopback TTS baseUrl $baseUrl -> $normalized")
    }
    return normalized
  }

  private suspend fun resolveVoiceId(preferred: String?, apiKey: String): String? {
    val trimmed = preferred?.trim().orEmpty()
    if (trimmed.isNotEmpty()) {
      val resolved = resolveVoiceAlias(trimmed)
      if (resolved != null) return resolved
      Log.w(tag, "unknown voice alias $trimmed")
    }
    fallbackVoiceId?.let { return it }

    return try {
      val voices = listVoices(apiKey)
      val first = voices.firstOrNull() ?: return null
      fallbackVoiceId = first.voiceId
      if (defaultVoiceId.isNullOrBlank()) {
        defaultVoiceId = first.voiceId
      }
      if (!voiceOverrideActive) {
        currentVoiceId = first.voiceId
      }
      val name = first.name ?: "unknown"
      Log.d(tag, "default voice selected $name (${first.voiceId})")
      first.voiceId
    } catch (err: Throwable) {
      Log.w(tag, "list voices failed: ${err.message ?: err::class.simpleName}")
      null
    }
  }

  private suspend fun listVoices(apiKey: String): List<ElevenLabsVoice> {
    return withContext(Dispatchers.IO) {
      val url = URL("${resolvedTtsApiBaseUrl()}/v1/voices")
      val conn = url.openConnection() as HttpURLConnection
      conn.requestMethod = "GET"
      conn.connectTimeout = 15_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("xi-api-key", apiKey)

      val code = conn.responseCode
      val stream = if (code >= 400) conn.errorStream else conn.inputStream
      val data = stream.readBytes()
      if (code >= 400) {
        val message = data.toString(Charsets.UTF_8)
        throw IllegalStateException("ElevenLabs voices failed: $code $message")
      }

      val root = json.parseToJsonElement(data.toString(Charsets.UTF_8)).asObjectOrNull()
      val voices = (root?.get("voices") as? JsonArray) ?: JsonArray(emptyList())
      voices.mapNotNull { entry ->
        val obj = entry.asObjectOrNull() ?: return@mapNotNull null
        val voiceId = obj["voice_id"].asStringOrNull() ?: return@mapNotNull null
        val name = obj["name"].asStringOrNull()
        ElevenLabsVoice(voiceId, name)
      }
    }
  }

  private fun isLikelyVoiceId(value: String): Boolean {
    if (value.length < 10) return false
    return value.all { it.isLetterOrDigit() || it == '-' || it == '_' }
  }

  private fun normalizeAliasKey(value: String): String =
    value.trim().lowercase()

  private data class ElevenLabsVoice(val voiceId: String, val name: String?)

  private data class LanguageSignal(val code: String, val confidence: Double)

  private val listener =
    object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {
        recognizerClientErrorStreak = 0
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
        if (_isEnabled.value) {
          _statusText.value = if (_isListening.value) "Listening" else _statusText.value
        }
      }

      override fun onBeginningOfSpeech() {
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
      }

      override fun onRmsChanged(rmsdB: Float) {
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
      }

      override fun onBufferReceived(buffer: ByteArray?) {
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
      }

      override fun onEndOfSpeech() {
        scheduleRestart()
      }

      override fun onError(error: Int) {
        if (stopRequested) return
        _isListening.value = false
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
        Log.w(
          tag,
          "speech recognizer error=$error detectExtras=$recognitionLanguageExtrasEnabled lang=${recognitionLanguage ?: "auto"} langs=${recognitionLanguages.joinToString(",")}",
        )
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
          _statusText.value = "Microphone permission required"
          return
        }

        val interruptProbeOnly = _isSpeaking.value && !listeningMode
        val transientRetryError =
          error == SpeechRecognizer.ERROR_CLIENT ||
            error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
            error == SpeechRecognizer.ERROR_SERVER_DISCONNECTED ||
            error == SpeechRecognizer.ERROR_TOO_MANY_REQUESTS ||
            error == SpeechRecognizer.ERROR_NO_MATCH ||
            error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ||
            error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ||
            error == SpeechRecognizer.ERROR_NETWORK
        if (!_isSpeaking.value && !listeningMode && transientRetryError) {
          _statusText.value = "Listening"
          scheduleRestart(delayMs = 700)
          return
        }
        if (interruptProbeOnly) {
          when (error) {
            SpeechRecognizer.ERROR_CLIENT,
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
            SpeechRecognizer.ERROR_SERVER_DISCONNECTED,
            SpeechRecognizer.ERROR_TOO_MANY_REQUESTS,
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT,
            SpeechRecognizer.ERROR_NETWORK -> {
              _statusText.value = "Speaking…"
              scheduleRestart(delayMs = 900)
              return
            }
          }
        }

        if (error == SpeechRecognizer.ERROR_CLIENT) {
          recognizerClientErrorStreak += 1
          if (recognitionLanguageExtrasEnabled && recognizerClientErrorStreak >= 2) {
            suspendLanguageDetectionExtras("client_error", languageDetectionClientCooldownMs)
          }
          recreateRecognizer("client_error")
          _statusText.value = if (listeningMode) "Listening" else "Speaking…"
          scheduleRestart(delayMs = 900)
          return
        }

        if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
          recreateRecognizer("recognizer_busy")
          _statusText.value = if (listeningMode) "Listening" else "Speaking…"
          scheduleRestart(delayMs = 750)
          return
        }

        if (error == SpeechRecognizer.ERROR_SERVER_DISCONNECTED) {
          recreateRecognizer("server_disconnected")
          _statusText.value = if (listeningMode) "Listening" else "Speaking…"
          scheduleRestart(delayMs = 1_200)
          return
        }

        if (error == SpeechRecognizer.ERROR_TOO_MANY_REQUESTS) {
          _statusText.value = if (listeningMode) "Listening" else "Speaking…"
          scheduleRestart(delayMs = 1_500)
          return
        }

        if (error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE) {
          suspendLanguageDetectionExtras("language_unavailable", languageDetectionUnavailableCooldownMs)
          recreateRecognizer("language_unavailable")
          _statusText.value = if (listeningMode) "Listening" else "Speaking…"
          scheduleRestart(delayMs = 900)
          return
        }

        _statusText.value =
          when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "Audio error"
            SpeechRecognizer.ERROR_CLIENT -> "Client error"
            SpeechRecognizer.ERROR_NETWORK -> "Network error"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
            SpeechRecognizer.ERROR_NO_MATCH -> "Listening"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
            SpeechRecognizer.ERROR_SERVER -> "Server error"
            SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> "Speech service disconnected"
            SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> "Speech throttled"
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> "Language not supported"
            SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "Language unavailable"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Listening"
            else -> "Speech error ($error)"
          }
        scheduleRestart(delayMs = 600)
      }

      override fun onResults(results: Bundle?) {
        recognizerClientErrorStreak = 0
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
        results?.getString("android.speech.extra.DETECTED_LANGUAGE")?.let { detected ->
          normalizedStickyLanguageTag(detected)?.let { detectedTag ->
            updateStickyLanguageFromDetectedTag(detectedTag, isFinal = true)
          }
        }
        val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        list.firstOrNull()?.let { handleTranscript(it, isFinal = true) }
        scheduleRestart()
      }

      override fun onPartialResults(partialResults: Bundle?) {
        lastRecognizerEventAtMs = SystemClock.elapsedRealtime()
        partialResults?.getString("android.speech.extra.DETECTED_LANGUAGE")?.let { detected ->
          normalizedStickyLanguageTag(detected)?.let { detectedTag ->
            updateStickyLanguageFromDetectedTag(detectedTag, isFinal = false)
          }
        }
        val list = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        list.firstOrNull()?.let { handleTranscript(it, isFinal = false) }
      }

      override fun onEvent(eventType: Int, params: Bundle?) {}
    }

  private fun recreateRecognizer(reason: String) {
    mainHandler.post {
      try {
        recognizer?.cancel()
      } catch (_: Throwable) {
        // ignore
      }
      try {
        recognizer?.destroy()
      } catch (_: Throwable) {
        // ignore
      }
      recognizer =
        try {
          SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(listener) }
        } catch (err: Throwable) {
          Log.w(tag, "recreate recognizer failed ($reason): ${err.message ?: err::class.simpleName}")
          null
        }
    }
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asStringOrNull(): String? =
  (this as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonElement?.asDoubleOrNull(): Double? {
  val primitive = this as? JsonPrimitive ?: return null
  return primitive.content.toDoubleOrNull()
}

private fun JsonElement?.asBooleanOrNull(): Boolean? {
  val primitive = this as? JsonPrimitive ?: return null
  val content = primitive.content.trim().lowercase()
  return when (content) {
    "true", "yes", "1" -> true
    "false", "no", "0" -> false
    else -> null
  }
}
