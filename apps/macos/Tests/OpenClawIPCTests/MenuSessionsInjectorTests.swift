import AppKit
import Testing
@testable import OpenClaw

@Suite(.serialized)
@MainActor
struct MenuSessionsInjectorTests {
    @Test func injectsDisconnectedMessage() {
        let injector = MenuSessionsInjector()
        injector.setTestingControlChannelConnected(false)
        injector.setTestingSnapshot(nil, errorText: nil)

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Header", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Send Heartbeats", action: nil, keyEquivalent: ""))

        injector.injectForTesting(into: menu)
        #expect(menu.items.contains { $0.tag == 9_415_557 })
    }

    @Test func injectsSessionRows() {
        let injector = MenuSessionsInjector()
        injector.setTestingControlChannelConnected(true)

        let defaults = SessionDefaults(model: "anthropic/claude-opus-4-6", contextTokens: 200_000)
        let rows = [
            SessionRow(
                id: "main",
                key: "main",
                kind: .direct,
                displayName: nil,
                provider: nil,
                subject: nil,
                room: nil,
                space: nil,
                updatedAt: Date(),
                sessionId: "s1",
                thinkingLevel: "low",
                verboseLevel: nil,
                systemSent: false,
                abortedLastRun: false,
                tokens: SessionTokenStats(input: 10, output: 20, total: 30, contextTokens: 200_000),
                model: "claude-opus-4-6"),
            SessionRow(
                id: "discord:group:alpha",
                key: "discord:group:alpha",
                kind: .group,
                displayName: nil,
                provider: nil,
                subject: nil,
                room: nil,
                space: nil,
                updatedAt: Date(timeIntervalSinceNow: -60),
                sessionId: "s2",
                thinkingLevel: "high",
                verboseLevel: "debug",
                systemSent: true,
                abortedLastRun: true,
                tokens: SessionTokenStats(input: 50, output: 50, total: 100, contextTokens: 200_000),
                model: "claude-opus-4-6"),
        ]
        let snapshot = SessionStoreSnapshot(
            storePath: "/tmp/sessions.json",
            defaults: defaults,
            rows: rows)
        injector.setTestingSnapshot(snapshot, errorText: nil)

        let usage = GatewayUsageSummary(
            updatedAt: Date().timeIntervalSince1970 * 1000,
            providers: [
                GatewayUsageProvider(
                    provider: "anthropic",
                    displayName: "Claude",
                    windows: [GatewayUsageWindow(label: "5h", usedPercent: 12, resetAt: nil)],
                    plan: "Pro",
                    error: nil),
                GatewayUsageProvider(
                    provider: "openai-codex",
                    displayName: "Codex",
                    windows: [GatewayUsageWindow(label: "day", usedPercent: 3, resetAt: nil)],
                    plan: nil,
                    error: nil),
            ])
        injector.setTestingUsageSummary(usage, errorText: nil)

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Header", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Send Heartbeats", action: nil, keyEquivalent: ""))

        injector.injectForTesting(into: menu)
        #expect(menu.items.contains { $0.tag == 9_415_557 })
        #expect(menu.items.contains { $0.tag == 9_415_557 && $0.isSeparatorItem })
    }

    @Test func costUsageSubmenuDoesNotUseInjectorDelegate() {
        let injector = MenuSessionsInjector()
        injector.setTestingControlChannelConnected(true)

        let summary = GatewayCostUsageSummary(
            updatedAt: Date().timeIntervalSince1970 * 1000,
            days: 1,
            daily: [
                GatewayCostUsageDay(
                    date: "2026-02-24",
                    input: 10,
                    output: 20,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 30,
                    totalCost: 0.12,
                    missingCostEntries: 0),
            ],
            totals: GatewayCostUsageTotals(
                input: 10,
                output: 20,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 30,
                totalCost: 0.12,
                missingCostEntries: 0))
        injector.setTestingCostUsageSummary(summary, errorText: nil)

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Header", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Send Heartbeats", action: nil, keyEquivalent: ""))

        injector.injectForTesting(into: menu)

        let usageCostItem = menu.items.first { $0.title == "Usage cost (30 days)" }
        #expect(usageCostItem != nil)
        #expect(usageCostItem?.submenu != nil)
        #expect(usageCostItem?.submenu?.delegate == nil)
    }

    @Test func cronSessionsAreHiddenByDefaultWhenHideCronEnabled() {
        let injector = MenuSessionsInjector()
        injector.setTestingControlChannelConnected(true)
        injector.hideCronSessions = true

        let defaults = SessionDefaults(model: "anthropic/claude-opus-4-6", contextTokens: 200_000)
        let rows = [
            SessionRow(
                id: "main",
                key: "main",
                kind: .direct,
                displayName: nil,
                provider: nil,
                subject: nil,
                room: nil,
                space: nil,
                updatedAt: Date(),
                sessionId: "s1",
                thinkingLevel: nil,
                verboseLevel: nil,
                systemSent: false,
                abortedLastRun: false,
                tokens: SessionTokenStats(input: 10, output: 20, total: 30, contextTokens: 200_000),
                model: nil),
            SessionRow(
                id: "cron:abc123",
                key: "cron:abc123",
                kind: .cron,
                displayName: nil,
                provider: nil,
                subject: nil,
                room: nil,
                space: nil,
                updatedAt: Date(),
                sessionId: "s2",
                thinkingLevel: nil,
                verboseLevel: nil,
                systemSent: false,
                abortedLastRun: false,
                tokens: SessionTokenStats(input: 0, output: 1, total: 1, contextTokens: 200_000),
                model: nil),
        ]
        let snapshot = SessionStoreSnapshot(
            storePath: "/tmp/sessions.json",
            defaults: defaults,
            rows: rows)
        injector.setTestingSnapshot(snapshot, errorText: nil)

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Header", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Send Heartbeats", action: nil, keyEquivalent: ""))

        injector.injectForTesting(into: menu)

        // Cron session item should NOT appear in menu
        let cronItem = menu.items.first { item in
            guard let view = item.view else { return false }
            return view.debugDescription.contains("cron:abc123")
        }
        #expect(cronItem == nil)

        // The "Show Cron Sessions" toggle should appear
        let toggleItem = menu.items.first { $0.title == "Show Cron Sessions" }
        #expect(toggleItem != nil)
        #expect(toggleItem?.state == .on)
    }

    @Test func cronSessionsAreVisibleWhenHideCronDisabled() {
        let injector = MenuSessionsInjector()
        injector.setTestingControlChannelConnected(true)
        injector.hideCronSessions = false

        let defaults = SessionDefaults(model: "anthropic/claude-opus-4-6", contextTokens: 200_000)
        let rows = [
            SessionRow(
                id: "cron:abc123",
                key: "cron:abc123",
                kind: .cron,
                displayName: nil,
                provider: nil,
                subject: nil,
                room: nil,
                space: nil,
                updatedAt: Date(),
                sessionId: "s2",
                thinkingLevel: nil,
                verboseLevel: nil,
                systemSent: false,
                abortedLastRun: false,
                tokens: SessionTokenStats(input: 0, output: 1, total: 1, contextTokens: 200_000),
                model: nil),
        ]
        let snapshot = SessionStoreSnapshot(
            storePath: "/tmp/sessions.json",
            defaults: defaults,
            rows: rows)
        injector.setTestingSnapshot(snapshot, errorText: nil)

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Header", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Send Heartbeats", action: nil, keyEquivalent: ""))

        injector.injectForTesting(into: menu)

        // The "Hide Cron Sessions" toggle should appear (showing it can be enabled)
        let toggleItem = menu.items.first { $0.title == "Hide Cron Sessions" }
        #expect(toggleItem != nil)
        #expect(toggleItem?.state == .off)
    }
}
