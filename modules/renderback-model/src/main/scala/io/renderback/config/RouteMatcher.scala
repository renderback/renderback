package io.renderback.config

import io.circe.generic.JsonCodec

@JsonCodec
case class RouteMatcher(
  path: Option[Seq[String]],
  ext: Option[Seq[String]],
  regex: Option[Seq[String]],
  exclude: Option[Seq[String]],
  noExt: Option[Boolean],
)

object RouteMatcher {

  val empty: RouteMatcher = RouteMatcher(
    path = None,
    ext = None,
    regex = None,
    exclude = None,
    noExt = None,
  )

}
