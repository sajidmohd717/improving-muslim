import SwiftUI

struct SpeakersView: View {
    let catalog: Catalog

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        NavigationStack {
            ZStack {
                BrandBackground()
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(catalog.speakers) { speaker in
                            NavigationLink {
                                SpeakerDetailView(
                                    speaker: speaker,
                                    items: catalog.playableItems.filter { item in
                                        item.speaker == speaker.name
                                    }
                                )
                            } label: {
                                VStack(spacing: 10) {
                                    RemoteArtwork(url: speaker.imageURL)
                                        .frame(width: 86, height: 86)
                                        .clipShape(Circle())
                                    Text(speaker.name)
                                        .font(.headline)
                                        .foregroundStyle(Brand.ink)
                                        .multilineTextAlignment(.center)
                                }
                                .frame(maxWidth: .infinity, minHeight: 142)
                                .padding(12)
                                .background(Brand.strongSurface, in: RoundedRectangle(cornerRadius: 8))
                                .overlay { RoundedRectangle(cornerRadius: 8).stroke(Brand.line) }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Speakers")
            .navigationDestination(for: LectureItem.self) { PlayerView(item: $0) }
        }
    }
}

private struct SpeakerDetailView: View {
    let speaker: Speaker
    let items: [LectureItem]

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                LazyVStack(spacing: 16) {
                    RemoteArtwork(url: speaker.imageURL)
                        .frame(width: 124, height: 124)
                        .clipShape(Circle())
                    Text(speaker.bio)
                        .font(.body)
                        .foregroundStyle(Brand.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    Divider().overlay(Brand.line)
                    ForEach(items) { item in
                        NavigationLink(value: item) { LectureCard(item: item) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle(speaker.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
