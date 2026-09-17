import Capacitor
import Foundation
import StoreKit

@objc(IapPlugin)
public class IapPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "IapPlugin"
  public let jsName = "Iap"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
  ]

  @objc func purchase(_ call: CAPPluginCall) {
    let productId = call.getString("productId") ?? "com.doggstyle.pack5"
    Task {
      do {
        let products = try await Product.products(for: [productId])
        guard let product = products.first else {
          call.reject("product")
          return
        }
        let result = try await product.purchase()
        switch result {
        case let .success(verification):
          if case let .verified(transaction) = verification {
            await transaction.finish()
          }
          call.resolve(["jws": verification.jwsRepresentation])
        case .userCancelled:
          call.reject("cancelled")
        case .pending:
          call.reject("pending")
        @unknown default:
          call.reject("unknown")
        }
      } catch {
        call.reject(error.localizedDescription)
      }
    }
  }

  @objc func restore(_ call: CAPPluginCall) {
    Task {
      var list: [String] = []
      try? await AppStore.sync()
      for await result in Transaction.unfinished {
        list.append(result.jwsRepresentation)
        if case let .verified(transaction) = result {
          await transaction.finish()
        }
      }
      call.resolve(["jwsList": list])
    }
  }
}
