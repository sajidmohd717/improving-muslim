import SwiftUI

@main
struct ImprovingMuslimApp: App {
    @State private var catalog = CatalogStore()

    var body: some Scene {
        WindowGroup {
            RootView(catalog: catalog)
                .task { await catalog.loadIfNeeded() }
                .tint(Brand.accent)
        }
    }
}
