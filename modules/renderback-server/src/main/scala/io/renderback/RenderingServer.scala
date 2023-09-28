package io.renderback

import cats.effect._
import cats.syntax.all._
import cats.effect.syntax.all._
import fs2.compression.Compression
import fs2.io.file.Files
import fs2.io.file.Path
import fs2.io.net.Network
import io.lemonlabs.uri.Url
import io.renderback.config.BindConfig
import io.renderback.config.CacheConfig
import io.renderback.config.CacheType
import io.renderback.config.EnvConfig
import io.renderback.config.SiteConfig
import io.renderback.config.ParsedSiteConfig
import io.renderback.config.RenderbackConfig
import io.renderback.render.RemoveCssSelectorsStage
import io.renderback.render.RenderPage
import io.renderback.render.UpdateCssSelectorsStage
import io.renderback.render.UrlRewriteStage
import io.renderback.scrape.SiteScraper
import io.renderback.server.HttpServer
import io.renderback.cache.RenderCache
import org.http4s.Uri
import org.typelevel.log4cats.Logger

object RenderingServer {

  def start[F[_]: Files: Compression: Network](s: StartServerCommand)(implicit F: Async[F], logger: Logger[F]): Resource[F, Unit] = {
    for {
      envConfig       <- Resource.eval { EnvConfig.readEnv[F] }
      siteConfig      <- DecodeConfig[F, ParsedSiteConfig](Path(s.configPath))
      host            <- Resource.eval { F.pure(s.host.getOrElse(envConfig.bindHost)).flatTap(h => logger.info(s"bind host: $h")) }
      port            <- Resource.eval { F.pure(s.port.getOrElse(envConfig.bindPort)).flatTap(p => logger.info(s"bind port: $p")) }
      bindConfig       = BindConfig(host, port)
      renderbackConfig = RenderbackConfig(envConfig.browserUserAgent, envConfig.browserRetries)
      browser         <- CachedBrowser[F](envConfig.browser, renderbackConfig)
      renderPage       = RenderPage[F]
      cacheConfig      = envConfig.cacheType match {
                           case CacheType.Mem   => CacheConfig.Mem(envConfig.cacheDir)
                           case CacheType.Redis =>
                             CacheConfig.Redis(
                               envConfig.cacheDir,
                               host = envConfig.redis.host,
                               port = envConfig.redis.port,
                               password = envConfig.redis.password
                             )
                         }
      renderCache     <- RenderCache.fromConfig(cacheConfig)
      hosts            = Seq(siteConfig).map { site =>
                           SiteConfig[F](
                             routes = site.routes,
                             render = site.render,
                             preRender = site.preRender,
                             rewrite = site.rewrite,
                             urlRewrite = site.urlRewrite,
                             stages = Seq(
                               UrlRewriteStage(site.urlRewrite),
                               RemoveCssSelectorsStage(site.rewrite),
                               UpdateCssSelectorsStage(site.rewrite)
                             ),
                             host = Uri.Host.fromIp4sHost(site.host.getOrElse(envConfig.internalHost)),
                             internalHost = Uri.Host.fromIp4sHost(site.internalHost.getOrElse(envConfig.internalHost)),
                             internalPort = site.internalPort.getOrElse(bindConfig.port),
                             browserUrl = site.browserUrl.map(u => Uri.unsafeFromString(u.toString())),
                           )
                         }
      server          <- HttpServer(bindConfig, renderbackConfig, renderPage, renderCache, () => F.pure(hosts), browser)
      _               <- Resource.eval(logger.info(s"Server has started: ${server.baseUri}"))
      _               <- hosts.traverse { h =>
                           h.preRender match {
                             case scrapeConfig if scrapeConfig.paths.nonEmpty =>
                               SiteScraper(
                                 siteConfig = h,
                                 browser = browser,
                                 renderPage = renderPage,
                                 config = scrapeConfig.copy(
                                   origins = Set(
                                     Url(
                                       host = h.internalHost.renderString,
                                       port = h.internalPort.value
                                     )
                                   )
                                 ),
                                 report = StatusReport.log,
                                 renderCache = renderCache,
                               ).onError { case ExceptionMessage(error) =>
                                 logger.error(s"pre-render failed: $error")
                               }.flatTap { scrapeResult =>
                                   logger.info(s"pre-render finished") *>
                                     scrapeResult.renderResults.traverse(r => logger.info(s"  - ${r.uri} ${r.timeToRender.fold("")(" - " + _.toMillis.toString) + "ms"}")).void
                                 }.background
                             case _                                           =>
                               logger.debug(s"pre-render not configured").background
                           }
                         }
    } yield ()
  }

}
