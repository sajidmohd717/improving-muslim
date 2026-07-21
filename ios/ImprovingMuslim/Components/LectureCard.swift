import Foundation
import SwiftUI

struct LectureCard: View {
    let item: LectureItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RemoteArtwork(url: item.thumbnailURL)
                .aspectRatio(16 / 9, contentMode: .fit)
                .overlay(alignment: .bottomTrailing) {
                    if let duration = item.duration {
                        Text(durationLabel(duration))
                            .font(.caption2.bold())
                            .monospacedDigit()
                            .padding(.horizontal, 7)
                            .padding(.vertical, 5)
                            .foregroundStyle(.white)
                            .background(.black.opacity(0.68), in: RoundedRectangle(cornerRadius: 4))
                            .padding(8)
                    }
                }

            VStack(alignment: .leading, spacing: 5) {
                Text(item.context.uppercased())
                    .font(.caption2.bold())
                    .foregroundStyle(Brand.accent)
                    .lineLimit(1)

                Text(item.title)
                    .font(.headline)
                    .foregroundStyle(Brand.ink)
                    .lineLimit(2)

                Text(item.speaker)
                    .font(.subheadline)
                    .foregroundStyle(Brand.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
        }
        .background(Brand.strongSurface)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Brand.line, lineWidth: 1)
        }
        .shadow(color: Brand.ink.opacity(0.08), radius: 14, y: 7)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(item.accessibilityLabel)
        .accessibilityHint("Opens the lecture player")
    }

    private func durationLabel(_ seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let remainingSeconds = seconds % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, remainingSeconds)
            : String(format: "%d:%02d", minutes, remainingSeconds)
    }
}
