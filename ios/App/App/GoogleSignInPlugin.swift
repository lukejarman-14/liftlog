import Foundation
import Capacitor
import GoogleSignIn

@objc(GoogleSignInPlugin)
public class GoogleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleSignInPlugin"
    public let jsName = "GoogleSignInPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise)
    ]

    private let clientID = "882275707809-lshvb2dp8i8qf4bb2vlcai7l4vmqpilk.apps.googleusercontent.com"

    @objc func signIn(_ call: CAPPluginCall) {
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("No view controller available")
                return
            }
            GIDSignIn.sharedInstance.signIn(withPresenting: vc) { result, error in
                if let error = error {
                    let msg = error.localizedDescription
                    let nsErr = error as NSError
                    // GIDSignInError.canceled == -5
                    // ASAuthorizationError.canceled == 1001 (used when Google SDK falls back to ASWebAuthenticationSession)
                    let isCancelled = nsErr.code == -5
                        || (nsErr.domain == "com.apple.AuthenticationServices.AuthorizationError" && nsErr.code == 1001)
                        || msg.contains("canceled")
                        || msg.contains("cancelled")
                    if isCancelled {
                        call.reject("CANCELLED")
                    } else {
                        call.reject(msg)
                    }
                    return
                }
                guard
                    let user = result?.user,
                    let idToken = user.idToken?.tokenString
                else {
                    call.reject("No ID token returned")
                    return
                }
                call.resolve([
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString,
                    "email": user.profile?.email ?? "",
                    "givenName": user.profile?.givenName ?? "",
                    "familyName": user.profile?.familyName ?? ""
                ])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        GIDSignIn.sharedInstance.signOut()
        call.resolve()
    }
}
