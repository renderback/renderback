package io.renderback.routes

import cats.effect.Async
import cats.syntax.all._
import fs2.io.file.Files
import fs2.io.file.Path
import org.http4s.HttpRoutes
import io.renderback.config.RouteRule

trait AssetRoute[F[_]] {

  def mkRoutes(rule: RouteRule.Asset): HttpRoutes[F]

}

object AssetRoute {

  def apply[F[_]: Async: Files](): AssetRoute[F] = (rule: RouteRule.Asset) =>
    HttpRoutes[F] { request =>
      val assetPath = Path(s"${rule.dir}").resolve(request.uri.path.renderString.dropWhile(_ == '/'))
      StaticFile.fromPath(assetPath, request.some)
    }

}
