import SwiftUI

struct RemoteArtwork: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeInOut(duration: 0.2))) { phase in
            switch phase {
            case let .success(image):
                image.resizable().scaledToFill()
            case .failure:
                placeholder
            case .empty:
                ZStack {
                    placeholder
                    ProgressView().tint(Brand.accent)
                }
            @unknown default:
                placeholder
            }
        }
        .clipped()
    }

    private var placeholder: some View {
        ZStack {
            Brand.surface
            Image(systemName: "play.rectangle")
                .font(.title)
                .foregroundStyle(Brand.muted)
        }
    }
}
