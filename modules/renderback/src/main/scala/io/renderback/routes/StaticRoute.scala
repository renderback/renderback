package io.renderback.routes

import cats.data.OptionT
import cats.effect.Async
import fs2.io.file.Files
import io.renderback.config.RouteRule
import org.http4s.HttpRoutes
import org.http4s.dsl.Http4sDsl

trait StaticRoute[F[_]] {

  def mkRoutes(rule: RouteRule.Static): HttpRoutes[F]

}

object StaticRoute {

  def apply[F[_]: Async: Files](): StaticRoute[F] = {
    val dsl = new Http4sDsl[F] {}
    import dsl._
    (rule: RouteRule.Static) =>
      HttpRoutes[F] { _ =>
        OptionT.liftF(
          Ok(rule.content)
        )
      }
  }

}
