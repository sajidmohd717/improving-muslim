import Foundation

struct Catalog: Codable, Sendable {
    let schemaVersion: Int
    let catalogVersion: String
    let counts: CatalogCounts
    let topics: [Topic]
    let speakers: [Speaker]
    let series: [LectureSeries]
    let standaloneLectures: [StandaloneLecture]

    var playableItems: [LectureItem] {
        let episodes = series.flatMap { series in
            series.episodes.filter(\.isAvailable).map { LectureItem.episode(series, $0) }
        }
        let standalone = standaloneLectures.filter(\.isAvailable).map(LectureItem.standalone)
        return episodes + standalone
    }
}

struct CatalogCounts: Codable, Sendable {
    let series: Int
    let speakers: Int
    let availableLectures: Int
}

struct Topic: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let description: String
    let aliases: [String]
}

struct Speaker: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let imageURL: URL?
    let bio: String
}

struct LectureSeries: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let speakerID: String?
    let speaker: String
    let topic: String?
    let categories: [String]
    let label: String?
    let description: String?
    let thumbnailURL: URL?
    let playlistID: String
    let availableCount: Int
    let episodeCount: Int
    let episodes: [Episode]
}

struct Episode: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let number: Int
    let title: String
    let published: String?
    let duration: Int?
    let views: Int?
    let thumbnailURL: URL?
    let videoURL: URL?
    let captionsURL: URL?
    let statusNote: String?
    let description: String?
    let takeaways: [String]
    let recap: String?
    let grammarNotes: [String]

    var isAvailable: Bool { videoURL != nil }
}

struct StandaloneLecture: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let speakerID: String?
    let speaker: String
    let topic: String?
    let categories: [String]
    let typeLabel: String
    let published: String?
    let duration: Int?
    let views: Int?
    let thumbnailURL: URL?
    let videoURL: URL?
    let captionsURL: URL?
    let description: String?
    let takeaways: [String]
    let recap: String?
    let grammarNotes: [String]

    var isAvailable: Bool { videoURL != nil }
}

enum LectureItem: Hashable, Identifiable, Sendable {
    case episode(LectureSeries, Episode)
    case standalone(StandaloneLecture)

    var id: String {
        switch self {
        case let .episode(series, episode): "episode:\(series.id):\(episode.id)"
        case let .standalone(lecture): "standalone:\(lecture.id)"
        }
    }

    var title: String {
        switch self {
        case let .episode(_, episode): episode.title
        case let .standalone(lecture): lecture.title
        }
    }

    var speaker: String {
        switch self {
        case let .episode(series, _): series.speaker
        case let .standalone(lecture): lecture.speaker
        }
    }

    var context: String {
        switch self {
        case let .episode(series, episode): "\(series.title) · Episode \(episode.number)"
        case let .standalone(lecture): lecture.topic ?? lecture.typeLabel
        }
    }

    var categories: [String] {
        switch self {
        case let .episode(series, _): series.categories
        case let .standalone(lecture): lecture.categories
        }
    }

    var duration: Int? {
        switch self {
        case let .episode(_, episode): episode.duration
        case let .standalone(lecture): lecture.duration
        }
    }

    var thumbnailURL: URL? {
        switch self {
        case let .episode(_, episode): episode.thumbnailURL
        case let .standalone(lecture): lecture.thumbnailURL
        }
    }

    var videoURL: URL? {
        switch self {
        case let .episode(_, episode): episode.videoURL
        case let .standalone(lecture): lecture.videoURL
        }
    }

    var accessibilityLabel: String {
        "\(title), \(context), by \(speaker)"
    }
}
