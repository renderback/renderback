package io.renderback.config

import com.comcast.ip4s.Host
import com.comcast.ip4s.Port
import io.circe.Codec
import io.circe.generic.extras.semiauto._
import io.lemonlabs.uri.Url
import io.renderback.json.CustomServerJsonCodecs

case class ParsedSiteConfig(
  routes: Seq[RouteRule],
  render: RenderConfig = RenderConfig.empty,
  preRender: ScrapeConfig = ScrapeConfig.empty,
  rewrite: ContentRewriteConfig = ContentRewriteConfig.empty,
  urlRewrite: UrlRewriteConfig = UrlRewriteConfig.empty,
  host: Option[Host],
  internalHost: Option[Host],
  internalPort: Option[Port],
  browserUrl: Option[Url],
)

object ParsedSiteConfig extends CustomServerJsonCodecs {

  implicit val codec: Codec[ParsedSiteConfig] = deriveConfiguredCodec

}
