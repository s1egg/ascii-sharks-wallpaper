import AppKit
import WebKit

final class DesktopWindow: NSWindow {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

@MainActor
private final class ScriptHandler: NSObject, WKScriptMessageHandler {
    weak var surface: WallpaperSurface?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: String] else { return }
        if body["event"] == "error" {
            if let message = body["message"], !message.isEmpty { surface?.recordError(.details(message)) }
            else { surface?.recordError(.loadingFailed) }
        }
    }
}

@MainActor
final class WallpaperSurface: NSObject, WKNavigationDelegate {
    let window: DesktopWindow
    let webView: WKWebView
    let resourceURL: URL
    private(set) var isReady = false
    private(set) var lastError: WallpaperFailure?
    var onStatusChange: (() -> Void)?
    private var configuration: WebConfiguration
    private var wantsVisible = true
    private var closed = false
    private var processRetries = 0
    private let scriptHandler = ScriptHandler()

    init(screen: NSScreen, resourceURL: URL, configuration: WebConfiguration) throws {
        self.resourceURL = resourceURL
        self.configuration = configuration
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = .nonPersistent()
        webConfiguration.preferences.javaScriptCanOpenWindowsAutomatically = false
        webConfiguration.userContentController.addUserScript(WKUserScript(
            source: "window.initialWallpaperSettings = \(try configuration.json());",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        webView = WKWebView(frame: NSRect(origin: .zero, size: screen.frame.size), configuration: webConfiguration)
        window = DesktopWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
        super.init()
        scriptHandler.surface = self
        webConfiguration.userContentController.add(scriptHandler, name: "wallpaper")
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]
        window.title = "ASCII Sharks Wallpaper Desktop"
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) + 1)
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.ignoresMouseEvents = true
        window.isReleasedWhenClosed = false
        window.isOpaque = true
        // Match --water-paper so loading and resizing keep the same warm ground.
        let paper = NSColor(srgbRed: 238.0 / 255, green: 233.0 / 255, blue: 223.0 / 255, alpha: 1)
        window.backgroundColor = paper
        webView.underPageBackgroundColor = paper
        window.hasShadow = false
        window.hidesOnDeactivate = false
        window.isExcludedFromWindowsMenu = true
        window.contentView = webView
        window.setFrame(screen.frame, display: true)
        reload()
    }

    func reload() {
        guard !closed else { return }
        isReady = false
        lastError = nil
        webView.loadFileURL(resourceURL.appendingPathComponent("index.html"), allowingReadAccessTo: resourceURL)
        onStatusChange?()
    }

    func update(configuration: WebConfiguration, visible: Bool) {
        self.configuration = configuration
        wantsVisible = visible
        if visible { window.orderFrontRegardless() } else { window.orderOut(nil) }
        guard isReady, !closed else { return }
        do {
            webView.evaluateJavaScript("window.wallpaper.configure(\(try configuration.json()))") { [weak self] _, error in
                if let error { self?.recordError(.details(error.localizedDescription)) }
            }
        } catch { recordError(.details(error.localizedDescription)) }
    }

    func close() {
        closed = true
        onStatusChange = nil
        webView.stopLoading()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "wallpaper")
        webView.navigationDelegate = nil
        window.close()
    }

    func recordError(_ failure: WallpaperFailure) {
        lastError = failure
        onStatusChange?()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isReady = true
        update(configuration: configuration, visible: wantsVisible)
        onStatusChange?()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        recordError(.details(error.localizedDescription))
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        recordError(.details(error.localizedDescription))
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard !closed else { return }
        isReady = false
        // Recover once automatically; repeated crashes stay visible in the menu.
        if processRetries < 1 {
            processRetries += 1
            reload()
        } else {
            recordError(.rendererStopped)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        let destination = navigationAction.request.url?.standardizedFileURL
        let root = resourceURL.standardizedFileURL.path + "/"
        decisionHandler(destination?.isFileURL == true && destination?.path.hasPrefix(root) == true ? .allow : .cancel)
    }
}
