package io.renderback.routes

import cats.data.OptionT
import cats.effect.Async
import cats.syntax.all._
import io.renderback.RenderQueue
import io.renderback.config.SiteConfig
import io.renderback.config.RouteRule
import org.http4s._
import org.http4s.client.Client
import org.typelevel.log4cats.Logger

trait PageProxyRoute[F[_]] {

  def mkRoutes(siteConfig: SiteConfig[F], rule: RouteRule.PageProxy): HttpRoutes[F]

}

object PageProxyRoute {

  def apply[F[_]: Async](
    client: Client[F],
    renderQueue: RenderQueue[F],
  )(implicit logger: Logger[F]): PageProxyRoute[F] = {
    val clientApp = client.toHttpApp

    (siteConfig: SiteConfig[F], rule: RouteRule.PageProxy) =>
      renderQueue(siteConfig) { request =>
        OptionT.liftF(logger.trace(s"proxying to ${rule.target} ...")) >>
          OptionT.liftF(clientApp(request.withUri(Uri.unsafeFromString(rule.target.toString()).withPath(request.uri.path)))).map(noCache)
      }
  }

}
