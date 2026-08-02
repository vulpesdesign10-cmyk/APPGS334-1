// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GS334Printer",
    platforms: [.iOS(.v15)],
    products: [.library(name: "GS334Printer", targets: ["GS334PrinterPlugin"])],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "GS334PrinterPlugin",
            dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm")],
            path: "ios/Sources/GS334PrinterPlugin"
        )
    ]
)
