package io.renderback
package config

import io.circe.Codec
import io.circe.generic.extras.semiauto.deriveConfiguredCodec
import io.lemonlabs.uri.Url

final case class ScrapeConfig(
  paths: Seq[Url] = Seq.empty,
  origins: Set[Url] = Set.empty,
  exclude: Set[String] = Set.empty,
  depth: Int = 1,
)

object ScrapeConfig {

  val empty: ScrapeConfig = ScrapeConfig()

  implicit val codec: Codec[ScrapeConfig] = deriveConfiguredCodec

}
