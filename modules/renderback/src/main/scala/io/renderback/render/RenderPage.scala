package io.renderback.render

import cats.data.OptionT
import cats.effect.Async
import cats.effect.Clock
import cats.syntax.all._
import com.microsoft.playwright.options.WaitForSelectorState
import io.renderback.Page
import io.renderback.RenderResult
import io.renderback.config.ContentRewriteConfig
import io.renderback.config.RegexReplace
import io.renderback.config.RenderConfig
import io.renderback.timing.StopWatch
import org.http4s.Headers
import org.http4s.Uri
import org.typelevel.log4cats.Logger

import scala.concurrent.duration._
import scala.util.Try
import scala.util.control.NonFatal

trait RenderPage[F[_]] {

  def apply(
    renderConfig: RenderConfig,
    stages: Seq[PostProcessStage[F]],
    rewriteConfig: ContentRewriteConfig,
    page: Page[F]
  ): F[RenderResult]

}

object RenderPage {

  def apply[F[_]: Clock](implicit logger: Logger[F], F: Async[F]): RenderPage[F] = {

    val stopWatch = StopWatch[F]

    (
      renderConfig: RenderConfig,
      stages: Seq[PostProcessStage[F]],
      rewriteConfig: ContentRewriteConfig,
      page: Page[F]
    ) => {

      val waitForContent =
        OptionT
          .fromOption[F](renderConfig.waitSelector)
          .semiflatMap { waitSelector =>
            logger.debug(s"wait for selector: '${renderConfig.waitSelector}'") *>
              page
                .waitForSelector(waitSelector, timeout = 10.seconds.some, state = WaitForSelectorState.ATTACHED.some).void
                .recoverWith { case NonFatal(error) =>
                  page.content().flatMap { content =>
                    logger.error(error)(s"wait for selector (${renderConfig.waitSelector}) timed-out\npage content:\n$content") *>
                      Async[F].raiseError(error)
                  }
                }
          }
          .getOrElse(())

      val extractStatusCode =
        OptionT
          .fromOption(renderConfig.statusCodeFunction).flatMap { statusCodeFunction =>
            OptionT(
              page.evalOnSelector[Any]("html", statusCodeFunction).map(Option(_))
            ).flatMapF {
              case status: Int    => status.some.pure[F]
              case status: String =>
                F.fromEither(Try(status.toInt).toEither.map(Option(_))).recoverWith { case NonFatal(err) =>
                  logger.error(s"invalid value returned from status code function: $status: ${err.getMessage}").as(none[Int])
                }
              case other          =>
                logger.error(s"unexpected value returned from status code function: $other").as(none[Int])
            }
          }
          .getOrElse(200)

      val regexReplace = (content: String) =>
        rewriteConfig.regexReplace
          .foldLeft(content) { case (content, RegexReplace(regex, replacement)) =>
            logger.trace(s"content regex replace: $regex --> $replacement")
            content.replaceAll(regex, replacement)
          }.pure[F]

      val minify = (content: String) =>
        OptionT
          .fromOption[F](rewriteConfig.minify)
          .semiflatMap { _ =>
            logger.info(s"html minification is not implemented").as(content) // not implemented yet
          }.getOrElse(content)

      stopWatch {
        for {
          _          <- waitForContent
          statusCode <- extractStatusCode
          _          <- logger.debug(s"status code: $statusCode")
          _          <- stages.traverse { stage => stage(page) }
          content    <- page.content()
          content    <- regexReplace(content)
          content    <- minify(content)
          uri        <- Async[F].fromEither(Uri.fromString(page.url()))
          now        <- Clock[F].realTime
        } yield RenderResult(
          uri = uri,
          redirect = None,
          status = statusCode,
          content = content,
          lastModified = now,
          etag = RenderResult.etag(now, content),
          headers = Headers.empty,
        )
      }.map { case (result, time) => result.withTimeToRender(time) }
    }
  }

}
