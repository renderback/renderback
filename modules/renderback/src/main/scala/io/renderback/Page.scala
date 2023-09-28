package io.renderback

import cats.effect.kernel.Async
import cats.syntax.all._
import org.log4s.getLogger
import io.renderback.config.RenderConfig
import com.microsoft.playwright
import com.microsoft.playwright.ElementHandle
import com.microsoft.playwright.options.LoadState
import com.microsoft.playwright.options.WaitForSelectorState
import com.microsoft.playwright.options.WaitUntilState
import org.typelevel.log4cats.Logger

import scala.concurrent.duration.FiniteDuration
import scala.util.chaining._
import scala.jdk.CollectionConverters._
import scala.reflect.ClassTag

class Page[F[_]](page: playwright.Page)(implicit F: Async[F], logger: Logger[F]) {

  def navigate(
    url: String,
    timeout: Option[FiniteDuration] = none,
    waitUntil: WaitUntilState = WaitUntilState.NETWORKIDLE,
  ): F[playwright.Response] =
    fromBlocking(
      page.navigate(
        url,
        new playwright.Page.NavigateOptions()
          .tap(a => timeout.foreach(ta => a.setTimeout(ta.toMillis.toDouble)))
          .tap(a => a.setWaitUntil(waitUntil))
      )
    )

  private def consumer[T](handler: T => Unit): java.util.function.Consumer[T] = (t: T) => handler(t)

  def onRequest(
    handler: playwright.Request => Unit
  ): Unit = page.onRequest(consumer(handler))

  def onCrash(
    handler: playwright.Page => Unit
  ): Unit = page.onCrash(consumer(handler))

  def querySelector[T](selector: String): F[Option[ElementHandle]] = fromBlocking(Option(page.querySelector(selector)))

  def querySelectorAll[T](selector: String): F[Seq[ElementHandle]] = fromBlocking(Option(page.querySelectorAll(selector)).map(_.asScala.toSeq).getOrElse(Seq.empty))

  def evalOnSelector[ReturnType](
    selector: String,
    expression: String,
    arg: Any,
  )(implicit ct: ClassTag[ReturnType]): F[ReturnType] = fromBlocking(
    page.evalOnSelector(selector, expression, arg) match {
      case r: ReturnType => r
      case o             => throw new RuntimeException(s"Unexpected value returned from evalOnSelector: ${o.getClass.getSimpleName}, expected: ${ct.runtimeClass.getSimpleName}")
    }
  )

  def evalOnSelector[ReturnType](
    selector: String,
    expression: String,
  )(implicit ct: ClassTag[ReturnType]): F[ReturnType] = fromBlocking(
    page.evalOnSelector(selector, expression) match {
      case r: ReturnType => r
      case o             => throw new RuntimeException(s"Unexpected value returned from evalOnSelector: ${o.getClass.getSimpleName}, expected: ${ct.runtimeClass.getSimpleName}")
    }
  )

  def evalOnSelectorAll[ReturnType](
    selector: String,
    expression: String,
    arg: Any,
  )(implicit ct: ClassTag[ReturnType]): F[ReturnType] = fromBlocking(
    page.evalOnSelectorAll(selector, expression, arg) match {
      case r: ReturnType => r
      case o             => throw new RuntimeException(s"Unexpected value returned from evalOnSelectorAll: ${o.getClass.getSimpleName}, expected: ${ct.runtimeClass.getSimpleName}")
    }
  )

  def evalOnSelectorAll[ReturnType](
    selector: String,
    expression: String,
  )(implicit ct: ClassTag[ReturnType]): F[ReturnType] = fromBlocking(
    page.evalOnSelectorAll(selector, expression) match {
      case r: ReturnType => r
      case o             => throw new RuntimeException(s"Unexpected value returned from evalOnSelectorAll: ${o.getClass.getSimpleName}, expected: ${ct.runtimeClass.getSimpleName}")
    }
  )

  def evaluate[ReturnType](
    expression: String,
    arg: Any
  )(implicit ct: ClassTag[ReturnType]): F[ReturnType] = fromBlocking(
    page.evaluate(expression, arg) match {
      case r: ReturnType => r
      case o             => throw new RuntimeException(s"Unexpected value returned from evaluate: ${o.getClass.getSimpleName}, expected: ${ct.runtimeClass.getSimpleName}")
    }
  )

  def waitForNavigation(
    url: String,
    timeout: Option[FiniteDuration] = none,
    waitUntil: Option[WaitUntilState] = none,
  ): F[Unit] = {
    fromBlocking(
      page.waitForURL(
        url,
        new playwright.Page.WaitForURLOptions()
          .tap(a => waitUntil.foreach(a.setWaitUntil))
          .tap(a => timeout.map(_.toMillis.toDouble).foreach(a.setTimeout)),
      )
    )
  }

  def waitForNetworkIdle(
    timeout: Option[FiniteDuration] = none
  ): F[Unit] =
    fromBlocking(
      page.waitForLoadState(
        LoadState.NETWORKIDLE,
        new playwright.Page.WaitForLoadStateOptions()
          .tap(a => timeout.map(_.toMillis.toDouble).foreach(a.setTimeout))
      )
    )

//  def waitFor(
//    selectorOrFunctionOrTimeout: String | Float | js.Function,
//    options: Option[WaitForElementOptions],
//    args: js.Any*
//  ): F[JSHandle] = fromPromise(page.waitFor(selectorOrFunctionOrTimeout, options, args))

