import SwiftUI

struct HomeView: View {
    let catalog: Catalog

    @State private var query = ""
    @State private var selectedTopic: String?
    @State private var discoveryOrder: [String] = []

    private var visibleItems: [LectureItem] {
        let byID = Dictionary(uniqueKeysWithValues: catalog.playableItems.map { ($0.id, $0) })
        let ordered = discoveryOrder.compactMap { byID[$0] }
        let base = ordered.isEmpty ? catalog.playableItems : ordered
        return base.filter { item in
            let matchesTopic = selectedTopic == nil || item.categories.contains(selectedTopic!)
            let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesQuery = normalizedQuery.isEmpty
                || item.title.localizedCaseInsensitiveContains(normalizedQuery)
                || item.speaker.localizedCaseInsensitiveContains(normalizedQuery)
                || item.context.localizedCaseInsensitiveContains(normalizedQuery)
            return matchesTopic && matchesQuery
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                BrandBackground()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 22) {
                        hero
                        topicStrip

                        HStack(alignment: .firstTextBaseline) {
                            Text(selectedTopicName ?? (query.isEmpty ? "For you" : "Search results"))
                                .font(Brand.editorial(.title2))
                                .foregroundStyle(Brand.ink)
                            Spacer()
                            Text("\(visibleItems.count) lectures")
                                .font(.caption.bold())
                                .foregroundStyle(Brand.muted)
                        }

                        if visibleItems.isEmpty {
                            ContentUnavailableView.search(text: query)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 40)
                        } else {
                            ForEach(visibleItems.prefix(40)) { item in
                                NavigationLink(value: item) {
                                    LectureCard(item: item)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 28)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search lectures and speakers")
            .navigationDestination(for: LectureItem.self) { PlayerView(item: $0) }
            .onAppear {
                if discoveryOrder.isEmpty {
                    discoveryOrder = catalog.playableItems.shuffled().map(\.id)
                }
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("LEARN WITH PURPOSE")
                .font(.caption.bold())
                .foregroundStyle(Brand.accent)
            Text("Learn Islam.\nLive it better.")
                .font(Brand.editorial(.largeTitle))
                .foregroundStyle(Brand.ink)
            Text("Thoughtful lectures, structured series, and a calmer path back to what matters.")
                .font(.body)
                .foregroundStyle(Brand.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 18)
    }

    private var topicStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                TopicPill(title: "All", selected: selectedTopic == nil) { selectedTopic = nil }
                ForEach(catalog.topics) { topic in
                    TopicPill(title: topic.name, selected: selectedTopic == topic.id) {
                        selectedTopic = selectedTopic == topic.id ? nil : topic.id
                    }
                }
            }
        }
        .contentMargins(.horizontal, 1, for: .scrollContent)
    }

    private var selectedTopicName: String? {
        catalog.topics.first(where: { $0.id == selectedTopic })?.name
    }
}

private struct TopicPill: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(selected ? Brand.background : Brand.muted)
            .padding(.horizontal, 14)
            .frame(minHeight: 42)
            .background(selected ? Brand.accent : Brand.surface, in: Capsule())
            .overlay { Capsule().stroke(selected ? Brand.accent : Brand.line) }
            .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
