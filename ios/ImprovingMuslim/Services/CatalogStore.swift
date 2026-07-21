import Foundation
import Observation

@MainActor
@Observable
final class CatalogStore {
    enum State: Equatable {
        case idle
        case loading
        case ready
        case failed(String)
    }

    private(set) var catalog: Catalog?
    private(set) var state: State = .idle

    private let remoteURL = URL(string: "https://improvingmuslim.com/api/v1/catalog.json")!

    func loadIfNeeded() async {
        guard state == .idle else { return }
        state = .loading

        do {
            let (data, response) = try await URLSession.shared.data(from: remoteURL)
            guard let response = response as? HTTPURLResponse, 200..<300 ~= response.statusCode else {
                throw URLError(.badServerResponse)
            }
            catalog = try Self.decode(data)
            state = .ready
        } catch {
            do {
                guard let url = Bundle.main.url(forResource: "catalog", withExtension: "json") else {
                    throw URLError(.fileDoesNotExist)
                }
                catalog = try Self.decode(Data(contentsOf: url))
                state = .ready
            } catch {
                state = .failed("The lecture library could not be loaded. Please try again.")
            }
        }
    }

    func retry() async {
        state = .idle
        await loadIfNeeded()
    }

    private static func decode(_ data: Data) throws -> Catalog {
        try JSONDecoder().decode(Catalog.self, from: data)
    }
}
