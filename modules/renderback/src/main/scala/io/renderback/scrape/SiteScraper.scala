package io.renderback
package scrape

import cats.data.OptionT
import cats.syntax.all._
import cats.effect.Async
import cats.effect.Clock
import com.microsoft.playwright.Request
import com.microsoft.playwright.options.WaitUntilState
import org.http4s.Uri
import io.renderback.CachedBrowser
import io.renderback.RenderResult
import io.renderback.StatusEvent
import io.renderback.StatusReport
import io.renderback.cache.RenderCache
import io.renderback.config.SiteConfig
import io.renderback.config.ScrapeConfig
import io.renderback.render.RenderPage
import io.renderback.timing.StopWatch
import io.renderback.toolkit.redirectChain

object SiteScraper {

  def apply[F[_]: Clock](
    siteConfig: SiteConfig[F],
    browser: CachedBrowser[F],
    renderPage: RenderPage[F],
    config: ScrapeConfig,
    report: StatusReport[F],
    renderCache: RenderCache[F],
  )(implicit F: Async[F]): F[ScrapeResult[F]] = {
    val extractLinks = ExtractLinks(config.origins.map(u => Uri.unsafeFromString(u.toString())), config.exclude)
    val stopWatch    = StopWatch[F]

    ScrapeRegistry(config.depth, extractLinks).flatMap { scrapeRegistry =>
      browser.use { browser =>
        browser.createPage(siteConfig.render).use { page =>

          def processPaths: F[Unit] =
            OptionT(scrapeRegistry.next)
              .semiflatMap {
                processPath(_) >> processPaths
              }
              .getOrElse(())

          def processPath(uri: UriToVisit): F[RenderResult] = {
            val selfUri = siteConfig.browserUri(uri.uri.path)
            logProgress(uri.uri, uri.depth) >>
              stopWatch(navigate(selfUri) >> renderPage(siteConfig.render, siteConfig.stages, siteConfig.rewrite, page))
                .map { case (result, time) => result.withTimeToRender(time) }
                .flatTap(renderCache.cacheRenderResult(siteConfig, _))
                .flatTap(logResult(uri.uri, _))
                .flatTap(scrapeRegistry.registerRenderResult) <*
              extractLinks(uri.depth)
          }

          def extractLinks(depth: Int): F[Unit] = scrapeRegistry.scanForLinks(page, depth)

          def navigate(uri: Uri): F[List[Request]] =
            report.event(StatusEvent.Navigating(uri)) >>
              page.navigate(uri.renderString).map(_.request()).map(redirectChain)

          def logProgress(path: Uri, depth: Int): F[Unit] =
            (scrapeRegistry.visitedUrisCount, scrapeRegistry.remainingUrisCount).tupled.flatMap { case (visited, remaining) =>
              report.event(StatusEvent.Rendering(path, depth)) >>
                report.event(StatusEvent.VisitedCount(visited)) >>
                report.event(StatusEvent.RemainingCount(remaining))
            }

          def logResult(path: Uri, result: RenderResult): F[Unit] =
            report.event(StatusEvent.Rendered(path, result.timeToRender))

          def logDone: F[Unit] =
            scrapeRegistry.visitedUrisCount.flatMap { visited =>
              report.event(StatusEvent.Done(visited))
            }

          report.event(StatusEvent.InitializingScraper()) >>
            scrapeRegistry.markSeen(config.paths.map(u => Uri.unsafeFromString(u.toString()))) >>
            scrapeRegistry.addInitialUrisToVisit(config.paths.map(u => Uri.unsafeFromString(u.toString()))) >>
            processPaths.flatTap(_ => logDone) >>
            (scrapeRegistry.renderResults, scrapeRegistry.proxiedAssets).mapN(ScrapeResult(_, _))

        }
      }

    }
  }

}
