import Testing
import OpenClawProtocol
@testable import OpenClaw

@Suite(.serialized)
@MainActor
struct ConfigModelOptionsTests {
    @Test
    func mergeGatewayApertureAndConfiguredModels() {
        let gateway: [OpenClawProtocol.ModelChoice] = [
            .init(id: "gpt-5", name: "GPT-5", provider: "openai", contextwindow: nil, reasoning: nil),
            .init(id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", contextwindow: nil, reasoning: nil),
        ]
        let aperture: [ApertureModel] = [
            .init(id: "gpt-5", provider: "openai", providerName: "OpenAI", modelRef: "openai/gpt-5"),
            .init(id: "claude-3-5-sonnet", provider: "anthropic", providerName: "Anthropic", modelRef: "anthropic/claude-3-5-sonnet"),
        ]
        let configured = ["anthropic/claude-3-5-sonnet", "custom/my-model"]

        let snapshot = ConfigModelOptionsState.buildSnapshot(
            configuredModelRefs: configured,
            gatewayModels: gateway,
            apertureModels: aperture,
            includeApertureStatus: true,
            apertureReachable: true)

        #expect(snapshot.options.map(\.modelRef) == [
            "openai/gpt-5",
            "google/gemini-2.5-flash",
            "anthropic/claude-3-5-sonnet",
            "custom/my-model",
        ])
        #expect(snapshot.statusMessage == "Aperture models merged")

        let openAI = snapshot.options.first(where: { $0.modelRef == "openai/gpt-5" })
        let anthropic = snapshot.options.first(where: { $0.modelRef == "anthropic/claude-3-5-sonnet" })
        let custom = snapshot.options.first(where: { $0.modelRef == "custom/my-model" })

        #expect(openAI?.sources == Set([.gatewayCatalog, .apertureCatalog]))
        #expect(anthropic?.sources == Set([.apertureCatalog, .configured]))
        #expect(custom?.sources == Set([.configured]))
    }

    @Test
    func preservesConfiguredCustomModelWhenCatalogsAreEmpty() {
        let snapshot = ConfigModelOptionsState.buildSnapshot(
            configuredModelRefs: ["my-provider/custom-vision"],
            gatewayModels: [],
            apertureModels: [],
            includeApertureStatus: false,
            apertureReachable: nil)

        #expect(snapshot.options.count == 1)
        #expect(snapshot.options.first?.modelRef == "my-provider/custom-vision")
        #expect(snapshot.options.first?.sources == Set([.configured]))
        #expect(snapshot.statusMessage == nil)
    }

    @Test
    func reportsApertureUnreachableFallbackStatus() {
        let gateway: [OpenClawProtocol.ModelChoice] = [
            .init(id: "gpt-5", name: "GPT-5", provider: "openai", contextwindow: nil, reasoning: nil),
        ]

        let snapshot = ConfigModelOptionsState.buildSnapshot(
            configuredModelRefs: ["custom/offline-model"],
            gatewayModels: gateway,
            apertureModels: [],
            includeApertureStatus: true,
            apertureReachable: false)

        #expect(snapshot.statusMessage == "Aperture unreachable; showing configured + catalog models")
        #expect(snapshot.options.map(\.modelRef) == ["openai/gpt-5", "custom/offline-model"])
    }

    @Test
    func extractsConfiguredModelRefsFromDefaults() {
        let root: [String: Any] = [
            "agents": [
                "defaults": [
                    "model": [
                        "primary": "openai/gpt-5",
                        "fallbacks": ["anthropic/claude-3-5-sonnet", "google/gemini-2.5-pro"],
                    ],
                    "imageModel": [
                        "primary": "openai/gpt-image-1",
                        "fallbacks": ["openai/gpt-image-1-mini"],
                    ],
                    "models": [
                        "zeta/custom": [:],
                        "alpha/custom": [:],
                    ],
                ],
            ],
        ]

        let refs = ConfigModelOptionsState.configuredModelRefs(from: root)

        #expect(refs == [
            "openai/gpt-5",
            "anthropic/claude-3-5-sonnet",
            "google/gemini-2.5-pro",
            "openai/gpt-image-1",
            "openai/gpt-image-1-mini",
            "alpha/custom",
            "zeta/custom",
        ])
    }
}
