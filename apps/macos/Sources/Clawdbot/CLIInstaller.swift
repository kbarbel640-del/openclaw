import Foundation

@MainActor
enum CLIInstaller {
    private static func embeddedHelperURL() -> URL {
        Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/Relay/clawdbot")
    }

    static func installedLocation() -> String? {
        self.installedLocation(
            searchPaths: cliHelperSearchPaths,
            embeddedHelper: self.embeddedHelperURL(),
            fileManager: .default)
    }

    static func installedLocation(
        searchPaths: [String],
        embeddedHelper: URL,
        fileManager: FileManager) -> String?
    {
        let embedded = embeddedHelper.resolvingSymlinksInPath()

        for basePath in searchPaths {
            let candidate = URL(fileURLWithPath: basePath).appendingPathComponent("clawdbot").path
            var isDirectory: ObjCBool = false

            guard fileManager.fileExists(atPath: candidate, isDirectory: &isDirectory),
                  !isDirectory.boolValue
            else {
                continue
            }

            guard fileManager.isExecutableFile(atPath: candidate) else { continue }

            let resolved = URL(fileURLWithPath: candidate).resolvingSymlinksInPath()
            if resolved == embedded {
                return candidate
            }
        }

        return nil
    }

    static func isInstalled() -> Bool {
        self.installedLocation() != nil
    }

<<<<<<< HEAD
    static func install(statusHandler: @escaping @Sendable (String) async -> Void) async {
        let helper = self.embeddedHelperURL()
        guard FileManager.default.isExecutableFile(atPath: helper.path) else {
            await statusHandler(
                "Embedded CLI missing in bundle; repackage via scripts/package-mac-app.sh " +
                    "(or restart-mac.sh without SKIP_GATEWAY_PACKAGE=1).")
=======
    static func install(statusHandler: @escaping @MainActor @Sendable (String) async -> Void) async {
        let expected = GatewayEnvironment.expectedGatewayVersionString() ?? "latest"
        let prefix = Self.installPrefix()
        await statusHandler("Installing clawdbot CLI…")
        let cmd = self.installScriptCommand(version: expected, prefix: prefix)
        let response = await ShellExecutor.runDetailed(command: cmd, cwd: nil, env: nil, timeout: 900)

        if response.success {
            let parsed = self.parseInstallEvents(response.stdout)
            let installedVersion = parsed.last { $0.event == "done" }?.version
            let summary = installedVersion.map { "Installed clawdbot \($0)." } ?? "Installed clawdbot."
            await statusHandler(summary)
>>>>>>> upstream/main
            return
        }

        let targets = cliHelperSearchPaths.map { "\($0)/clawdbot" }
        let result = await self.privilegedSymlink(source: helper.path, targets: targets)
        await statusHandler(result)
    }

    private static func privilegedSymlink(source: String, targets: [String]) async -> String {
        let escapedSource = self.shellEscape(source)
        let targetList = targets.map(self.shellEscape).joined(separator: " ")
        let cmds = [
            "mkdir -p /usr/local/bin /opt/homebrew/bin",
            targets.map { "ln -sf \(escapedSource) \($0)" }.joined(separator: "; "),
        ].joined(separator: "; ")

        let script = """
        do shell script "\(cmds)" with administrator privileges
        """

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        proc.arguments = ["-e", script]

        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = pipe

        do {
            try proc.run()
            proc.waitUntilExit()
            let data = pipe.fileHandleForReading.readToEndSafely()
            let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if proc.terminationStatus == 0 {
                return output.isEmpty ? "CLI helper linked into \(targetList)" : output
            }
            if output.lowercased().contains("user canceled") {
                return "Install canceled"
            }
            return "Failed to install CLI helper: \(output)"
        } catch {
            return "Failed to run installer: \(error.localizedDescription)"
        }
    }

    private static func shellEscape(_ path: String) -> String {
        "'" + path.replacingOccurrences(of: "'", with: "'\"'\"'") + "'"
    }
}
