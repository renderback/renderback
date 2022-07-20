package io.renderback.config

import org.http4s.Request
import org.http4s.headers

case class RenderbackConfig(
  browserUserAgent: headers.`User-Agent`,
) {

  def isSelfRequest[F[_]](request: Request[F]): Boolean =
    request.headers.get[headers.`User-Agent`].contains(browserUserAgent)

  object SelfRequest {

    def unapply[F[_]](request: Request[F]): Option[Request[F]] = Option.when(isSelfRequest(request))(request)

  }

}
