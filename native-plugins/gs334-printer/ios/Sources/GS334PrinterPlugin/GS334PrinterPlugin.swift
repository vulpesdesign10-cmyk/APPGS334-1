import Foundation
import Capacitor
import Network

@objc(GS334PrinterPlugin)
public final class GS334PrinterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GS334PrinterPlugin"
    public let jsName = "GS334Printer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "testConnection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "printRaster", returnType: CAPPluginReturnPromise)
    ]

    private let queue = DispatchQueue(label: "vn.gs334.printer", qos: .userInitiated)

    @objc public func testConnection(_ call: CAPPluginCall) {
        guard let host = cleanHost(call.getString("host")) else {
            call.reject("IP máy in không hợp lệ")
            return
        }
        let port = UInt16(call.getInt("port") ?? 9100)
        let timeoutMs = max(1000, call.getInt("timeoutMs") ?? 5000)
        connect(host: host, port: port, timeoutMs: timeoutMs) { result in
            switch result {
            case .success(let connection):
                connection.cancel()
                call.resolve(["ok": true, "message": "Đã kết nối máy in \(host):\(port)"])
            case .failure(let error):
                call.reject("Không kết nối được máy in: \(error.localizedDescription)")
            }
        }
    }

    @objc public func printRaster(_ call: CAPPluginCall) {
        guard let host = cleanHost(call.getString("host")) else {
            call.reject("IP máy in không hợp lệ")
            return
        }
        let port = UInt16(call.getInt("port") ?? 9100)
        let encoded = call.getArray("rasterCopies", String.self) ?? []
        guard !encoded.isEmpty else {
            call.reject("Không có dữ liệu Raster để in")
            return
        }
        let copies = encoded.compactMap { Data(base64Encoded: $0) }
        guard copies.count == encoded.count else {
            call.reject("Dữ liệu Raster không hợp lệ")
            return
        }
        let feedLines = min(8, max(0, call.getInt("feedLines") ?? 3))
        let cutMode = call.getString("cutMode") == "partial" ? UInt8(1) : UInt8(0)
        let cutAfterLast = call.getBool("cutAfterLast") ?? true
        let delayMs = min(2000, max(100, call.getInt("delayMs") ?? 350))

        sendCopies(copies, index: 0, host: host, port: port, feedLines: feedLines,
                   cutMode: cutMode, cutAfterLast: cutAfterLast, delayMs: delayMs) { result in
            switch result {
            case .success:
                call.resolve(["ok": true, "copies": copies.count,
                              "message": "Đã in trực tiếp \(copies.count) liên"])
            case .failure(let error):
                call.reject("In thất bại: \(error.localizedDescription)")
            }
        }
    }

    private func sendCopies(_ copies: [Data], index: Int, host: String, port: UInt16,
                            feedLines: Int, cutMode: UInt8, cutAfterLast: Bool,
                            delayMs: Int, completion: @escaping (Result<Void, Error>) -> Void) {
        guard index < copies.count else { completion(.success(())); return }
        connect(host: host, port: port, timeoutMs: 6000) { result in
            switch result {
            case .failure(let error): completion(.failure(error))
            case .success(let connection):
                var packet = Data([0x1B, 0x40]) // ESC @
                packet.append(copies[index])
                if feedLines > 0 { packet.append(Data(repeating: 0x0A, count: feedLines)) }
                let shouldCut = index < copies.count - 1 || cutAfterLast
                if shouldCut { packet.append(contentsOf: [0x1D, 0x56, cutMode]) }
                connection.send(content: packet, completion: .contentProcessed { error in
                    connection.cancel()
                    if let error = error { completion(.failure(error)); return }
                    self.queue.asyncAfter(deadline: .now() + .milliseconds(delayMs)) {
                        self.sendCopies(copies, index: index + 1, host: host, port: port,
                                        feedLines: feedLines, cutMode: cutMode,
                                        cutAfterLast: cutAfterLast, delayMs: delayMs,
                                        completion: completion)
                    }
                })
            }
        }
    }

    private func connect(host: String, port: UInt16, timeoutMs: Int,
                         completion: @escaping (Result<NWConnection, Error>) -> Void) {
        let connection = NWConnection(host: NWEndpoint.Host(host),
                                      port: NWEndpoint.Port(rawValue: port)!, using: .tcp)
        var finished = false
        connection.stateUpdateHandler = { state in
            guard !finished else { return }
            switch state {
            case .ready:
                finished = true
                completion(.success(connection))
            case .failed(let error):
                finished = true
                connection.cancel()
                completion(.failure(error))
            default: break
            }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
            guard !finished else { return }
            finished = true
            connection.cancel()
            completion(.failure(NSError(domain: "GS334Printer", code: -1001,
                                       userInfo: [NSLocalizedDescriptionKey: "Hết thời gian chờ kết nối"])))
        }
    }

    private func cleanHost(_ value: String?) -> String? {
        guard var host = value?.trimmingCharacters(in: .whitespacesAndNewlines), !host.isEmpty else { return nil }
        host = host.replacingOccurrences(of: "http://", with: "")
                   .replacingOccurrences(of: "https://", with: "")
        if let slash = host.firstIndex(of: "/") { host = String(host[..<slash]) }
        if let colon = host.firstIndex(of: ":") { host = String(host[..<colon]) }
        return host.isEmpty ? nil : host
    }
}
