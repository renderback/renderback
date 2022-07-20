package io.renderback.config

import com.comcast.ip4s.Host
import com.comcast.ip4s.Port
import io.circe.Codec
import io.circe.generic.extras.semiauto.deriveConfiguredCodec

case class Configuration(
  browserExecutable: Option[String],
  browserCdpEndpoint: Option[String],
  browserWsEndpoint: Option[String],
  browserConnectTimeout: Option[String],
  internalHostName: Option[String],
  browserUserAgent: Option[String],
  bindHost: Option[Host],
  bindPort: Option[Port],
  cacheType: Option[CacheType],
  cacheDir: Option[String],
  redisHost: Option[String],
  redisPort: Option[String],
  redisPassword: Option[String],
  redisPasswordFile: Option[String],
)

object Configuration {

  implicit val codec: Codec[Configuration] = deriveConfiguredCodec

}
