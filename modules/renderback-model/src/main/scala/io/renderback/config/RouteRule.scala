package io.renderback
package config

import io.circe.Codec
import io.circe.generic.extras.Configuration
import io.circe.generic.extras.semiauto._
import io.lemonlabs.uri.Url

sealed trait RouteRule extends Product with Serializable {
  def matcher: RouteMatcher
}

object RouteRule {

  implicit val configuration: Configuration = Configuration.default.withDefaults.withDiscriminator("type")

  implicit val codec: Codec[RouteRule] = deriveConfiguredCodec

  final case class Proxy(
    matcher: RouteMatcher = RouteMatcher.empty,
    target: Url,
    modifyUrl: Option[String],
  ) extends RouteRule

  final case class Asset(
    matcher: RouteMatcher = RouteMatcher.empty,
    dir: String,
    maxAge: Option[Int],
  ) extends RouteRule

  final case class AssetProxy(
    matcher: RouteMatcher = RouteMatcher.empty,
    target: Url,
  ) extends RouteRule

  final case class Page(
    matcher: RouteMatcher = RouteMatcher.empty,
    source: String,
  ) extends RouteRule

  final case class PageProxy(
    matcher: RouteMatcher = RouteMatcher.empty,
    target: Url,
  ) extends RouteRule

  final case class Static(
    matcher: RouteMatcher = RouteMatcher.empty,
    content: String,
    maxAge: Option[Int],
  ) extends RouteRule

}
