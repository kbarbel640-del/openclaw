import AppKit
import Foundation
import OpenClawDiscovery
import OpenClawIPC
import SwiftUI

extension OnboardingView {
    @MainActor
    func applyManualRemoteGatewayTokenInput(_ raw: String) {
        switch OpenClawConfigFile.setRemoteGatewayToken(raw) {
        case .set, .cleared, .unchanged:
            if let message = self.remoteTokenImportMessage, message.hasPrefix("Token rejected") {
                self.remoteTokenImportMessage = nil
            }
        case .rejectedInvalid:
            NSSound.beep()
            withAnimation(.easeInOut(duration: 0.35)) {
                self.remoteTokenImportShakeCount += 1
            }
            self.remoteTokenImportMessage =
                "Token rejected. Paste the raw gateway token or a dashboard URL containing #token=..."
        }
    }

    func selectLocalGateway() {
        self.state.connectionMode = .local
        self.preferredGatewayID = nil
        self.showAdvancedConnection = false
        self.remoteTokenImportMessage = nil
        GatewayDiscoveryPreferences.setPreferredStableID(nil)
    }

    func selectUnconfiguredGateway() {
        Task { await self.onboardingWizard.cancelIfRunning() }
        self.state.connectionMode = .unconfigured
        self.preferredGatewayID = nil
        self.showAdvancedConnection = false
        self.remoteTokenImportMessage = nil
        GatewayDiscoveryPreferences.setPreferredStableID(nil)
    }

    func selectRemoteGateway(_ gateway: GatewayDiscoveryModel.DiscoveredGateway) {
        Task { await self.onboardingWizard.cancelIfRunning() }
        self.preferredGatewayID = gateway.stableID
        GatewayDiscoveryPreferences.setPreferredStableID(gateway.stableID)

        if self.state.remoteTransport == .direct {
            self.state.remoteUrl = GatewayDiscoveryHelpers.directUrl(for: gateway) ?? ""
        } else {
            self.state.remoteTarget = GatewayDiscoveryHelpers.sshTarget(for: gateway) ?? ""
        }
        if let endpoint = GatewayDiscoveryHelpers.serviceEndpoint(for: gateway) {
            OpenClawConfigFile.setRemoteGatewayUrl(
                host: endpoint.host,
                port: endpoint.port)
        } else {
            OpenClawConfigFile.clearRemoteGatewayUrl()
        }

        self.state.connectionMode = .remote
        self.remoteTokenImportMessage = nil
        MacNodeModeCoordinator.shared.setPreferredGatewayStableID(gateway.stableID)
    }

    @MainActor
    func importRemoteGatewayTokenFromClipboard() {
        let clipboard = NSPasteboard.general.string(forType: .string) ?? ""
        let previousToken = OpenClawConfigFile.remoteGatewayToken() ?? ""
        guard let token = OpenClawConfigFile.extractGatewayToken(clipboard) else {
            NSSound.beep()
            withAnimation(.easeInOut(duration: 0.35)) {
                self.remoteTokenImportShakeCount += 1
            }
            if !previousToken.isEmpty {
                self.remoteTokenImportMessage =
                    "Clipboard import rejected (no token found). Kept your existing gateway token. To import a token run `openclaw dashboard --no-open` on the gateway host and copy the URL containing #token=..."
            } else {
                self.remoteTokenImportMessage =
                    "Clipboard has no gateway token. On the gateway host run `openclaw dashboard --no-open`, copy the URL containing #token=..., then import again."
            }
            return
        }
        if token == previousToken {
            self.remoteTokenImportMessage = "Clipboard token already matches your current gateway token. No changes made."
            return
        }
        switch OpenClawConfigFile.setRemoteGatewayToken(token) {
        case .set:
            self.remoteTokenImportMessage = "Saved gateway.remote.token from clipboard."
        case .unchanged:
            self.remoteTokenImportMessage = "Clipboard token already matches your current gateway token. No changes made."
        case .rejectedInvalid:
            NSSound.beep()
            withAnimation(.easeInOut(duration: 0.35)) {
                self.remoteTokenImportShakeCount += 1
            }
            self.remoteTokenImportMessage =
                "Token rejected. Paste the raw gateway token or a dashboard URL containing #token=..."
        case .cleared:
            self.remoteTokenImportMessage =
                "Clipboard import rejected. Existing token was kept."
        }
    }

