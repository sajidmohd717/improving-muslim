import SwiftUI

struct RootView: View {
    let catalog: CatalogStore

    var body: some View {
        ZStack {
            BrandBackground()

            switch catalog.state {
            case .idle, .loading:
                ProgressView("Loading the lecture library…")
                    .foregroundStyle(Brand.ink)
            case let .failed(message):
                ContentUnavailableView {
                    Label("Library unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await catalog.retry() } }
                        .buttonStyle(.borderedProminent)
                }
            case .ready:
                if let library = catalog.catalog {
                    MainTabs(catalog: library)
                }
            }
        }
    }
}

private struct MainTabs: View {
    let catalog: Catalog

    var body: some View {
        TabView {
            HomeView(catalog: catalog)
                .tabItem { Label("Home", systemImage: "house") }

            ExploreView(catalog: catalog)
                .tabItem { Label("Explore", systemImage: "safari") }

            EmptyLibraryView(
                title: "History",
                message: "Lectures you begin will appear here.",
                symbol: "clock.arrow.circlepath"
            )
            .tabItem { Label("History", systemImage: "clock") }

            EmptyLibraryView(
                title: "Saved",
                message: "Save lectures to build your personal learning list.",
                symbol: "bookmark"
            )
            .tabItem { Label("Saved", systemImage: "bookmark") }

            SpeakersView(catalog: catalog)
                .tabItem { Label("Speakers", systemImage: "person.2") }
        }
        .toolbarBackground(Brand.strongSurface, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}

private struct EmptyLibraryView: View {
    let title: String
    let message: String
    let symbol: String

    var body: some View {
        NavigationStack {
            ZStack {
                BrandBackground()
                ContentUnavailableView(title, systemImage: symbol, description: Text(message))
            }
            .navigationTitle(title)
        }
    }
}
