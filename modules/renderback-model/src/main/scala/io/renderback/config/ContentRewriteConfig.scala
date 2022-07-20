package io.renderback
package config

import io.circe.Codec
import io.circe.generic.extras.semiauto.deriveConfiguredCodec

final case class ContentRewriteConfig(
  minify: Option[MinifyConfig] = None,
  regexReplace: Seq[RegexReplace] = Seq.empty,
  cssSelectorRemove: Seq[String] = Seq.empty,
  cssSelectorUpdate: Seq[CssSelectorUpdate] = Seq.empty
)

object ContentRewriteConfig {

  val empty: ContentRewriteConfig = ContentRewriteConfig()

  implicit val codec: Codec[ContentRewriteConfig] = deriveConfiguredCodec

}
