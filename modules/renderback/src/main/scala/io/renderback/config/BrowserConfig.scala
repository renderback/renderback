package io.renderback
package config

import scala.concurrent.duration.FiniteDuration

sealed trait BrowserConfig extends Product with Serializable

object BrowserConfig {

  final case class Executable(
    path: String // /usr/bin/google-chrome-stable
  ) extends BrowserConfig

  final case class CDPEndpoint(
    url: String,
    timeout: Option[FiniteDuration],
  ) extends BrowserConfig

  final case class WsEndpoint(
    url: String,
    timeout: Option[FiniteDuration],
  ) extends BrowserConfig

}