    func openSettings(tab: SettingsTab) {
        SettingsTabRouter.request(tab)
        self.openSettings()
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .openclawSelectSettingsTab, object: tab)
        }
    }

    func handleBack() {
        withAnimation {
            self.currentPage = max(0, self.currentPage - 1)
        }
    }

    func handleNext() {
        if self.isWizardBlocking { return }
        if self.currentPage < self.pageCount - 1 {
            withAnimation { self.currentPage += 1 }
        } else {
            self.finish()
        }
    }

    func finish() {
        UserDefaults.standard.set(true, forKey: "openclaw.onboardingSeen")
        UserDefaults.standard.set(currentOnboardingVersion, forKey: onboardingVersionKey)
        OnboardingController.shared.close()
    }

    func copyToPasteboard(_ text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
        self.copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { self.copied = false }
    }

    func startAnthropicOAuth() {
        guard !self.anthropicAuthBusy else { return }
        self.anthropicAuthBusy = true
        defer { self.anthropicAuthBusy = false }

        do {
            let pkce = try AnthropicOAuth.generatePKCE()
            self.anthropicAuthPKCE = pkce
            let url = AnthropicOAuth.buildAuthorizeURL(pkce: pkce)
            NSWorkspace.shared.open(url)
            self.anthropicAuthStatus = "Browser opened. After approving, paste the `code#state` value here."
        } catch {
            self.anthropicAuthStatus = "Failed to start OAuth: \(error.localizedDescription)"
        }
    }

    @MainActor
    func finishAnthropicOAuth() async {
        guard !self.anthropicAuthBusy else { return }
        guard let pkce = self.anthropicAuthPKCE else { return }
        self.anthropicAuthBusy = true
        defer { self.anthropicAuthBusy = false }

        guard let parsed = AnthropicOAuthCodeState.parse(from: self.anthropicAuthCode) else {
            self.anthropicAuthStatus = "OAuth failed: missing or invalid code/state."
            return
        }

        do {
            let creds = try await AnthropicOAuth.exchangeCode(
                code: parsed.code,
                state: parsed.state,
                verifier: pkce.verifier)
            try OpenClawOAuthStore.saveAnthropicOAuth(creds)
            self.refreshAnthropicOAuthStatus()
            self.anthropicAuthStatus = "Connected. OpenClaw can now use Claude."
        } catch {
            self.anthropicAuthStatus = "OAuth failed: \(error.localizedDescription)"
        }
    }

    func pollAnthropicClipboardIfNeeded() {
        guard self.currentPage == self.anthropicAuthPageIndex else { return }
        guard self.anthropicAuthPKCE != nil else { return }
        guard !self.anthropicAuthBusy else { return }
        guard self.anthropicAuthAutoDetectClipboard else { return }

        let pb = NSPasteboard.general
        let changeCount = pb.changeCount
        guard changeCount != self.anthropicAuthLastPasteboardChangeCount else { return }
        self.anthropicAuthLastPasteboardChangeCount = changeCount

        guard let raw = pb.string(forType: .string), !raw.isEmpty else { return }
        guard let parsed = AnthropicOAuthCodeState.parse(from: raw) else { return }
        guard let pkce = self.anthropicAuthPKCE, parsed.state == pkce.verifier else { return }

        let next = "\(parsed.code)#\(parsed.state)"
        if self.anthropicAuthCode != next {
            self.anthropicAuthCode = next
            self.anthropicAuthStatus = "Detected `code#state` from clipboard."
        }

        guard self.anthropicAuthAutoConnectClipboard else { return }
        Task { await self.finishAnthropicOAuth() }
    }
}
