import SwiftUI
import UIKit

enum Brand {
    static let background = adaptive(light: 0xF7F3EC, dark: 0x101714)
    static let surface = adaptive(light: 0xFFFDF8, dark: 0x17211D)
    static let strongSurface = adaptive(light: 0xFFFFFF, dark: 0x1D2A25)
    static let ink = adaptive(light: 0x18201B, dark: 0xEEF4ED)
    static let muted = adaptive(light: 0x66706A, dark: 0xAAB8B0)
    static let line = adaptive(light: 0xDED6C8, dark: 0x33433C)
    static let accent = adaptive(light: 0x176B5B, dark: 0x6CC4AD)
    static let gold = adaptive(light: 0xC89B3C, dark: 0xD7B45C)
    static let rose = adaptive(light: 0xA6484F, dark: 0xE08C94)

    static func editorial(_ style: Font.TextStyle) -> Font {
        .system(style, design: .serif, weight: .bold)
    }

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

private extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}

struct BrandBackground: View {
    var body: some View {
        LinearGradient(
            colors: [Brand.surface, Brand.background],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }
}
