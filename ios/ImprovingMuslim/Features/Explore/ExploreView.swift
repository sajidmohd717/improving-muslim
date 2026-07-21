import SwiftUI

struct ExploreView: View {
    let catalog: Catalog

    var body: some View {
        NavigationStack {
            ZStack {
                BrandBackground()
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(catalog.topics) { topic in
                            NavigationLink(value: topic) {
                                HStack(spacing: 14) {
                                    Image(systemName: "sparkles")
                                        .frame(width: 44, height: 44)
                                        .foregroundStyle(Brand.accent)
                                        .background(Brand.accent.opacity(0.1), in: Circle())
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(topic.name)
                                            .font(Brand.editorial(.headline))
                                            .foregroundStyle(Brand.ink)
                                        Text(topic.description)
                                            .font(.subheadline)
                                            .foregroundStyle(Brand.muted)
                                            .multilineTextAlignment(.leading)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundStyle(Brand.muted)
                                }
                                .padding(14)
                                .background(Brand.strongSurface, in: RoundedRectangle(cornerRadius: 8))
                                .overlay { RoundedRectangle(cornerRadius: 8).stroke(Brand.line) }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Explore")
            .navigationDestination(for: Topic.self) { topic in
                TopicLecturesView(topic: topic, items: catalog.playableItems.filter { $0.categories.contains(topic.id) })
            }
            .navigationDestination(for: LectureItem.self) { PlayerView(item: $0) }
        }
    }
}

private struct TopicLecturesView: View {
    let topic: Topic
    let items: [LectureItem]

    var body: some View {
        ZStack {
            BrandBackground()
            ScrollView {
                LazyVStack(spacing: 16) {
                    Text(topic.description)
                        .font(.body)
                        .foregroundStyle(Brand.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(items) { item in
                        NavigationLink(value: item) { LectureCard(item: item) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle(topic.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
