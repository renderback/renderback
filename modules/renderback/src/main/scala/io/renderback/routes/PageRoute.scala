package io.renderback
package routes

import cats.data.OptionT
import cats.effect.Async
import cats.syntax.all._
import fs2.io.file
import fs2.io.file.Files
import io.renderback.config.SiteConfig
import io.renderback.config.RouteRule
import org.http4s.HttpRoutes
import org.typelevel.log4cats.Logger

trait PageRoute[F[_]] {

  def mkRoutes(siteConfig: SiteConfig[F], rule: RouteRule.Page): HttpRoutes[F]

}

object PageRoute {

  def apply[F[_]: Files](
    renderQueue: RenderQueue[F],
  )(implicit F: Async[F], logger: Logger[F]): PageRoute[F] = { (siteConfig: SiteConfig[F], rule: RouteRule.Page) =>
    renderQueue(siteConfig) { request =>
      OptionT.liftF(logger.trace(s"serving from static file ${rule.source} ...")) >>
        StaticFile.fromPath(file.Path(rule.source), request.some).map(noCache)
    }
  }

}
