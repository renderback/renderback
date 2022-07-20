package io.renderback
package config

import io.circe.Codec
import io.circe.generic.extras.semiauto.deriveConfiguredCodec

final case class RenderConfig(
  waitSelector: Option[String] = None,
  allowXHR: Boolean = false,
  allowWS: Boolean = false,
  allowOtherRequests: Boolean = false,
  statusCodeFunction: Option[String] = None,
  abortResourceRequests: Boolean = false,
  requestBlacklist: Seq[String] = Seq.empty
)

object RenderConfig {

  val empty: RenderConfig = RenderConfig()

  implicit val codec: Codec[RenderConfig] = deriveConfiguredCodec

}
