package expo.modules.playintegrity

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayIntegrityModule : Module() {
  private var provider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null

  override fun definition() = ModuleDefinition {
    Name("PlayIntegrity")

    AsyncFunction("prepare") { cloudProjectNumber: Double, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "Android context unavailable", null)
        return@AsyncFunction
      }
      IntegrityManagerFactory.createStandard(context)
        .prepareIntegrityToken(
          PrepareIntegrityTokenRequest.builder()
            .setCloudProjectNumber(cloudProjectNumber.toLong())
            .build()
        )
        .addOnSuccessListener {
          provider = it
          promise.resolve(null)
        }
        .addOnFailureListener { e -> promise.reject("PREPARE_FAILED", e.message, e) }
    }

    AsyncFunction("requestToken") { requestHash: String, promise: Promise ->
      val p = provider
      if (p == null) {
        promise.reject("NOT_PREPARED", "Call prepare first", null)
        return@AsyncFunction
      }
      p.request(StandardIntegrityTokenRequest.builder().setRequestHash(requestHash).build())
        .addOnSuccessListener { promise.resolve(it.token()) }
        .addOnFailureListener { e ->
          provider = null // re-prepare next time (e.g. provider expired)
          promise.reject("TOKEN_FAILED", e.message, e)
        }
    }
  }
}
