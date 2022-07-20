package io.renderback

import cats.Monad
import cats.data.Kleisli
import cats.data.OptionT
import cats.syntax.all._
import org.http4s.HttpRoutes
import org.http4s.Request

package object server {

  def concat[F[_]: Monad](routes: Seq[HttpRoutes[F]]): HttpRoutes[F] = routes.foldLeft(HttpRoutes.empty)(_ <+> _)

}
