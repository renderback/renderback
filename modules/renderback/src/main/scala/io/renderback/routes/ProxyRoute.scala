package io.renderback
package routes

import cats.effect.Async
import cats.syntax.all._
import org.http4s.HttpRoutes
import org.http4s.Request
import org.http4s.Uri
import org.http4s.client.Client
import io.renderback.config.RouteRule
import org.typelevel.log4cats.Logger

trait ProxyRoute[F[_]] {

  def mkRoutes(rule: RouteRule.Proxy): HttpRoutes[F]

}

object ProxyRoute {

  def apply[F[_]: Async](
    client: Client[F],
  )(implicit logger: Logger[F]): ProxyRoute[F] = {
    val clientApp = client.toHttpApp

    (rule: RouteRule.Proxy) =>
      HttpRoutes.of[F] { request =>
        logger.debug(s"ProxyRoute route, proxying the request to ${rule.target}") *>
          clientApp(
            Request(
              method = request.method,
              uri = Uri.unsafeFromString(rule.target.toString()).withPath(request.uri.path),
              headers = request.headers,
              body = request.body,
            )
          )
      }
  }
}
