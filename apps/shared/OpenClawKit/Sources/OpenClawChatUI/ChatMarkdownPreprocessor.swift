import Foundation

enum ChatMarkdownPreprocessor {
    // Keep in sync with `src/auto-reply/reply/strip-inbound-meta.ts`
    // (`INBOUND_META_SENTINELS`), and extend parser expectations in
    // `ChatMarkdownPreprocessorTests` when sentinels change.
    private static let inboundContextHeaders = [
        "Conversation info (untrusted metadata):",
        "Sender (untrusted metadata):",
        "Thread starter (untrusted, for context):",
        "Replied message (untrusted, for context):",
        "Forwarded message context (untrusted metadata):",
        "Chat history since last reply (untrusted, for context):",
    ]

    struct InlineImage: Identifiable {
        let id = UUID()
        let label: String
        let image: OpenClawPlatformImage?
    }

    struct Result {
        let cleaned: String
        let images: [InlineImage]
    }

    static func preprocess(markdown raw: String) -> Result {
        let withoutSystemEnvelope = self.stripLeadingSystemEnvelopeLines(raw)
        let withoutContextBlocks = self.stripInboundContextBlocks(withoutSystemEnvelope)
        let withoutTimestamps = self.stripPrefixedTimestamps(withoutContextBlocks)
        let pattern = #"!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)"#
        guard let re = try? NSRegularExpression(pattern: pattern) else {
            return Result(cleaned: self.normalize(withoutTimestamps), images: [])
        }

        let ns = withoutTimestamps as NSString
        let matches = re.matches(
            in: withoutTimestamps,
            range: NSRange(location: 0, length: ns.length))
        if matches.isEmpty { return Result(cleaned: self.normalize(withoutTimestamps), images: []) }

        var images: [InlineImage] = []
        var cleaned = withoutTimestamps

        for match in matches.reversed() {
            guard match.numberOfRanges >= 3 else { continue }
            let label = ns.substring(with: match.range(at: 1))
            let dataURL = ns.substring(with: match.range(at: 2))

            let image: OpenClawPlatformImage? = {
                guard let comma = dataURL.firstIndex(of: ",") else { return nil }
                let b64 = String(dataURL[dataURL.index(after: comma)...])
                guard let data = Data(base64Encoded: b64) else { return nil }
                return OpenClawPlatformImage(data: data)
            }()
            images.append(InlineImage(label: label, image: image))

            let start = cleaned.index(cleaned.startIndex, offsetBy: match.range.location)
            let end = cleaned.index(start, offsetBy: match.range.length)
            cleaned.replaceSubrange(start..<end, with: "")
        }

        return Result(cleaned: self.normalize(cleaned), images: images.reversed())
    }

    static func inboundMessageID(markdown raw: String) -> String? {
        let normalized = raw.replacingOccurrences(of: "\r\n", with: "\n")
        let jsonPattern = #""message_id"\s*:\s*"([^"]+)""#
        if let match = normalized.firstRegexCapture(pattern: jsonPattern) {
            let trimmed = match.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }

        let tagPattern = #"(?m)^\s*\[message_id:\s*([^\]]+)\]\s*$"#
        if let match = normalized.firstRegexCapture(pattern: tagPattern) {
            let trimmed = match.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }

        return nil
    }

    private static func stripLeadingSystemEnvelopeLines(_ raw: String) -> String {
        let normalized = raw.replacingOccurrences(of: "\r\n", with: "\n")
        let lines = normalized.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        guard !lines.isEmpty else { return normalized }

        var index = 0
        var removedAny = false
        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                if removedAny {
                    index += 1
                    continue
                }
                break
            }
            guard trimmed.hasPrefix("System: [") else {
                break
            }
            removedAny = true
            index += 1
        }

        guard removedAny else { return normalized }
        return lines[index...]
            .joined(separator: "\n")
            .replacingOccurrences(of: #"^\n+"#, with: "", options: .regularExpression)
    }

    private static func stripInboundContextBlocks(_ raw: String) -> String {
        guard self.inboundContextHeaders.contains(where: raw.contains) else {
            return raw
        }

        let normalized = raw.replacingOccurrences(of: "\r\n", with: "\n")
        var outputLines: [String] = []
        var inMetaBlock = false
        var inFencedJson = false

        for line in normalized.split(separator: "\n", omittingEmptySubsequences: false) {
            let currentLine = String(line)

            if !inMetaBlock && self.inboundContextHeaders.contains(where: currentLine.hasPrefix) {
                inMetaBlock = true
                inFencedJson = false
                continue
            }

            if inMetaBlock {
                if !inFencedJson && currentLine.trimmingCharacters(in: .whitespacesAndNewlines) == "```json" {
                    inFencedJson = true
                    continue
                }

                if inFencedJson {
                    if currentLine.trimmingCharacters(in: .whitespacesAndNewlines) == "```" {
                        inMetaBlock = false
                        inFencedJson = false
                    }
                    continue
                }

                if currentLine.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    continue
                }

                inMetaBlock = false
            }

            outputLines.append(currentLine)
        }

        return outputLines.joined(separator: "\n").replacingOccurrences(of: #"^\n+"#, with: "", options: .regularExpression)
    }

    private static func stripPrefixedTimestamps(_ raw: String) -> String {
        let pattern = #"(?m)^\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?\s+[^\]]+\]\s*"#
        return raw.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
    }

    private static func normalize(_ raw: String) -> String {
        var output = raw
        output = output.replacingOccurrences(of: "\r\n", with: "\n")
        output = output.replacingOccurrences(of: "\n\n\n", with: "\n\n")
        output = output.replacingOccurrences(of: "\n\n\n", with: "\n\n")
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private extension String {
    func firstRegexCapture(pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let ns = self as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = regex.firstMatch(in: self, range: range), match.numberOfRanges > 1 else {
            return nil
        }
        return ns.substring(with: match.range(at: 1))
    }
}
