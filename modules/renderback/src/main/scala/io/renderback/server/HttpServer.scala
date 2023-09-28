package io.renderback.server

import cats.data.Kleisli
import cats.data.OptionT
import cats.effect.Async
import cats.effect.Resource
import cats.syntax.all._
import fs2.io.file.Files
import fs2.io.net.Network
import org.http4s.HttpApp
import org.http4s.HttpRoutes
import org.http4s.Request
import org.http4s.Response
import org.http4s.dsl.Http4sDsl
import org.http4s.ember.client.EmberClientBuilder
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.server.Server
import org.http4s.server.websocket.WebSocketBuilder2
import io.renderback.cache.RenderCache
import io.renderback.CachedBrowser
import io.renderback.ContinueIf
import io.renderback.RenderQueue
import io.renderback.config.BindConfig
import io.renderback.config.RenderbackConfig
import io.renderback.config.RouteMatcher
import io.renderback.config.RouteRule
import io.renderback.config.SiteConfig
import io.renderback.render.RenderPage
import io.renderback.render.RenderUrl
import io.renderback.routes._
import io.renderback.scrape.ScrapeRegistry
import org.http4s.headers.Host
import org.typelevel.log4cats.Logger

import scala.concurrent.duration._
import scala.annotation.unused
import scala.util.control.NonFatal

class HttpServer[F[_]: Async: Files: Network](
  bindConfig: BindConfig,
  hosts: () => F[Seq[SiteConfig[F]]],
  pageRoute: PageRoute[F],
  pageProxyRoute: PageProxyRoute[F],
  assetRoute: AssetRoute[F],
  assetProxyRoute: AssetProxyRoute[F],
  proxyRoute: ProxyRoute[F],
  staticRoute: StaticRoute[F],
)(implicit logger: Logger[F]) {

  private def pathMatcher(matcher: RouteMatcher): String => Boolean = pathString => {
    val pathMatches    = () =>
      matcher.path.fold(true) { paths =>
        paths.exists(path =>
          if (path.endsWith("*")) {
            pathString.startsWith(path.dropRight(1))
          } else {
            pathString == path
          }
        )
      }
    val extMatches     = () =>
      matcher.ext.fold(true) { exts =>
        exts.exists(ext => pathString.endsWith(s".$ext"))
      }
    val regexMatches   = () =>
      matcher.regex.fold(true) { regexes =>
        regexes.exists(regex => pathString.matches(regex))
      }
    val excludeMatches = () =>
      matcher.regex.fold(true) { regexes =>
        !regexes.exists(regex => pathString.matches(regex))
      }
    val noExtMatch     = () =>
      matcher.noExt.fold(true) { noExt =>
        !noExt || pathString.split('/').lastOption.forall(!_.contains('.'))
      }
    pathMatches() && noExtMatch() && extMatches() && regexMatches() && excludeMatches()
  }

  private def matcher(rule: RouteRule): Kleisli[OptionT[F, *], Request[F], Request[F]] =
    ContinueIf { request =>
      pathMatcher(rule.matcher)(request.uri.path.renderString)
    }

  private def app(@unused wsb: WebSocketBuilder2[F]): HttpApp[F] = {
    val dsl = new Http4sDsl[F] {}
    import dsl._

    def hostRule(siteConfig: SiteConfig[F]): HttpRoutes[F] = {
      ContinueIf[F] { request =>
        val requestHost = request.headers.get[Host].map(_.host)
        requestHost.contains(siteConfig.internalHost.value) ||
        requestHost.contains(siteConfig.host.value)
      }.andThen {
        concat(siteConfig.routes.map(ruleRoute(siteConfig, _)))
      }
    }

    def ruleRoute(siteConfig: SiteConfig[F], rule: RouteRule): HttpRoutes[F] = {
      matcher(rule).andThen {
        rule match {
          case r: RouteRule.Page       => pageRoute.mkRoutes(siteConfig, r)
          case r: RouteRule.PageProxy  => pageProxyRoute.mkRoutes(siteConfig, r)
          case r: RouteRule.Asset      => assetRoute.mkRoutes(r)
          case r: RouteRule.AssetProxy => assetProxyRoute.mkRoutes(r)
          case r: RouteRule.Proxy      => proxyRoute.mkRoutes(r)
          case r: RouteRule.Static     => staticRoute.mkRoutes(r)
        }
      }
    }

    val app = Kleisli[F, Request[F], Response[F]] { request =>
      hosts().flatMap { hosts =>
        concat(hosts.map(hostRule)).orNotFound(request)
      }
    }

    Kleisli((request: Request[F]) =>
      logger.info(s"${request.httpVersion} ${request.method} ${request.uri} ${request.headers}") >>
        app(request)
          .flatMap { response =>
            if (response.status.isSuccess) {
              response.pure[F]
            } else {
              logger
                .info(s"${request.httpVersion} ${request.method} ${request.uri}: ${response.status}") *> response.pure[F]
            }
          }
    )
  }

  def bind: Resource[F, Server] =
    for {
      server <- EmberServerBuilder
                  .default[F]
                  .withHost(bindConfig.host)
                  .withPort(bindConfig.port)
                  .withHttpWebSocketApp(app)
                  .withShutdownTimeout(2.seconds)
                  .withErrorHandler { case NonFatal(error) =>
                    logger.error(error)(s"unhandled error") *>
                      Async[F].raiseError(error)
                  }
                  .build
                  .onFinalize {
                    logger.info("stopping server")
                  }
    } yield server

}

object HttpServer {

  def apply[F[_]: Files: Network](
    bindConfig: BindConfig,
    renderbackConfig: RenderbackConfig,
    renderPage: RenderPage[F],
    renderCache: RenderCache[F],
    hosts: () => F[Seq[SiteConfig[F]]],
    browser: CachedBrowser[F],
  )(implicit F: Async[F], logger: Logger[F]): Resource[F, Server] =
    for {
      client         <- EmberClientBuilder.default[F].build
      renderUrl       = RenderUrl[F](browser, renderPage)
      renderQueue    <- Resource.eval(RenderQueue.withCache(5, renderCache, renderUrl, renderbackConfig))
      pageRoute       = PageRoute[F](renderQueue)
      pageProxyRoute  = PageProxyRoute[F](client, renderQueue)
      assetRoute      = AssetRoute[F]()
      assetProxyRoute = AssetProxyRoute[F](client, ScrapeRegistry.noop)
      proxyRoute      = ProxyRoute[F](client)
      staticRoute     = StaticRoute[F]()
      server         <- new HttpServer[F](
                          bindConfig,
                          hosts,
                          pageRoute,
                          pageProxyRoute,
                          assetRoute,
                          assetProxyRoute,
                          proxyRoute,
                          staticRoute,
                        ).bind
    } yield server

}
