package io.renderback.render

import cats.data.OptionT
import cats.effect.Async
import cats.effect.Clock
import cats.syntax.all._
import com.microsoft.playwright.options.WaitUntilState
import org.http4s.Headers
import org.http4s.Uri
import org.http4s.headers
import io.renderback.CachedBrowser
import io.renderback.RenderResult
import io.renderback.config.ContentRewriteConfig
import io.renderback.config.RenderConfig
import io.renderback.timing.StopWatch
import io.renderback.toolkit.redirectChain
import org.typelevel.log4cats.Logger

import scala.jdk.CollectionConverters._

trait RenderUrl[F[_]] {

  def apply(
    url: Uri,
    renderConfig: RenderConfig,
    stages: Seq[PostProcessStage[F]],
    rewriteConfig: ContentRewriteConfig,
  ): F[RenderResult]

}

object RenderUrl {

  def apply[F[_]: Async: StopWatch](
    browser: CachedBrowser[F],
    renderPage: RenderPage[F],
  )(implicit logger: Logger[F]): RenderUrl[F] = {

    val stopWatch = StopWatch[F]

    (
      uri: Uri,
      renderConfig: RenderConfig,
      stages: Seq[PostProcessStage[F]],
      rewriteConfig: ContentRewriteConfig,
    ) =>
      stopWatch {
        browser.use { browser =>
          browser.createPage(renderConfig).use { page =>
            logger.debug(s"navigating to: $uri") >>
              page.navigate(uri.renderString).flatMap { response =>
                OptionT
                  .fromOption(redirectChain(response.request()).headOption)
                  .semiflatMap { initialRequest =>
                    val response = initialRequest.response()
                    page.content().flatMap { content =>
                      val hdr = response.headers().asScala

                      val locationUri =
                        hdr.get("location").flatMap(location => Uri.fromString(location).toOption)

                      val location = locationUri.map(headers.Location(_))

                      val contentType = hdr.get("content-type").flatMap(ct => headers.`Content-Type`.parse(ct).toOption)

                      Clock[F].realTime.map { now =>
                        RenderResult(
                          uri = uri,
                          redirect = locationUri,
                          status = response.status(),
                          content = content,
                          etag = RenderResult.etag(now, content),
                          lastModified = now,
                          headers = Headers.empty.putOpt(location).putOpt(contentType)
                        )
                      }
                    }
                  }.getOrElseF(renderPage(renderConfig, stages, rewriteConfig, page))
              }
          }
        }
      }.map { case (result, time) => result.withTimeToRender(time) }.flatTap { r =>
        logger.info(s"${uri} - rendered: ${r.timeToRender.fold("")(_.toMillis.toString + "ms")}")
      }
  }

}
