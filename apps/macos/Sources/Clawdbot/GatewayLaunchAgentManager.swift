import Foundation

enum GatewayLaunchAgentManager {
    private static let logger = Logger(subsystem: "com.clawdbot", category: "gateway.launchd")
    private static let disableLaunchAgentMarker = ".clawdbot/disable-launchagent"

    private static var plistURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents/\(gatewayLaunchdLabel).plist")
    }

<<<<<<< HEAD
    private static var legacyPlistURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents/\(legacyGatewayLaunchdLabel).plist")
    }

    private static func gatewayProgramArguments(
        port: Int,
        bind: String) -> Result<[String], GatewayProgramArgumentsError>
    {
        let projectRoot = CommandResolver.projectRoot()
        #if DEBUG
        if let localBin = CommandResolver.projectClawdbotExecutable(projectRoot: projectRoot) {
            return [localBin, "gateway", "--port", "\(port)", "--bind", bind]
        }
        if let entry = CommandResolver.gatewayEntrypoint(in: projectRoot),
           case let .success(runtime) = CommandResolver.runtimeResolution()
        {
            return CommandResolver.makeRuntimeCommand(
                runtime: runtime,
                entrypoint: entry,
                subcommand: "gateway",
                extraArgs: ["--port", "\(port)", "--bind", bind])
        }
        #endif
        let searchPaths = CommandResolver.preferredPaths()
        if let gatewayBin = CommandResolver.clawdbotExecutable(searchPaths: searchPaths) {
            return .success([gatewayBin, "gateway-daemon", "--port", "\(port)", "--bind", bind])
        }

        if let entry = CommandResolver.gatewayEntrypoint(in: projectRoot),
           case let .success(runtime) = CommandResolver.runtimeResolution(searchPaths: searchPaths)
        {
            let cmd = CommandResolver.makeRuntimeCommand(
                runtime: runtime,
                entrypoint: entry,
                subcommand: "gateway-daemon",
                extraArgs: ["--port", "\(port)", "--bind", bind])
            return .success(cmd)
        }

        return .failure(.message("clawdbot CLI not found in PATH; install the CLI."))
    }