  def waitForSelector(
    selector: String,
    timeout: Option[FiniteDuration] = none,
    state: Option[WaitForSelectorState] = none,
  ): F[ElementHandle] =
    fromBlocking(
      page.waitForSelector(
        selector,
        new playwright.Page.WaitForSelectorOptions()
          .tap(a => timeout.map(_.toMillis.toDouble).foreach(a.setTimeout))
          .tap(a => state.foreach(a.setState))
      )
    )

//  def screenshot(
//    captureBeyondViewport: Option[Boolean] = none,
//    clip: Option[puppeteer.ScreenshotClip] = none,
//    encoding: Option[puppeteerCoreStrings.base64 | puppeteerCoreStrings.binary] = none,
//    fullPage: Option[Boolean] = none,
//    omitBackground: Option[Boolean] = none,
//    path: Option[String] = none,
//    quality: Option[Double] = none,
//    `type`: Option[puppeteerCoreStrings.png | puppeteerCoreStrings.jpeg | puppeteerCoreStrings.webp] = none
//  ): F[Buffer | String] =
//    fromBlocking(
//      page.screenshot(
//        ScreenshotOptions()
//          .tap(a => captureBeyondViewport.foreach(a.setCaptureBeyondViewport))
//          .tap(a => clip.foreach(a.setClip))
//          .tap(a => encoding.foreach(a.setEncoding))
//          .tap(a => fullPage.foreach(a.setFullPage))
//          .tap(a => omitBackground.foreach(a.setOmitBackground))
//          .tap(a => path.foreach(a.setPath))
//          .tap(a => quality.foreach(a.setQuality))
//          .tap(a => `type`.foreach(a.setType))
//      )
//    )

  def title(): F[String] = fromBlocking(page.title())

  def isClosed: Boolean = page.isClosed

  def url(): String = page.url()

  def content(): F[String] = fromBlocking(page.content())

  def close(
    runBeforeUnload: Option[Boolean] = none
  ): F[Unit] =
    fromBlocking(
      page.close(
        new playwright.Page.CloseOptions()
          .tap(a => runBeforeUnload.foreach(a.setRunBeforeUnload))
      )
    ).attemptTap {
      case Left(ExceptionMessage(error)) => logger.error(s"closing page failed: $error")
      case Right(_)                      => logger.debug(s"page closed")
    }

}

object Page {

  private val rawLogger = getLogger

  private val resourcesToAbort = Set("image", "stylesheet", "media", "font")
  private val xhrResources     = Set("xhr", "fetch")
  private val wsResources      = Set("websocket")
  private val otherResources   = Set("other")

  def apply[F[_]](
    page: playwright.Page,
    renderConfig: RenderConfig,
  )(implicit F: Async[F]): F[Page[F]] =
    Async[F]
      .pure(new Page(page))
      .flatTap { _ =>
        Async[F].delay {

          def isRequestBlacklisted(request: playwright.Request): Boolean =
            renderConfig.requestBlacklist.exists(pattern => request.url().matches(pattern))

          page.onPageError(err => rawLogger.debug(s"[page] error: $err"))
          page.onConsoleMessage(message => {
            if (message.args().size() > 0) {
              message
                .args().asScala.toList.map { arg => arg.jsonValue() }
                .pipe { values =>
                  rawLogger.trace(s"[page] console: ${values.mkString(" ")}")
                }
            }
          })
          page.onResponse(response => {
            rawLogger.trace(s"[page] response: ${response.status()} ${response.url()} ${response.headers().asScala}")
          })

          page.onRequestFailed(request => {
            val resourceRequest = resourcesToAbort.contains(request.resourceType())
            val failure         = Option(request.failure())
            val aborted         = failure.exists(_.contains("net::ERR_ABORTED"))
            val blacklisted     = isRequestBlacklisted(request)

            if (
              !aborted &&
              !blacklisted &&
              resourceRequest &&
              !renderConfig.abortResourceRequests
            ) {
              rawLogger.error(s"[page] request failed: ${request.resourceType()} $failure ${request.url()}")
            }

          })

          if (renderConfig.abortResourceRequests) {
            rawLogger.debug("[create-page] will abort resource requests")
          } else {
            rawLogger.debug("[create-page] will NOT abort resource requests")
          }
          if (renderConfig.requestBlacklist.nonEmpty) {
            rawLogger.debug(s"[create-page] will abort blacklisted requests: ${renderConfig.requestBlacklist}")
          }
          page.route(
            (_: String) => true,
            { route =>
              val request     = route.request()
              rawLogger.trace(s"[page] request, type: ${request.resourceType()}: ${request.url()}")
              val shouldAbort = LazyList(
                () => renderConfig.abortResourceRequests && resourcesToAbort.contains(request.resourceType()),
                () => request.resourceType() == "cspviolationreport",
                () => !renderConfig.allowXHR && xhrResources.contains(request.resourceType()),
                () => !renderConfig.allowWS && wsResources.contains(request.resourceType()),
                () => !renderConfig.allowOtherRequests && otherResources.contains(request.resourceType())
              ).exists(_())

              if (shouldAbort) {
                rawLogger.trace(s"[page] request aborted, type: ${request.resourceType()}: ${request.url()}")
                route.abort()
              } else if (isRequestBlacklisted(request)) {
                rawLogger.trace(s"[page] request aborted, blacklisted: ${request.url()}")
                route.abort()
              } else {
                route.resume()
              }
            }
          )
        }
      }

}
