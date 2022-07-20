package io

import cats.effect.Sync
import cats.effect.kernel.Async
import io.renderback.json.CustomJsonCodecs
import io.renderback.json.CustomModelJsonCodecs
import org.typelevel.log4cats.Logger
import org.typelevel.log4cats.slf4j.Slf4jLogger

package object renderback extends CustomJsonCodecs {

  implicit private[renderback] def unsafeLogger[F[_]: Sync]: Logger[F] = Slf4jLogger.getLogger[F]

  private[renderback] def fromBlocking[F[_], T](p: => T)(implicit A: Async[F]): F[T] =
    A.interruptible(p)

}
