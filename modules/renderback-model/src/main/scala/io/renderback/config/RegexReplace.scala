package io.renderback
package config

import io.circe.generic.JsonCodec

@JsonCodec
final case class RegexReplace(
  regex: String,
  replacement: String
)
