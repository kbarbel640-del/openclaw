import AppKit
import Foundation
import Observation
import os

/// Manages Tailscale Aperture integration and reachability checking.
@Observable
@MainActor
final class ApertureService {
    static let shared = ApertureService()

    /// HTTP request timeout in seconds.
    private static let apiTimeoutInterval: TimeInterval = 5.0

    private let logger = Logger(subsystem: "ai.openclaw", category: "aperture")

    /// Whether the Aperture endpoint is reachable (any HTTP response = reachable).
    private(set) var isReachable = false

    /// The Aperture hostname on the tailnet (e.g., "ai-cvb").
    private(set) var hostname: String = "ai"

    /// Error message if reachability check fails.
    private(set) var statusError: String?

    /// Available models fetched from the Aperture `/v1/models` endpoint.
    private(set) var availableModels: [ApertureModel] = []

    /// Shared session for Aperture probes/model fetches.
    @ObservationIgnored
    private let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = ApertureService.apiTimeoutInterval
        return URLSession(configuration: configuration)
    }()

    /// Providers discovered from Aperture model metadata.
    var discoveredProviders: [String] {
        let providers = Set(self.availableModels.map(\.provider))
        if providers.isEmpty {
            return ["openai"]
        }
        return providers.sorted()
    }

    /// Dashboard URL for the Aperture web UI.
    var dashboardURL: String {
        "http://\(self.hostname)/ui"
    }

    private init() {}

    #if DEBUG
    init(
        isReachable: Bool,
        hostname: String = "ai",
        statusError: String? = nil)
    {
        self.isReachable = isReachable
        self.hostname = hostname
        self.statusError = statusError
    }
    #endif

    /// Check if the Aperture endpoint is reachable.
    /// Any HTTP response (even 4xx) proves the server is alive.
    func checkApertureStatus() async {
        guard let url = URL(string: "http://\(self.hostname)/") else {
            self.isReachable = false
            self.statusError = "Invalid hostname"
            return
        }

        do {
            let (_, _) = try await self.session.data(from: url)
            // Any HTTP response = reachable
            self.isReachable = true
            self.statusError = nil
            self.logger.info("Aperture reachable at \(self.hostname, privacy: .public)")
        } catch {
            self.isReachable = false
            self.statusError = "Aperture not reachable"
            self.logger.debug("Aperture check failed: \(String(describing: error))")
        }
    }

    /// Update the Aperture hostname, trimming whitespace.
    func updateHostname(_ newHostname: String) {
        self.hostname = newHostname.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Fetch available models from the Aperture `/v1/models` endpoint.
    func fetchModels() async {
        guard let url = URL(string: "http://\(self.hostname)/v1/models") else {
            self.logger.debug("Invalid hostname for model fetch")
            return
        }

        do {
            let (data, _) = try await self.session.data(from: url)
            let response = try JSONDecoder().decode(ApertureModelsResponse.self, from: data)
            self.availableModels = response.data
                .map { entry in
                    let provider = Self.normalizeProvider(
                        id: entry.metadata?.provider?.id,
                        name: entry.metadata?.provider?.name)
                    let providerName = entry.metadata?.provider?.name ?? entry.metadata?.provider?.id ?? "Unknown"
                    return ApertureModel(
                        id: entry.id,
                        provider: provider,
                        providerName: providerName,
                        modelRef: "\(provider)/\(entry.id)")
                }
                .sorted { $0.modelRef < $1.modelRef }
            self.logger.info("Fetched \(self.availableModels.count) models from Aperture")
        } catch {
            self.logger.debug("Aperture model fetch failed: \(String(describing: error))")
        }
    }

    /// Open the Aperture dashboard in the default browser.
    func openDashboard() {
        if let url = URL(string: self.dashboardURL) {
            NSWorkspace.shared.open(url)
        }
    }

    private static func normalizeProvider(id: String?, name: String?) -> String {
        let raw = (id?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? name?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? "")
            .lowercased()
        if raw.isEmpty {
            return "openai"
        }

        switch raw {
        case "openai":
            return "openai"
        case "anthropic":
            return "anthropic"
        case "google", "gemini", "google-ai", "google-ai-studio":
            return "google"
        case "openrouter":
            return "openrouter"
        default:
            let sanitized = raw
                .replacingOccurrences(
                    of: "[^a-z0-9._-]+",
                    with: "-",
                    options: .regularExpression)
                .trimmingCharacters(in: CharacterSet(charactersIn: "-."))
            return sanitized.isEmpty ? "openai" : sanitized
        }
    }
}

// MARK: - Model types

struct ApertureModel: Identifiable, Hashable {
    let id: String
    let provider: String
    let providerName: String
    /// Full model ref for OpenClaw config (e.g., "anthropic/claude-opus-4-6").
    let modelRef: String
}

// MARK: - JSON decoding for /v1/models

private struct ApertureModelsResponse: Decodable {
    let data: [ApertureModelEntry]
}

private struct ApertureModelEntry: Decodable {
    let id: String
    let metadata: ApertureModelMetadata?
}

private struct ApertureModelMetadata: Decodable {
    let provider: ApertureProviderInfo?
}

private struct ApertureProviderInfo: Decodable {
    let id: String?
    let name: String?
}
