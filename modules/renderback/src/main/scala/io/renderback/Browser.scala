package io.renderback

import cats.effect.Resource
import cats.effect.kernel.Async
import cats.syntax.all._
import org.http4s.headers
import org.http4s.implicits._
import io.renderback.config.BrowserConfig
import io.renderback.config.RenderConfig
import com.microsoft.playwright
import com.microsoft.playwright.BrowserType.LaunchOptions
import com.microsoft.playwright.BrowserType
import com.microsoft.playwright.Playwright
import org.typelevel.log4cats.Logger

import scala.concurrent.duration._
import java.nio.file.Path
import scala.util.chaining._

class Browser[F[_]](
  browser: playwright.Browser,
  userAgent: String,
  doClose: F[Unit],
)(implicit F: Async[F], logger: Logger[F]) {

  def isConnected: Boolean = browser.isConnected

  def close(): F[Unit] =
    logger.debug(s"closing browser...") *>
      doClose.attemptTap {
        case Left(ExceptionMessage(error)) => logger.error(s"closing browser failed: $error")
        case Right(_)                      => logger.debug(s"browser closed")
      }

  def createPage(
    renderConfig: RenderConfig,
  ): Resource[F, Page[F]] = {
    Resource.eval {
      if (isConnected) F.pure(()) else F.raiseError(new RuntimeException("browser not connected"))
    } >>
      Resource
        .make(
          logger.debug(s"creating context...") >>
            fromBlocking(browser.newContext(new playwright.Browser.NewContextOptions().setUserAgent(userAgent)))
              .attemptTap {
                case Right(_)                      => logger.debug(s"created context")
                case Left(ExceptionMessage(error)) => logger.error(s"failed to create context: $error")
              }
        )(context =>
          logger.debug(s"closing context...") *>
            fromBlocking(context.close())
        ).flatMap { context =>
          Resource.make(
            fromBlocking(context.newPage())
              .flatMap { page => Page(page, renderConfig) }
              .attemptTap {
                case Right(_)                      => logger.debug(s"created page")
                case Left(ExceptionMessage(error)) => logger.error(s"failed to create page: $error")
              }
          )(page =>
            logger.debug(s"closing page...") *>
              Async[F].whenA(!page.isClosed)(page.close())
          )
        }

  }

}

object Browser {

  def apply[F[_]](
    options: BrowserConfig,
    userAgent: headers.`User-Agent`,
  )(implicit F: Async[F], logger: Logger[F]): F[Browser[F]] = {
    logger.debug(s"creating browser...") *>
      F.delay(Playwright.create().chromium())
        .flatMap { browserType =>
          val browser = options match {
            case BrowserConfig.Executable(path)          =>
              logger.debug(s"launching browser: $path ...") >>
                fromBlocking(
                  browserType.launch(new LaunchOptions().tap(a => a.setExecutablePath(Path.of(path))))
                )
            case BrowserConfig.CDPEndpoint(url, timeout) =>
              logger.debug(s"connecting to browser over CDP: $url (${timeout.getOrElse(5.seconds).toMillis}ms timeout)...") >>
                fromBlocking(
                  browserType.connectOverCDP(
                    url,
                    new BrowserType.ConnectOverCDPOptions().setTimeout(
                      timeout.getOrElse(5.seconds).toMillis.toDouble
                    )
                  )
                )
            case BrowserConfig.WsEndpoint(url, timeout)  =>
              logger.debug(s"connecting to browser over WS: $url (${timeout.getOrElse(5.seconds).toMillis}ms timeout)...") >>
                fromBlocking(
                  browserType.connect(
                    url,
                    new BrowserType.ConnectOptions().setTimeout(
                      timeout.getOrElse(5.seconds).toMillis.toDouble
                    )
                  )
                )
          }

          F.timeout(browser, 5.seconds).map { browser =>
            new Browser[F](
              browser,
              userAgent.value,
              fromBlocking {
                browser.close()
              }
            )
          }
        }
        .attemptTap {
          case Right(_)                      => logger.debug(s"created browser")
          case Left(ExceptionMessage(error)) => logger.error(s"failed to create browser: $error")
        }
  }

}
