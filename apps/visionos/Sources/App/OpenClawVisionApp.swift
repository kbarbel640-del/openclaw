import SwiftUI

@main
struct OpenClawVisionApp: App {
    @State private var appModel = VisionNodeAppModel()

    var body: some Scene {
        WindowGroup(id: VisionWindowID.controlPanel) {
            VisionControlPanelView()
                .environment(self.appModel)
                .task {
                    self.appModel.activateControlPanel()
                }
        }
        .defaultSize(width: 520, height: 620)

        WindowGroup(id: VisionWindowID.canvas) {
            VisionSurfacePlaceholderView(
                title: String(localized: "surface.canvas.title", defaultValue: "Canvas"),
                subtitle: String(localized: "surface.canvas.subtitle", defaultValue: "Agent-driven workspace surface."))
                .environment(self.appModel)
        }
        .defaultSize(width: 980, height: 700)

        WindowGroup(id: VisionWindowID.chat) {
            VisionSurfacePlaceholderView(
                title: String(localized: "surface.chat.title", defaultValue: "Chat"),
                subtitle: String(localized: "surface.chat.subtitle", defaultValue: "Voice and text conversation surface."))
                .environment(self.appModel)
        }
        .defaultSize(width: 760, height: 640)

        WindowGroup(id: VisionWindowID.usage) {
            VisionSurfacePlaceholderView(
                title: String(localized: "surface.usage.title", defaultValue: "Usage"),
                subtitle: String(localized: "surface.usage.subtitle", defaultValue: "Session token and cost summary."))
                .environment(self.appModel)
        }
        .defaultSize(width: 680, height: 520)
    }
}