=======
>>>>>>> upstream/main
    static func isLoaded() async -> Bool {
        guard let loaded = await self.readDaemonLoaded() else { return false }
        return loaded
    }

    static func set(enabled: Bool, bundlePath: String, port: Int) async -> String? {
<<<<<<< HEAD
=======
        _ = bundlePath
        guard !CommandResolver.connectionModeIsRemote() else {
            self.logger.info("launchd change skipped (remote mode)")
            return nil
        }
>>>>>>> upstream/main
        if enabled, self.isLaunchAgentWriteDisabled() {
            self.logger.info("launchd enable skipped (disable marker set)")
            return nil
        }

        if enabled {
<<<<<<< HEAD
            _ = await Launchctl.run(["bootout", "gui/\(getuid())/\(self.legacyGatewayLaunchdLabel)"])
            try? FileManager.default.removeItem(at: self.legacyPlistURL)
            let gatewayBin = self.gatewayExecutablePath(bundlePath: bundlePath)
            guard FileManager.default.isExecutableFile(atPath: gatewayBin) else {
                self.logger.error("launchd enable failed: gateway missing at \(gatewayBin)")
                return "Embedded gateway missing in bundle; rebuild via scripts/package-mac-app.sh"
            }

            let desiredBind = self.preferredGatewayBind() ?? "loopback"
            let desiredToken = self.preferredGatewayToken()
            let desiredPassword = self.preferredGatewayPassword()
            let desiredConfig = DesiredConfig(
                port: port,
                bind: desiredBind,
                token: desiredToken,
                password: desiredPassword)
            let programArgumentsResult = self.gatewayProgramArguments(port: port, bind: desiredBind)
            guard case let .success(programArguments) = programArgumentsResult else {
                if case let .failure(error) = programArgumentsResult {
                    let message = error.localizedDescription
                    self.logger.error("launchd enable failed: \(message)")
                    return message
                }
                return "Failed to resolve gateway command."
            }

            // If launchd already loaded the job (common on login), avoid `bootout` unless we must
            // change the config. `bootout` can kill a just-started gateway and cause attach loops.
            let loaded = await self.isLoaded()
            if loaded,
               let existing = self.readPlistConfig(),
               existing.matches(desiredConfig)
            {
                self.logger.info("launchd job already loaded with desired config; skipping bootout")
                await self.ensureEnabled()
                _ = await Launchctl.run(["kickstart", "gui/\(getuid())/\(gatewayLaunchdLabel)"])
                return nil
            }

            self.logger.info("launchd enable requested port=\(port) bind=\(desiredBind)")
            self.writePlist(bundlePath: bundlePath, port: port)

            await self.ensureEnabled()
            if loaded {
                _ = await Launchctl.run(["bootout", "gui/\(getuid())/\(gatewayLaunchdLabel)"])
            }
            let bootstrap = await Launchctl.run(["bootstrap", "gui/\(getuid())", self.plistURL.path])
            if bootstrap.status != 0 {
                let msg = bootstrap.output.trimmingCharacters(in: .whitespacesAndNewlines)
                self.logger.error("launchd bootstrap failed: \(msg)")
                return bootstrap.output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? "Failed to bootstrap gateway launchd job"
                    : bootstrap.output.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            await self.ensureEnabled()
            return nil
=======
            self.logger.info("launchd enable requested via CLI port=\(port)")
            return await self.runDaemonCommand([
                "install",
                "--force",
                "--port",
                "\(port)",
                "--runtime",
                "node",
            ])
>>>>>>> upstream/main
        }

        self.logger.info("launchd disable requested via CLI")
        return await self.runDaemonCommand(["uninstall"])
    }

    static func kickstart() async {
        _ = await self.runDaemonCommand(["restart"], timeout: 20)
    }

<<<<<<< HEAD
    private static func writePlist(bundlePath: String, port: Int) {
        let relayDir = self.relayDir(bundlePath: bundlePath)
        let preferredPath = ([relayDir] + CommandResolver.preferredPaths())
            .joined(separator: ":")
        let bind = self.preferredGatewayBind() ?? "loopback"
        let programArguments = self.gatewayProgramArguments(bundlePath: bundlePath, port: port, bind: bind)
        let token = self.preferredGatewayToken()
        let password = self.preferredGatewayPassword()
        var envEntries = """
            <key>PATH</key>
            <string>\(preferredPath)</string>
            <key>CLAWDBOT_IMAGE_BACKEND</key>
            <string>sips</string>
        """
        if let token {
            let escapedToken = self.escapePlistValue(token)
            envEntries += """
                <key>CLAWDBOT_GATEWAY_TOKEN</key>
                <string>\(escapedToken)</string>
            """
        }
        if let password {
            let escapedPassword = self.escapePlistValue(password)
            envEntries += """
                <key>CLAWDBOT_GATEWAY_PASSWORD</key>
                <string>\(escapedPassword)</string>
            """
        }
        let argsXml = programArguments
            .map { "<string>\(self.escapePlistValue($0))</string>" }
            .joined(separator: "\n            ")
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>Label</key>
          <string>\(gatewayLaunchdLabel)</string>
          <key>ProgramArguments</key>
          <array>
            \(argsXml)
          </array>
          <key>WorkingDirectory</key>
          <string>\(FileManager.default.homeDirectoryForCurrentUser.path)</string>
          <key>RunAtLoad</key>
          <true/>
          <key>KeepAlive</key>
          <true/>
          <key>EnvironmentVariables</key>
          <dict>
        \(envEntries)
          </dict>
          <key>StandardOutPath</key>
          <string>\(LogLocator.launchdGatewayLogPath)</string>
          <key>StandardErrorPath</key>
          <string>\(LogLocator.launchdGatewayLogPath)</string>
        </dict>
        </plist>
        """
        do {
            try plist.write(to: self.plistURL, atomically: true, encoding: .utf8)
        } catch {
            self.logger.error("launchd plist write failed: \(error.localizedDescription)")
        }
=======
    static func launchdConfigSnapshot() -> LaunchAgentPlistSnapshot? {
        LaunchAgentPlist.snapshot(url: self.plistURL)
>>>>>>> upstream/main
    }

    static func launchdGatewayLogPath() -> String {
        let snapshot = self.launchdConfigSnapshot()
        if let stdout = snapshot?.stdoutPath?.trimmingCharacters(in: .whitespacesAndNewlines),
           !stdout.isEmpty
        {
            return stdout
        }
        if let stderr = snapshot?.stderrPath?.trimmingCharacters(in: .whitespacesAndNewlines),
           !stderr.isEmpty
        {
            return stderr
        }
        return LogLocator.launchdGatewayLogPath
    }
}

extension GatewayLaunchAgentManager {
    private static func isLaunchAgentWriteDisabled() -> Bool {
        let marker = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(self.disableLaunchAgentMarker)
        return FileManager.default.fileExists(atPath: marker.path)
    }

<<<<<<< HEAD
#if DEBUG
extension GatewayLaunchAgentManager {
    static func _testGatewayExecutablePath(bundlePath: String) -> String {
        self.gatewayExecutablePath(bundlePath: bundlePath)
    }

    static func _testRelayDir(bundlePath: String) -> String {
        self.relayDir(bundlePath: bundlePath)
    }

    static func _testPreferredGatewayBind() -> String? {
        self.preferredGatewayBind()
=======
    private static func readDaemonLoaded() async -> Bool? {
        let result = await self.runDaemonCommandResult(
            ["status", "--json", "--no-probe"],
            timeout: 15,
            quiet: true)
        guard result.success, let payload = result.payload else { return nil }
        guard
            let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
            let service = json["service"] as? [String: Any],
            let loaded = service["loaded"] as? Bool
        else {
            return nil
        }
        return loaded
>>>>>>> upstream/main
    }

    private struct CommandResult {
        let success: Bool
        let payload: Data?
        let message: String?
    }

    private struct ParsedDaemonJson {
        let text: String
        let object: [String: Any]
    }

    private static func runDaemonCommand(
        _ args: [String],
        timeout: Double = 15,
        quiet: Bool = false) async -> String?
    {
        let result = await self.runDaemonCommandResult(args, timeout: timeout, quiet: quiet)
        if result.success { return nil }
        return result.message ?? "Gateway daemon command failed"
    }

    private static func runDaemonCommandResult(
        _ args: [String],
        timeout: Double,
        quiet: Bool) async -> CommandResult
    {
        let command = CommandResolver.clawdbotCommand(
            subcommand: "daemon",
            extraArgs: self.withJsonFlag(args),
            // Launchd management must always run locally, even if remote mode is configured.
            configRoot: ["gateway": ["mode": "local"]])
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = CommandResolver.preferredPaths().joined(separator: ":")
        let response = await ShellExecutor.runDetailed(command: command, cwd: nil, env: env, timeout: timeout)
        let parsed = self.parseDaemonJson(from: response.stdout) ?? self.parseDaemonJson(from: response.stderr)
        let ok = parsed?.object["ok"] as? Bool
        let message = (parsed?.object["error"] as? String) ?? (parsed?.object["message"] as? String)
        let payload = parsed?.text.data(using: .utf8)
            ?? (response.stdout.isEmpty ? response.stderr : response.stdout).data(using: .utf8)
        let success = ok ?? response.success
        if success {
            return CommandResult(success: true, payload: payload, message: nil)
        }

        if quiet {
            return CommandResult(success: false, payload: payload, message: message)
        }

        let detail = message ?? self.summarize(response.stderr) ?? self.summarize(response.stdout)
        let exit = response.exitCode.map { "exit \($0)" } ?? (response.errorMessage ?? "failed")
        let fullMessage = detail.map { "Gateway daemon command failed (\(exit)): \($0)" }
            ?? "Gateway daemon command failed (\(exit))"
        self.logger.error("\(fullMessage, privacy: .public)")
        return CommandResult(success: false, payload: payload, message: detail)
    }

    private static func withJsonFlag(_ args: [String]) -> [String] {
        if args.contains("--json") { return args }
        return args + ["--json"]
    }

    private static func parseDaemonJson(from raw: String) -> ParsedDaemonJson? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let start = trimmed.firstIndex(of: "{"),
              let end = trimmed.lastIndex(of: "}")
        else {
            return nil
        }
        let jsonText = String(trimmed[start...end])
        guard let data = jsonText.data(using: .utf8) else { return nil }
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return ParsedDaemonJson(text: jsonText, object: object)
    }

    private static func summarize(_ text: String) -> String? {
        let lines = text
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let last = lines.last else { return nil }
        let normalized = last.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return normalized.count > 200 ? String(normalized.prefix(199)) + "…" : normalized
    }
}
