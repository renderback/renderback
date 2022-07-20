package io.renderback
package config

import io.circe.Codec
import io.circe.generic.extras.semiauto.deriveConfiguredCodec

final case class MinifyConfig(
  html5: Boolean = true,
  collapseBooleanAttributes: Boolean = true,
  collapseInlineTagWhitespace: Boolean = true,
  collapseWhitespace: Boolean = true,
  useShortDoctype: Boolean = true,
)

object MinifyConfig {

  implicit val codec: Codec[MinifyConfig] = deriveConfiguredCodec

}
