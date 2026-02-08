import SwiftUI

struct MeetingMenuItems: View {
    @Bindable private var detector = MeetingDetector.shared

    var body: some View {
        if self.detector.meetingDetectionEnabled {
            if let session = self.detector.currentSession {
                self.activeMeetingSection(session: session)
            } else {
                Button {
                    Task { await self.detector.startMeeting() }
                } label: {
                    Label("Start Meeting Notes", systemImage: "text.badge.plus")
                }
            }
        }
    }

    @ViewBuilder
    private func activeMeetingSection(session: MeetingSession) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label {
                HStack {
                    Text(session.title)
                        .lineLimit(1)
                    Spacer()
                    Text(session.formattedDuration)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: "record.circle")
                    .foregroundStyle(.red)
            }
        }
        .disabled(true)

        Button {
            Task { await self.detector.stopMeeting() }
        } label: {
            Label("Stop Meeting Notes", systemImage: "stop.circle")
        }
    }
}
