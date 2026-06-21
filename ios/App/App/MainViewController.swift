import Foundation
import Capacitor

/// Custom Capacitor bridge view controller.
///
/// `GoogleSignInPlugin` and `HealthKitPlugin` live in the app target rather than
/// in npm Capacitor packages, so the Capacitor CLI never adds them to
/// `capacitor.config.json`'s `packageClassList` — and `cap copy`/`cap sync`
/// overwrites that list on every run. As a result the bridge's auto-registration
/// never sees them and any JS call returns "plugin is not implemented on ios".
///
/// Registering the instances here, in `capacitorDidLoad()`, is the officially
/// supported way to load app-target plugins and is durable: it's pure Swift, so
/// it survives every `cap copy`/`cap sync`.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GoogleSignInPlugin())
        bridge?.registerPluginInstance(HealthKitPlugin())
    }
}
