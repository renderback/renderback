package io.renderback

import cats.Monad
import cats.data.Kleisli
import cats.data.OptionT
import org.http4s.Request

object ContinueIf {

  def apply[F[_]: Monad](condition: Request[F] => Boolean): Kleisli[OptionT[F, *], Request[F], Request[F]] =
    Kleisli { request =>
      if (condition(request)) {
        OptionT.pure[F](request)
      } else {
        OptionT.none[F, Request[F]]
      }
    }

}
