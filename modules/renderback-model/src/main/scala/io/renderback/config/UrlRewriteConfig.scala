package io.renderback
package config

import io.circe.Codec
import io.circe.generic.extras.semiauto.deriveConfiguredCodec

final case class UrlRewriteConfig(
  replace: Seq[RegexReplace] = Seq.empty,
  pathifyParams: Boolean = false
)

object UrlRewriteConfig {

  val empty: UrlRewriteConfig = UrlRewriteConfig()

  implicit val codec: Codec[UrlRewriteConfig] = deriveConfiguredCodec

}
