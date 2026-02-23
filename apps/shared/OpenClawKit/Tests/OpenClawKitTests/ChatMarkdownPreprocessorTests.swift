import Testing
@testable import OpenClawChatUI

@Suite("ChatMarkdownPreprocessor")
struct ChatMarkdownPreprocessorTests {
    @Test func extractsDataURLImages() {
        let base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////GQAJ+wP/2hN8NwAAAABJRU5ErkJggg=="
        let markdown = """
        Hello

        ![Pixel](data:image/png;base64,\(base64))
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)

        #expect(result.cleaned == "Hello")
        #expect(result.images.count == 1)
        #expect(result.images.first?.image != nil)
    }

    @Test func stripsInboundUntrustedContextBlocks() {
        let markdown = """
        Conversation info (untrusted metadata):
        ```json
        {
          "message_id": "123",
          "sender": "openclaw-ios"
        }
        ```

        Sender (untrusted metadata):
        ```json
        {
          "label": "Razor"
        }
        ```

        Razor?
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)

        #expect(result.cleaned == "Razor?")
    }

    @Test func stripsSingleConversationInfoBlock() {
        let text = """
        Conversation info (untrusted metadata):
        ```json
        {"x": 1}
        ```

        User message
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: text)

        #expect(result.cleaned == "User message")
    }

    @Test func stripsAllKnownInboundMetadataSentinels() {
        let sentinels = [
            "Conversation info (untrusted metadata):",
            "Sender (untrusted metadata):",
            "Thread starter (untrusted, for context):",
            "Replied message (untrusted, for context):",
            "Forwarded message context (untrusted metadata):",
            "Chat history since last reply (untrusted, for context):",
        ]

        for sentinel in sentinels {
            let markdown = """
            \(sentinel)
            ```json
            {"x": 1}
            ```

            User content
            """
            let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)
            #expect(result.cleaned == "User content")
        }
    }

    @Test func preservesNonMetadataJsonFence() {
        let markdown = """
        Here is some json:
        ```json
        {"x": 1}
        ```
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)

        #expect(result.cleaned == markdown.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    @Test func stripsLeadingTimestampPrefix() {
        let markdown = """
        [Fri 2026-02-20 18:45 GMT+1] How's it going?
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)

        #expect(result.cleaned == "How's it going?")
    }

    @Test func stripsLeadingTimestampPrefixWithLocalTimezoneAbbreviation() {
        let markdown = """
        [Mon 2026-02-23 08:15 MST] test gpt5 chat
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)

        #expect(result.cleaned == "test gpt5 chat")
    }

    @Test func stripsLeadingSystemEnvelopeLines() {
        let markdown = """
        System: [2026-02-23 07:55:13 MST] Node: MacBook Pro M3 (192.168.50.57) · app 2026.2.22-2 (14142) · mode local
        System: [2026-02-23 08:15:44 MST] reason connect

        [Mon 2026-02-23 08:15 MST] test gpt5 chat
        """

        let result = ChatMarkdownPreprocessor.preprocess(markdown: markdown)

        #expect(result.cleaned == "test gpt5 chat")
    }

    @Test func extractsInboundMessageIDFromConversationMetadataBlock() {
        let markdown = """
        Conversation info (untrusted metadata):
        ```json
        {
          "message_id": "62C5589F-225B-4340-AB24-FF361C3A071C",
          "sender": "openclaw-macos"
        }
        ```

        test gpt5 chat
        """

        let id = ChatMarkdownPreprocessor.inboundMessageID(markdown: markdown)
        #expect(id == "62C5589F-225B-4340-AB24-FF361C3A071C")
    }
}
