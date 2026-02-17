import SwiftUI

struct VisionControlPanelView: View {
    @Environment(VisionNodeAppModel.self) private var appModel
    @Environment(\.openWindow) private var openWindow

    @State private var voiceCommandInput: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(String(localized: "control.title", defaultValue: "OpenClaw Vision Control"))
                .font(.title3)

            statusCard
            surfaceButtons
            languagePicker
            voiceCommandComposer
            talkPad
            gestureGuide
        }
        .padding(18)
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(appModel.statusPillText)
                .font(.headline)
            Text(appModel.statusDetailText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("State: \(appModel.voiceState.rawValue)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var surfaceButtons: some View {
        HStack(spacing: 10) {
            Button(String(localized: "control.open.canvas", defaultValue: "Open Canvas")) {
                appModel.handleGestureIntent(.pinchOnce(.openCanvas))
                openWindow(id: VisionWindowID.canvas)
            }
            Button(String(localized: "control.open.chat", defaultValue: "Open Chat")) {
                appModel.handleGestureIntent(.pinchOnce(.openChat))
                openWindow(id: VisionWindowID.chat)
            }
            Button(String(localized: "control.open.usage", defaultValue: "Open Usage")) {
                appModel.handleGestureIntent(.pinchOnce(.openUsage))
                openWindow(id: VisionWindowID.usage)
            }
        }
        .buttonStyle(.borderedProminent)
    }

    private var languagePicker: some View {
        Picker(String(localized: "control.language", defaultValue: "Language"), selection: Binding(
            get: { appModel.activeLanguage },
            set: { appModel.activeLanguage = $0 }
        )) {
            ForEach(VisionLanguage.allCases) { language in
                Text(language.displayName).tag(language)
            }
        }
        .pickerStyle(.segmented)
    }

    private var voiceCommandComposer: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField(
                String(localized: "control.voice.placeholder", defaultValue: "Try: open chat / 打开画布 / 使用量を表示"),
                text: $voiceCommandInput)
                .textInputAutocapitalization(.never)

            Button(String(localized: "control.voice.send", defaultValue: "Send Voice Command")) {
                appModel.handleVoiceCommand(voiceCommandInput)
                if appModel.isCanvasWindowOpen {
                    openWindow(id: VisionWindowID.canvas)
                }
                if appModel.isChatWindowOpen {
                    openWindow(id: VisionWindowID.chat)
                }
                if appModel.isUsageWindowOpen {
                    openWindow(id: VisionWindowID.usage)
                }
            }
            .buttonStyle(.bordered)
        }
    }

    private var talkPad: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(String(localized: "control.talk.title", defaultValue: "Talk (Pinch-hold fallback)"))
                .font(.subheadline)

            HStack(spacing: 10) {
                Button(appModel.isPushToTalkActive
                    ? String(localized: "control.talk.holding", defaultValue: "Holding…")
                    : String(localized: "control.talk.hold", defaultValue: "Hold to Talk"))
                {
                    // Tap keeps parity with pinch once.
                }
                .buttonStyle(.borderedProminent)
                .onLongPressGesture(minimumDuration: 0.01, pressing: { pressing in
                    if pressing {
                        appModel.handleGestureIntent(.pinchHoldStart)
                    } else {
                        appModel.handleGestureIntent(.pinchHoldEnd)
                    }
                }, perform: {})
                .simultaneousGesture(
                    DragGesture(minimumDistance: 20)
                        .onEnded { value in
                            if value.translation.height > 80 {
                                appModel.handleGestureIntent(.holdDownwardFlickCancel)
                            } else {
                                appModel.handleGestureIntent(.pinchDrag)
                            }
                        }
                )

                Button(String(localized: "control.talk.cancel", defaultValue: "Cancel")) {
                    appModel.handleGestureIntent(.pinchHoldCancel)
                }
                .buttonStyle(.bordered)
            }

            Button(String(localized: "control.simulate.degrade", defaultValue: "Simulate High Latency")) {
                appModel.registerRecognitionSignal(latencySeconds: 3.4, hasError: true, permissionAvailable: true)
            }
            .buttonStyle(.bordered)

            Button(String(localized: "control.simulate.recover", defaultValue: "Simulate Recovery")) {
                appModel.markRecoveryReady()
            }
            .buttonStyle(.bordered)
        }
    }

    private var gestureGuide: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(String(localized: "control.gesture.title", defaultValue: "Gesture Map"))
                .font(.subheadline)
            Text(String(localized: "control.gesture.row1", defaultValue: "Pinch once: open surface / toggle mode"))
            Text(String(localized: "control.gesture.row2", defaultValue: "Pinch-hold: push-to-talk"))
            Text(String(localized: "control.gesture.row3", defaultValue: "Pinch + drag: move control panel"))
            Text(String(localized: "control.gesture.row4", defaultValue: "Two-hand resize: resize windows"))
            Text(String(localized: "control.gesture.row5", defaultValue: "Hold + downward flick: cancel capture"))
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }
}

struct VisionSurfacePlaceholderView: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title2)
            Text(subtitle)
                .foregroundStyle(.secondary)
            Text(String(localized: "surface.placeholder", defaultValue: "This surface is intentionally lightweight for MVP and will be wired to live OpenClaw data during core node integration."))
                .font(.body)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
