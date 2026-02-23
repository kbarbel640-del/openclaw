import Testing
@testable import OpenClaw

@Suite(.serialized)
@MainActor
struct ApertureIntegrationSectionTests {
    @Test
    func modelSelectionWritesPrimaryAndAllowlistEntry() {
        var root: [String: Any] = [:]

        ApertureIntegrationSection._testApplyDefaultModelSelection("openai/gpt-5", root: &root)

        let agents = root["agents"] as? [String: Any] ?? [:]
        let defaults = agents["defaults"] as? [String: Any] ?? [:]
        let model = defaults["model"] as? [String: Any] ?? [:]
        let allowlist = defaults["models"] as? [String: Any] ?? [:]

        #expect(model["primary"] as? String == "openai/gpt-5")
        #expect(allowlist["openai/gpt-5"] as? [String: Any] != nil)
    }

    @Test
    func modelSelectionPreservesExistingAllowlistEntries() {
        var root: [String: Any] = [
            "agents": [
                "defaults": [
                    "models": [
                        "anthropic/claude-3-5-sonnet": ["reasoning": true],
                    ],
                ],
            ],
        ]

        ApertureIntegrationSection._testApplyDefaultModelSelection("openai/gpt-5", root: &root)

        let agents = root["agents"] as? [String: Any] ?? [:]
        let defaults = agents["defaults"] as? [String: Any] ?? [:]
        let allowlist = defaults["models"] as? [String: Any] ?? [:]

        let anthropic = allowlist["anthropic/claude-3-5-sonnet"] as? [String: Any] ?? [:]
        #expect(anthropic["reasoning"] as? Bool == true)
        #expect(allowlist["openai/gpt-5"] as? [String: Any] != nil)
    }

    @Test
    func modelSelectionKeepsExistingEntryShapeForSelectedModel() {
        var root: [String: Any] = [
            "agents": [
                "defaults": [
                    "models": [
                        "openai/gpt-5": ["temperature": 0.2],
                    ],
                ],
            ],
        ]

        ApertureIntegrationSection._testApplyDefaultModelSelection("openai/gpt-5", root: &root)

        let agents = root["agents"] as? [String: Any] ?? [:]
        let defaults = agents["defaults"] as? [String: Any] ?? [:]
        let allowlist = defaults["models"] as? [String: Any] ?? [:]
        let selected = allowlist["openai/gpt-5"] as? [String: Any] ?? [:]

        #expect(selected["temperature"] as? Double == 0.2)
    }

    @Test
    func enablingApertureStoresRestoreSnapshotBeforeRewrite() {
        var root: [String: Any] = [
            "models": [
                "providers": [
                    "openai": [
                        "baseUrl": "https://api.openai.com/v1",
                        "apiKey": "sk-original",
                        "api": "openai-completions",
                    ],
                ],
            ],
        ]

        ApertureIntegrationSection._testApplyApertureConfig(
            enabled: true,
            hostname: "ai",
            providers: ["openai"],
            root: &root)

        let gateway = root["gateway"] as? [String: Any] ?? [:]
        let aperture = gateway["aperture"] as? [String: Any] ?? [:]
        let restore = (aperture["restore"] as? [String: Any])?["openai"] as? [String: Any] ?? [:]

        #expect(restore["baseUrl"] as? String == "https://api.openai.com/v1")
        #expect(restore["apiKey"] as? String == "sk-original")
        #expect(restore["api"] as? String == "openai-completions")

        let models = root["models"] as? [String: Any] ?? [:]
        let providers = models["providers"] as? [String: Any] ?? [:]
        let openAI = providers["openai"] as? [String: Any] ?? [:]
        #expect(openAI["baseUrl"] as? String == "http://ai/v1")
        #expect(openAI["apiKey"] as? String == "-")
    }

    @Test
    func disablingApertureRestoresProviderFromSnapshot() {
        var root: [String: Any] = [
            "models": [
                "providers": [
                    "openai": [
                        "baseUrl": "https://api.openai.com/v1",
                        "apiKey": "sk-original",
                        "api": "openai-completions",
                    ],
                ],
            ],
        ]

        ApertureIntegrationSection._testApplyApertureConfig(
            enabled: true,
            hostname: "ai",
            providers: ["openai"],
            root: &root)
        ApertureIntegrationSection._testApplyApertureConfig(
            enabled: false,
            hostname: "ai",
            providers: ["openai"],
            root: &root)

        let gateway = root["gateway"] as? [String: Any] ?? [:]
        #expect(gateway["aperture"] == nil)

        let models = root["models"] as? [String: Any] ?? [:]
        let providers = models["providers"] as? [String: Any] ?? [:]
        let openAI = providers["openai"] as? [String: Any] ?? [:]
        #expect(openAI["baseUrl"] as? String == "https://api.openai.com/v1")
        #expect(openAI["apiKey"] as? String == "sk-original")
        #expect(openAI["api"] as? String == "openai-completions")
    }

    @Test
    func enablingApertureKeepsExistingRestoreSnapshotWhenAlreadyRouted() {
        var root: [String: Any] = [
            "gateway": [
                "aperture": [
                    "enabled": true,
                    "hostname": "ai",
                    "providers": ["openai"],
                    "restore": [
                        "openai": [
                            "baseUrl": "https://api.openai.com/v1",
                            "apiKey": "sk-original",
                            "api": "openai-completions",
                        ],
                    ],
                ],
            ],
            "models": [
                "providers": [
                    "openai": [
                        "baseUrl": "http://ai/v1",
                        "apiKey": "-",
                        "api": "openai-completions",
                    ],
                ],
            ],
        ]

        ApertureIntegrationSection._testApplyApertureConfig(
            enabled: true,
            hostname: "ai-cvb",
            providers: ["openai"],
            root: &root)

        let gateway = root["gateway"] as? [String: Any] ?? [:]
        let aperture = gateway["aperture"] as? [String: Any] ?? [:]
        let restore = (aperture["restore"] as? [String: Any])?["openai"] as? [String: Any] ?? [:]
        #expect(restore["baseUrl"] as? String == "https://api.openai.com/v1")
        #expect(restore["apiKey"] as? String == "sk-original")
        #expect(restore["api"] as? String == "openai-completions")

        let models = root["models"] as? [String: Any] ?? [:]
        let providers = models["providers"] as? [String: Any] ?? [:]
        let openAI = providers["openai"] as? [String: Any] ?? [:]
        #expect(openAI["baseUrl"] as? String == "http://ai-cvb/v1")
        #expect(openAI["apiKey"] as? String == "-")
    }
}
