import SwiftUI

struct ApertureIntegrationSection: View {
    let connectionMode: AppState.ConnectionMode
    let isPaused: Bool
    let onConfigChanged: (() async -> Void)?

    @Environment(TailscaleService.self) private var tailscaleService
    @Environment(ApertureService.self) private var apertureService
    #if DEBUG
    private var testingTailscaleService: TailscaleService?
    private var testingApertureService: ApertureService?
    #endif

    @State private var hasLoaded = false
    @State private var apertureEnabled = false
    @State private var apertureHostname = "ai"
    @State private var apertureProviders: [String] = []
    @State private var selectedModelRef = ""
    @State private var statusMessage: String?
    @State private var statusTimer: Timer?

    init(
        connectionMode: AppState.ConnectionMode,
        isPaused: Bool,
        onConfigChanged: (() async -> Void)? = nil)
    {
        self.connectionMode = connectionMode
        self.isPaused = isPaused
        self.onConfigChanged = onConfigChanged
        #if DEBUG
        self.testingTailscaleService = nil
        self.testingApertureService = nil
        #endif
    }

    private var effectiveTailscale: TailscaleService {
        #if DEBUG
        return self.testingTailscaleService ?? self.tailscaleService
        #else
        return self.tailscaleService
        #endif
    }

    private var effectiveAperture: ApertureService {
        #if DEBUG
        return self.testingApertureService ?? self.apertureService
        #else
        return self.apertureService
        #endif
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Tailscale Aperture")
                .font(.callout.weight(.semibold))

            self.statusRow

            if !self.effectiveTailscale.isRunning {
                Text("Tailscale must be running to use Aperture.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Toggle("Enable Aperture", isOn: self.$apertureEnabled)
                    .toggleStyle(.checkbox)

                if self.apertureEnabled {
                    self.hostnameField
                    if !self.effectiveAperture.availableModels.isEmpty {
                        self.modelPicker
                    }
                    self.dashboardLink
                }
            }

            if self.connectionMode != .local {
                Text("Local mode required. Update settings on the gateway host.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let statusMessage {
                Text(statusMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color.gray.opacity(0.08))
        .cornerRadius(10)
        .disabled(self.connectionMode != .local)
        .task {
            guard !self.hasLoaded else { return }
            await self.loadConfig()
            self.hasLoaded = true
            await self.refreshStatusAndModels(forceModelRefresh: true)
            self.startStatusTimer()
        }
        .onDisappear {
            self.stopStatusTimer()
        }
        .onChange(of: self.apertureEnabled) { _, _ in
            Task { await self.applySettings() }
        }
        .onChange(of: self.selectedModelRef) { _, newValue in
            guard self.hasLoaded, !newValue.isEmpty else { return }
            Task { await self.applyModelSelection(newValue) }
        }
    }

    // MARK: - Subviews

    private var statusRow: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(self.effectiveAperture.isReachable ? Color.green : Color.red)
                .frame(width: 10, height: 10)
            Text(self.effectiveAperture.isReachable ? "Aperture reachable" : "Aperture not reachable")
                .font(.callout)
            Spacer()
            Button("Refresh") {
                Task { await self.refreshStatusAndModels(forceModelRefresh: true) }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
    }

    private var hostnameField: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Hostname")
                    .font(.callout.weight(.semibold))
                TextField("ai", text: self.$apertureHostname)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 200)
                    .onSubmit {
                        Task {
                            await self.applySettings()
                            await self.refreshStatusAndModels(forceModelRefresh: true)
                        }
                    }
            }
            Text("Resolved URL: \(self.resolvedModelBaseURL)")
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
        }
    }

    private var modelPicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Model")
                    .font(.callout.weight(.semibold))
                Picker("", selection: self.$selectedModelRef) {
                    if self.selectedModelRef.isEmpty {
                        Text("Select a model…").tag("")
                    }
                    ForEach(self.effectiveAperture.availableModels, id: \.modelRef) { model in
                        Text("\(model.providerName) / \(model.id)").tag(model.modelRef)
                    }
                }
                .labelsHidden()
                .frame(maxWidth: 300)
            }
            if !self.selectedModelRef.isEmpty {
                Text(self.selectedModelRef)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var dashboardLink: some View {
        if self.effectiveAperture.isReachable {
            Button("Open Aperture Dashboard") {
                self.effectiveAperture.openDashboard()
            }
            .buttonStyle(.link)
            .controlSize(.small)
        }
    }

    // MARK: - Config

    private var selectedModelProvider: String? {
        Self.providerFromModelRef(self.selectedModelRef)
    }

    private var resolvedModelBaseURL: String {
        let trimmedHostname = self.apertureHostname.trimmingCharacters(in: .whitespacesAndNewlines)
        let hostname = trimmedHostname.isEmpty ? "ai" : trimmedHostname
        let provider = self.selectedModelProvider ?? "openai"
        return Self.apertureBaseURL(for: provider, hostname: hostname)
    }

    private static let knownApertureProviders: Set<String> = [
        "openai",
        "anthropic",
        "google",
        "openrouter",
    ]

    private static func providerFromModelRef(_ modelRef: String) -> String? {
        let trimmed = modelRef.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        guard let slash = trimmed.firstIndex(of: "/"), slash != trimmed.startIndex else { return nil }
        return String(trimmed[..<slash]).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func resolveApertureProviders(for modelRef: String? = nil) -> [String] {
        var ordered: [String] = []
        var seen = Set<String>()

        func append(_ provider: String?) {
            guard let provider else { return }
            let normalized = provider.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !normalized.isEmpty else { return }
            if seen.insert(normalized).inserted {
                ordered.append(normalized)
            }
        }

        if let modelRef {
            append(Self.providerFromModelRef(modelRef))
        } else {
            append(self.selectedModelProvider)
        }

        for provider in self.apertureProviders {
            append(provider)
        }

        // Fall back to discovered providers when no explicit model/provider is set.
        for provider in self.effectiveAperture.discoveredProviders {
            append(provider)
        }

        // Keep backward compatibility with existing OpenAI-focused setup.
        if ordered.isEmpty {
            append("openai")
        }
        return ordered
    }

    private static func compatibilityWarning(for providers: [String]) -> String? {
        let unknownProviders = Set(
            providers.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() })
            .subtracting(Self.knownApertureProviders)
            .sorted()
        guard !unknownProviders.isEmpty else { return nil }
        return "Using OpenAI-compatible fallback for unrecognized Aperture providers: \(unknownProviders.joined(separator: ", "))."
    }

    private static func withCompatibilityWarning(_ base: String, warning: String?) -> String {
        guard let warning, !warning.isEmpty else { return base }
        return "\(base) \(warning)"
    }

    /// Read Aperture state from the config file directly.
    private func loadConfig() async {
        let root = OpenClawConfigFile.loadDict()
        let gateway = root["gateway"] as? [String: Any] ?? [:]
        let aperture = gateway["aperture"] as? [String: Any] ?? [:]

        self.apertureEnabled = aperture["enabled"] as? Bool ?? false
        self.apertureHostname = aperture["hostname"] as? String ?? "ai"
        self.apertureProviders = aperture["providers"] as? [String] ?? []

        // Read current primary model from agents.defaults.model.primary
        let agents = root["agents"] as? [String: Any] ?? [:]
        let defaults = agents["defaults"] as? [String: Any] ?? [:]
        let model = defaults["model"] as? [String: Any] ?? [:]
        self.selectedModelRef = model["primary"] as? String ?? ""

        self.effectiveAperture.updateHostname(self.apertureHostname)
    }

    /// Save the selected model as agents.defaults.model.primary.
    private func applyModelSelection(_ modelRef: String) async {
        guard self.hasLoaded, !modelRef.isEmpty else { return }

        var root = OpenClawConfigFile.loadDict()
        Self.applyDefaultModelSelection(modelRef, to: &root)

        OpenClawConfigFile.saveDict(root)

        if self.apertureEnabled {
            let trimmedHostname = self.apertureHostname.trimmingCharacters(in: .whitespacesAndNewlines)
            let hostname = trimmedHostname.isEmpty ? "ai" : trimmedHostname
            self.apertureHostname = hostname
            self.effectiveAperture.updateHostname(hostname)
            let providers = self.resolveApertureProviders(for: modelRef)
            Self.buildAndSaveApertureConfig(
                enabled: true,
                hostname: hostname,
                providers: providers)
            self.apertureProviders = providers
        }

        let compatibilityWarning = self.apertureEnabled
            ? Self.compatibilityWarning(for: self.apertureProviders)
            : nil

        if self.connectionMode == .local, !self.isPaused {
            self.statusMessage = "Model set to \(modelRef). Restarting gateway…"
            await GatewayLaunchAgentManager.kickstart()
            self.statusMessage = Self.withCompatibilityWarning(
                "Model set to \(modelRef).",
                warning: compatibilityWarning)
        } else {
            self.statusMessage = Self.withCompatibilityWarning(
                "Model set to \(modelRef). Restart the gateway to apply.",
                warning: compatibilityWarning)
        }

        await self.notifyConfigChanged()
    }

    private static func applyDefaultModelSelection(_ modelRef: String, to root: inout [String: Any]) {
        var agents = root["agents"] as? [String: Any] ?? [:]
        var defaults = agents["defaults"] as? [String: Any] ?? [:]
        var model = defaults["model"] as? [String: Any] ?? [:]
        model["primary"] = modelRef
        defaults["model"] = model

        var allowlist = defaults["models"] as? [String: Any] ?? [:]
        if allowlist[modelRef] == nil {
            allowlist[modelRef] = [String: Any]()
        }
        defaults["models"] = allowlist

        agents["defaults"] = defaults
        root["agents"] = agents
    }

    private func applySettings() async {
        guard self.hasLoaded else { return }
        self.statusMessage = nil

        let trimmedHostname = self.apertureHostname.trimmingCharacters(in: .whitespacesAndNewlines)
        if self.apertureEnabled, trimmedHostname.isEmpty {
            self.statusMessage = "Hostname cannot be empty."
            return
        }
        let hostname = trimmedHostname.isEmpty ? "ai" : trimmedHostname
        self.apertureHostname = hostname
        self.effectiveAperture.updateHostname(hostname)
        let providers = self.resolveApertureProviders()
        self.apertureProviders = providers

        Self.buildAndSaveApertureConfig(
            enabled: self.apertureEnabled,
            hostname: hostname,
            providers: providers)

        let compatibilityWarning = self.apertureEnabled
            ? Self.compatibilityWarning(for: providers)
            : nil

        if self.connectionMode == .local, !self.isPaused {
            self.statusMessage = "Saved. Restarting gateway…"
            await GatewayLaunchAgentManager.kickstart()
            self.statusMessage = Self.withCompatibilityWarning("Saved.", warning: compatibilityWarning)
        } else {
            self.statusMessage = Self.withCompatibilityWarning(
                "Saved. Restart the gateway to apply.",
                warning: compatibilityWarning)
        }

        await self.notifyConfigChanged()
    }

    private func notifyConfigChanged() async {
        guard let onConfigChanged = self.onConfigChanged else { return }
        await onConfigChanged()
    }

    /// Write Aperture config directly to the config file.
    ///
    /// When enabled, applies provider-specific Aperture endpoints to the
    /// configured model providers. On disable, removes Aperture config.
    @MainActor
    private static func buildAndSaveApertureConfig(
        enabled: Bool,
        hostname: String,
        providers discoveredProviders: [String])
    {
        var root = OpenClawConfigFile.loadDict()
        Self.applyApertureConfig(
            enabled: enabled,
            hostname: hostname,
            providers: discoveredProviders,
            root: &root)
        OpenClawConfigFile.saveDict(root)
    }

    private static func applyApertureConfig(
        enabled: Bool,
        hostname: String,
        providers discoveredProviders: [String],
        root: inout [String: Any])
    {
        var gateway = root["gateway"] as? [String: Any] ?? [:]
        var models = root["models"] as? [String: Any] ?? [:]
        var providers = models["providers"] as? [String: Any] ?? [:]

        let allProviders = discoveredProviders

        // Read previous Aperture state to clean up stale configs
        let previousAperture = gateway["aperture"] as? [String: Any]
        let previousHostname = previousAperture?["hostname"] as? String ?? hostname
        let previousProviders = previousAperture?["providers"] as? [String] ?? allProviders
        let restoreProviders = Self.parseRestoreProviders(previousAperture?["restore"])

        if enabled {
            var nextRestoreProviders = restoreProviders

            // Capture original provider routing/auth before any Aperture rewrite so
            // disabling can restore prior endpoints and credentials.
            for name in allProviders {
                let existing = providers[name] as? [String: Any] ?? [:]
                let configuredBaseUrl = existing["baseUrl"] as? String
                let apertureBaseUrl = Self.apertureBaseURL(for: name, hostname: hostname)
                let previousBaseUrl = Self.apertureBaseURL(for: name, hostname: previousHostname)
                let isApertureBaseUrl = configuredBaseUrl == apertureBaseUrl
                    || configuredBaseUrl == previousBaseUrl
                    || configuredBaseUrl == "http://\(hostname)"
                    || configuredBaseUrl == "http://\(previousHostname)"

                if !isApertureBaseUrl {
                    let restoreEntry = Self.captureRestoreProvider(existing)
                    if !restoreEntry.isEmpty {
                        nextRestoreProviders[name] = restoreEntry
                    }
                }
            }

            var apertureConfig: [String: Any] = [
                "enabled": true,
                "hostname": hostname,
                "providers": allProviders,
            ]
            if !nextRestoreProviders.isEmpty {
                apertureConfig["restore"] = nextRestoreProviders.mapValues { value in
                    var result: [String: Any] = [:]
                    if let baseUrl = value["baseUrl"] {
                        result["baseUrl"] = baseUrl
                    }
                    if let apiKey = value["apiKey"] {
                        result["apiKey"] = apiKey
                    }
                    if let api = value["api"] {
                        result["api"] = api
                    }
                    return result
                }
            }
            gateway["aperture"] = apertureConfig

            // Route configured providers through Aperture using provider-appropriate
            // base URLs and API adapters.
            for name in allProviders {
                var config = providers[name] as? [String: Any] ?? [:]
                config["baseUrl"] = Self.apertureBaseURL(for: name, hostname: hostname)
                config["apiKey"] = "-"
                if let api = Self.apertureAPI(for: name) {
                    config["api"] = api
                }
                providers[name] = config
            }
        } else {
            // On disable: remove Aperture config from providers it configured
            let cleanupProviders = Set(allProviders + previousProviders)
            for name in cleanupProviders {
                if var config = providers[name] as? [String: Any] {
                    let configuredBaseUrl = config["baseUrl"] as? String
                    let apertureBaseUrl = Self.apertureBaseURL(for: name, hostname: hostname)
                    let previousBaseUrl = Self.apertureBaseURL(for: name, hostname: previousHostname)
                    let isApertureBaseUrl = configuredBaseUrl == apertureBaseUrl
                        || configuredBaseUrl == previousBaseUrl
                        || configuredBaseUrl == "http://\(hostname)"
                        || configuredBaseUrl == "http://\(previousHostname)"

                    if isApertureBaseUrl {
                        if let restoreEntry = restoreProviders[name] {
                            if let restoreBaseUrl = restoreEntry["baseUrl"] {
                                config["baseUrl"] = restoreBaseUrl
                            } else {
                                config.removeValue(forKey: "baseUrl")
                            }
                            if let restoreApiKey = restoreEntry["apiKey"] {
                                config["apiKey"] = restoreApiKey
                            } else {
                                config.removeValue(forKey: "apiKey")
                            }
                            if let restoreApi = restoreEntry["api"] {
                                config["api"] = restoreApi
                            } else if let apertureApi = Self.apertureAPI(for: name),
                                      config["api"] as? String == apertureApi
                            {
                                config.removeValue(forKey: "api")
                            }
                        } else {
                            config.removeValue(forKey: "baseUrl")
                            config.removeValue(forKey: "apiKey")
                            if let apertureApi = Self.apertureAPI(for: name),
                               config["api"] as? String == apertureApi
                            {
                                config.removeValue(forKey: "api")
                            }
                        }
                    }

                    let hasBaseUrl = !(config["baseUrl"] as? String ?? "")
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                        .isEmpty
                    if isApertureBaseUrl && !hasBaseUrl {
                        // Provider entries require baseUrl in schema.
                        // If we cannot restore one, drop the provider to avoid
                        // writing an invalid config.
                        providers.removeValue(forKey: name)
                        continue
                    }
                    if config.isEmpty {
                        providers.removeValue(forKey: name)
                    } else {
                        providers[name] = config
                    }
                }
            }

            gateway.removeValue(forKey: "aperture")
        }

        if providers.isEmpty {
            models.removeValue(forKey: "providers")
        } else {
            models["providers"] = providers
        }

        if models.isEmpty {
            root.removeValue(forKey: "models")
        } else {
            root["models"] = models
        }

        if gateway.isEmpty {
            root.removeValue(forKey: "gateway")
        } else {
            root["gateway"] = gateway
        }
    }

    private static func apertureBaseURL(for provider: String, hostname: String) -> String {
        let normalizedProvider = provider.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let trimmedHostname = hostname.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedHostname = trimmedHostname.isEmpty ? "ai" : trimmedHostname

        switch normalizedProvider {
        case "anthropic":
            // Anthropic client expects a root base URL (it appends /v1/messages).
            return "http://\(resolvedHostname)"
        case "google":
            // Gemini client appends /models/... paths, so route through Aperture's
            // Google-compatible versioned surface.
            return "http://\(resolvedHostname)/v1beta"
        default:
            // OpenAI-compatible clients expect /v1 in the base URL.
            return "http://\(resolvedHostname)/v1"
        }
    }

    private static func apertureAPI(for provider: String) -> String? {
        switch provider.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "anthropic":
            return "anthropic-messages"
        case "google":
            return "google-generative-ai"
        case "openrouter":
            return "openai-completions"
        default:
            return nil
        }
    }

    private static func parseRestoreProviders(_ raw: Any?) -> [String: [String: String]] {
        guard let rawDict = raw as? [String: Any] else { return [:] }
        var parsed: [String: [String: String]] = [:]
        for (provider, value) in rawDict {
            guard let valueDict = value as? [String: Any] else { continue }
            var entry: [String: String] = [:]
            if let baseUrl = valueDict["baseUrl"] as? String,
               !baseUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            {
                entry["baseUrl"] = baseUrl
            }
            if let apiKey = valueDict["apiKey"] as? String,
               !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            {
                entry["apiKey"] = apiKey
            }
            if let api = valueDict["api"] as? String,
               !api.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            {
                entry["api"] = api
            }
            if !entry.isEmpty {
                parsed[provider] = entry
            }
        }
        return parsed
    }

    private static func captureRestoreProvider(_ config: [String: Any]) -> [String: String] {
        var entry: [String: String] = [:]
        if let baseUrl = config["baseUrl"] as? String,
           !baseUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        {
            entry["baseUrl"] = baseUrl
        }
        if let apiKey = config["apiKey"] as? String,
           !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        {
            entry["apiKey"] = apiKey
        }
        if let api = config["api"] as? String,
           !api.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        {
            entry["api"] = api
        }
        return entry
    }

    // MARK: - Lifecycle

    private func startStatusTimer() {
        self.stopStatusTimer()
        if ProcessInfo.processInfo.isRunningTests {
            return
        }
        self.statusTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { _ in
            Task { await self.refreshStatusAndModels(forceModelRefresh: false) }
        }
    }

    private func stopStatusTimer() {
        self.statusTimer?.invalidate()
        self.statusTimer = nil
    }

    private func refreshStatusAndModels(forceModelRefresh: Bool) async {
        let wasReachable = self.effectiveAperture.isReachable
        await self.effectiveAperture.checkApertureStatus()
        guard self.effectiveAperture.isReachable else { return }
        if forceModelRefresh || !wasReachable || self.effectiveAperture.availableModels.isEmpty {
            await self.effectiveAperture.fetchModels()
        }
    }
}

#if DEBUG
extension ApertureIntegrationSection {
    mutating func setTestingState(
        enabled: Bool,
        hostname: String = "ai",
        statusMessage: String? = nil)
    {
        self.apertureEnabled = enabled
        self.apertureHostname = hostname
        self.statusMessage = statusMessage
    }

    mutating func setTestingServices(
        tailscale: TailscaleService? = nil,
        aperture: ApertureService? = nil)
    {
        self.testingTailscaleService = tailscale
        self.testingApertureService = aperture
    }

    static func _testApplyDefaultModelSelection(_ modelRef: String, root: inout [String: Any]) {
        self.applyDefaultModelSelection(modelRef, to: &root)
    }

    static func _testApplyApertureConfig(
        enabled: Bool,
        hostname: String,
        providers: [String],
        root: inout [String: Any])
    {
        self.applyApertureConfig(
            enabled: enabled,
            hostname: hostname,
            providers: providers,
            root: &root)
    }
}
#endif
