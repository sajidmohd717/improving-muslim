import AVFoundation
import AVKit
import SwiftUI

struct PlayerView: View {
    let item: LectureItem
    @State private var player: AVPlayer

    init(item: LectureItem) {
        self.item = item
        _player = State(initialValue: item.videoURL.map(AVPlayer.init(url:)) ?? AVPlayer())
    }

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VideoPlayer(player: player)
                        .aspectRatio(16 / 9, contentMode: .fit)
                        .background(.black)
                        .accessibilityLabel("Video player for \(item.title)")

                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.context.uppercased())
                            .font(.caption.bold())
                            .foregroundStyle(Brand.accent)
                        Text(item.title)
                            .font(Brand.editorial(.title))
                            .foregroundStyle(Brand.ink)
                        Text(item.speaker)
                            .font(.headline)
                            .foregroundStyle(Brand.muted)
                    }
                    .padding(.horizontal, 16)

                    Divider().overlay(Brand.line).padding(.horizontal, 16)

                    Label("Background playback is enabled", systemImage: "headphones")
                        .font(.subheadline)
                        .foregroundStyle(Brand.muted)
                        .padding(.horizontal, 16)
                }
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("Now playing")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try? AVAudioSession.sharedInstance().setActive(true)
            player.play()
        }
        .onDisappear { player.pause() }
    }
}
