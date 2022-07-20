package io.renderback
package config

import io.circe.generic.JsonCodec

@JsonCodec
final case class CssSelectorUpdate(
  selector: String,
  updateFunction: String
)
