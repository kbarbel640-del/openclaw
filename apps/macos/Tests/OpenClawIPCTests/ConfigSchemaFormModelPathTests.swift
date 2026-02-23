import Testing
@testable import OpenClaw

@Suite(.serialized)
struct ConfigSchemaFormModelPathTests {
    @Test
    func mapsTargetedModelPathsToModelFieldKinds() {
        #expect(
            configModelFieldKind(for: [.key("agents"), .key("defaults"), .key("model"), .key("primary")])
                == .chatPrimary)
        #expect(
            configModelFieldKind(for: [.key("agents"), .key("defaults"), .key("model"), .key("fallbacks")])
                == .chatFallbacks)
        #expect(
            configModelFieldKind(
                for: [.key("agents"), .key("defaults"), .key("model"), .key("fallbacks"), .index(0)])
                == .chatFallbacks)
        #expect(
            configModelFieldKind(for: [.key("agents"), .key("defaults"), .key("imageModel"), .key("primary")])
                == .imagePrimary)
        #expect(
            configModelFieldKind(
                for: [.key("agents"), .key("defaults"), .key("imageModel"), .key("fallbacks")])
                == .imageFallbacks)
    }

    @Test
    func doesNotTreatNonModelPathsAsModelFields() {
        #expect(configModelFieldKind(for: [.key("agents"), .key("defaults"), .key("workspace")]) == nil)
        #expect(configModelFieldKind(for: [.key("models"), .key("providers"), .key("openai")]) == nil)
    }
}
