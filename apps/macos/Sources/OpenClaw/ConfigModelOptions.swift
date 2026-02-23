import Foundation
import Observation
import OpenClawProtocol

enum ConfigModelFieldKind: String {
    case chatPrimary = "agents.defaults.model.primary"
    case chatFallbacks = "agents.defaults.model.fallbacks"
    case imagePrimary = "agents.defaults.imageModel.primary"
    case imageFallbacks = "agents.defaults.imageModel.fallbacks"

    var isPrimary: Bool {
        self == .chatPrimary || self == .imagePrimary
    }

    var isFallbacks: Bool {
        self == .chatFallbacks || self == .imageFallbacks
    }
}

func configModelFieldKind(for path: ConfigPath) -> ConfigModelFieldKind? {
    ConfigModelFieldKind(rawValue: pathKey(path))
}

struct ConfigModelOption: Identifiable, Hashable {
    enum Source: Hashable {
        case gatewayCatalog
        case apertureCatalog
        case configured
    }

    let modelRef: String
    let provider: String
    let modelID: String
    var sources: Set<Source>

    var id: String {
        self.canonicalKey
    }

    var canonicalKey: String {
        Self.canonicalKey(for: self.modelRef)
    }

    static func from(modelRef rawModelRef: String, source: Source) -> ConfigModelOption? {
        let trimmed = rawModelRef.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let slash = trimmed.firstIndex(of: "/"), slash != trimmed.startIndex {
            let provider = String(trimmed[..<slash]).trimmingCharacters(in: .whitespacesAndNewlines)
            let model = String(trimmed[trimmed.index(after: slash)...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !provider.isEmpty, !model.isEmpty else { return nil }
            return ConfigModelOption(
                modelRef: "\(provider.lowercased())/\(model)",
                provider: provider.lowercased(),
                modelID: model,
                sources: [source])
        }

        return ConfigModelOption(
            modelRef: trimmed,
            provider: "custom",
            modelID: trimmed,
            sources: [source])
    }

    static func from(provider rawProvider: String, modelID rawModelID: String, source: Source) -> ConfigModelOption? {
        let provider = rawProvider
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let modelID = rawModelID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !provider.isEmpty, !modelID.isEmpty else { return nil }
        return ConfigModelOption(
            modelRef: "\(provider)/\(modelID)",
            provider: provider,
            modelID: modelID,
            sources: [source])
    }

    static func canonicalKey(for modelRef: String) -> String {
        modelRef.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

struct ConfigApertureModelsFetchResult {
    let reachable: Bool
    let models: [ApertureModel]
}

struct ConfigModelOptionsSnapshot {
    let options: [ConfigModelOption]
    let statusMessage: String?
}

@MainActor
@Observable
final class ConfigModelOptionsState {
    private(set) var options: [ConfigModelOption] = []
    private(set) var statusMessage: String?
    private(set) var isRefreshing = false

    @ObservationIgnored private var refreshGeneration = 0

    func refresh(
        configDraft: [String: Any],
        connectionMode: AppState.ConnectionMode,
        gatewayModelsFetcher: (() async -> [OpenClawProtocol.ModelChoice])? = nil,
        apertureModelsFetcher: ((String) async -> ConfigApertureModelsFetchResult)? = nil) async
    {
        self.refreshGeneration += 1
        let generation = self.refreshGeneration
        self.isRefreshing = true
        defer {
            if generation == self.refreshGeneration {
                self.isRefreshing = false
            }
        }

        let configuredModelRefs = Self.configuredModelRefs(from: configDraft)
        let gatewayModels = await (gatewayModelsFetcher ?? Self.fetchGatewayModels)()

        let apertureEnabled = Self.apertureEnabled(in: configDraft)
        let includeApertureStatus = connectionMode == .local && apertureEnabled
        var apertureResult: ConfigApertureModelsFetchResult?

        if includeApertureStatus {
            let hostname = Self.apertureHostname(in: configDraft)
            apertureResult = await (apertureModelsFetcher ?? Self.fetchApertureModels)(hostname)
        }

        let snapshot = Self.buildSnapshot(
            configuredModelRefs: configuredModelRefs,
            gatewayModels: gatewayModels,
            apertureModels: apertureResult?.models ?? [],
            includeApertureStatus: includeApertureStatus,
            apertureReachable: apertureResult?.reachable)

        guard generation == self.refreshGeneration else { return }
        self.options = snapshot.options
        self.statusMessage = snapshot.statusMessage
    }

    static func configuredModelRefs(from root: [String: Any]) -> [String] {
        let agents = root["agents"] as? [String: Any] ?? [:]
        let defaults = agents["defaults"] as? [String: Any] ?? [:]
        var refs: [String] = []

        func appendModelRef(_ raw: Any?) {
            let text: String?
            if let rawString = raw as? String {
                text = rawString
            } else {
                text = nil
            }
            guard let text else { return }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            refs.append(trimmed)
        }

        let modelDefaults = defaults["model"] as? [String: Any] ?? [:]
        let imageDefaults = defaults["imageModel"] as? [String: Any] ?? [:]

        appendModelRef(modelDefaults["primary"])
        for raw in modelDefaults["fallbacks"] as? [Any] ?? [] {
            appendModelRef(raw)
        }
        appendModelRef(imageDefaults["primary"])
        for raw in imageDefaults["fallbacks"] as? [Any] ?? [] {
            appendModelRef(raw)
        }

        if let modelAllowlist = defaults["models"] as? [String: Any] {
            for modelRef in modelAllowlist.keys.sorted() {
                appendModelRef(modelRef)
            }
        }

        return refs
    }

    static func apertureEnabled(in root: [String: Any]) -> Bool {
        let gateway = root["gateway"] as? [String: Any] ?? [:]
        let aperture = gateway["aperture"] as? [String: Any] ?? [:]
        return aperture["enabled"] as? Bool ?? false
    }

    static func apertureHostname(in root: [String: Any]) -> String {
        let gateway = root["gateway"] as? [String: Any] ?? [:]
        let aperture = gateway["aperture"] as? [String: Any] ?? [:]
        let hostname = (aperture["hostname"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return hostname.isEmpty ? "ai" : hostname
    }

    static func buildSnapshot(
        configuredModelRefs: [String],
        gatewayModels: [OpenClawProtocol.ModelChoice],
        apertureModels: [ApertureModel],
        includeApertureStatus: Bool,
        apertureReachable: Bool?) -> ConfigModelOptionsSnapshot
    {
        var ordered: [ConfigModelOption] = []
        var indicesByKey: [String: Int] = [:]

        func append(_ option: ConfigModelOption?) {
            guard let option else { return }
            let key = option.canonicalKey
            if let existingIndex = indicesByKey[key] {
                var existing = ordered[existingIndex]
                existing.sources.formUnion(option.sources)
                ordered[existingIndex] = existing
                return
            }
            indicesByKey[key] = ordered.count
            ordered.append(option)
        }

        for model in gatewayModels {
            append(ConfigModelOption.from(provider: model.provider, modelID: model.id, source: .gatewayCatalog))
        }

        for model in apertureModels {
            append(ConfigModelOption.from(provider: model.provider, modelID: model.id, source: .apertureCatalog))
        }

        for modelRef in configuredModelRefs {
            append(ConfigModelOption.from(modelRef: modelRef, source: .configured))
        }

        let statusMessage: String?
        if includeApertureStatus {
            if apertureReachable == true {
                statusMessage = "Aperture models merged"
            } else if apertureReachable == false {
                statusMessage = "Aperture unreachable; showing configured + catalog models"
            } else {
                statusMessage = nil
            }
        } else {
            statusMessage = nil
        }

        return ConfigModelOptionsSnapshot(options: ordered, statusMessage: statusMessage)
    }

    private static func fetchGatewayModels() async -> [OpenClawProtocol.ModelChoice] {
        do {
            let result: ModelsListResult = try await GatewayConnection.shared.requestDecoded(
                method: .modelsList,
                params: nil,
                timeoutMs: 8000)
            return result.models
        } catch {
            return []
        }
    }

    private static func fetchApertureModels(_ hostname: String) async -> ConfigApertureModelsFetchResult {
        let service = ApertureService.shared
        service.updateHostname(hostname)
        await service.checkApertureStatus()
        guard service.isReachable else {
            return ConfigApertureModelsFetchResult(reachable: false, models: [])
        }
        await service.fetchModels()
        return ConfigApertureModelsFetchResult(reachable: true, models: service.availableModels)
    }
}
