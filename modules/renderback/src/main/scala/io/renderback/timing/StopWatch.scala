package io.renderback.timing

import cats.Monad
import cats.syntax.all._
import cats.effect.Clock

import scala.concurrent.duration.Duration
import scala.concurrent.duration.FiniteDuration

trait StopWatch[F[_]] {

  def apply[T](body: F[T]): F[(T, FiniteDuration)]

}

object StopWatch {

  def apply[F[_]](implicit w: StopWatch[F]): StopWatch[F] = w

  implicit def stopwatchForClock[F[_]: Monad](implicit C: Clock[F]): StopWatch[F] = new StopWatch[F] {
    def apply[T](body: F[T]): F[(T, FiniteDuration)] =
      C.monotonic.flatMap { started =>
        body.flatMap { result =>
          C.monotonic.map { ended =>
            (result, ended - started)
          }
        }
      }
  }

}

class TimingPartiallyApplied[F[_]: Clock: Monad] {

  def apply[T](body: => F[T]): F[(T, Duration)] =
    Clock[F].monotonic.flatMap { start =>
      body.flatMap { result =>
        Clock[F].monotonic.map { end =>
          (result, end - start)
        }
      }
    }

}
