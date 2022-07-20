package io.renderback

import cats.effect.Ref
import cats.effect.Resource
import cats.effect.kernel.Async
import cats.effect.std.Semaphore
import cats.syntax.all._
import retry._
import retry.RetryDetails._
import io.renderback.config.BrowserConfig
import io.renderback.config.RenderbackConfig
import org.typelevel.log4cats.Logger

trait CachedBrowser[F[_]] {

  def use[A](body: Browser[F] => F[A]): F[A]

}

object CachedBrowser {

  def apply[F[_]: Async](
    options: BrowserConfig,
    renderbackConfig: RenderbackConfig,
    retries: Int = 1
  )(implicit logger: Logger[F]): Resource[F, CachedBrowser[F]] = {

    def logError(err: Throwable, details: RetryDetails): F[Unit] = {
      val msg = err match {
        case ExceptionMessage(error) => error
      }
      details match {

        case WillDelayAndRetry(nextDelay, retriesSoFar, _) =>
          logger.info(s"CachedBrowser.use failed: $msg. Retried $retriesSoFar times. Next delay: $nextDelay")

        case GivingUp(totalRetries, totalDelay) =>
          logger.error(s"CachedBrowser.use failed: $msg. Giving up after $totalRetries retries ($totalDelay).")
      }
    }

    Resource.eval(Ref.of[F, Option[Browser[F]]](none)).flatMap { ref =>
      Resource.eval(Semaphore[F](1)).flatMap { semaphore =>
        Resource
          .make {
            val cachedBrowser = new CachedBrowser[F] {
              def use[A](body: Browser[F] => F[A]): F[A] = {
                retryingOnAllErrors(
                  policy = RetryPolicies.limitRetries[F](retries),
                  onError = logError
                ) {
                  semaphore.permit.use { _ =>
                    ref.get.flatMap {
                      case Some(browser) if browser.isConnected => browser.pure[F]
                      case _                                    =>
                        Browser(options, renderbackConfig.browserUserAgent).flatMap { browser =>
                          ref.set(browser.some).as(browser)
                        }
                    }
                  } >>= body
                }
              }
            }
            (cachedBrowser, ref).pure[F]
          } { case (_, ref) =>
            ref.get.flatMap {
              case Some(browser) if browser.isConnected => browser.close()
              case _                                    => ().pure[F]
            }
          }
          .map { case (browser, _) => browser }
      }
    }
  }

}
