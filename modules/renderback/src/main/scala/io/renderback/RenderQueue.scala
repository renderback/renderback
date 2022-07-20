package io.renderback

import cats.syntax.all._
import cats.data.OptionT
import cats.effect.Async
import cats.effect.std.Semaphore
import org.typelevel.ci._
import fs2.io.file.Files
import io.renderback.cache.RenderCache
import io.renderback.config.SiteConfig
import io.renderback.config.RenderbackConfig
import io.renderback.render.RenderUrl
import io.renderback.routes.StaticFile
import io.renderback.routes.response
import org.http4s.Header
import org.http4s.HttpDate
import org.http4s.HttpRoutes
import org.http4s.Request
import org.http4s.Response
import org.http4s.Uri
import org.http4s.headers
import org.http4s.headers.ETag
import org.typelevel.log4cats.Logger

trait RenderQueue[F[_]] {

  def apply(siteConfig: SiteConfig[F])(self: Request[F] => OptionT[F, Response[F]]): HttpRoutes[F]

}

object RenderQueue {

  def withCache[F[_]: Files](
    concurrentRenderings: Int,
    renderCache: RenderCache[F],
    renderUrl: RenderUrl[F],
    renderbackConfig: RenderbackConfig,
  )(implicit F: Async[F], logger: Logger[F]): F[RenderQueue[F]] =
    Semaphore[F](concurrentRenderings.toLong).flatMap { concurrencySemaphore =>
      F.ref(Map.empty[Uri, Semaphore[F]]).map { uriSemaphores =>

        def getSemaphore(uri: Uri): F[Semaphore[F]] =
          Semaphore[F](1).flatMap { newSem =>
            uriSemaphores.modify[Semaphore[F]] { map =>
              map.get(uri) match {
                case Some(sem) => (map, sem)
                case None      => (map.updated(uri, newSem), newSem)
              }
            }
          }

        new RenderQueue[F] {

          private def findCached(
            siteConfig: SiteConfig[F],
            request: Request[F]
          ): F[Option[Response[F]]] =
            OptionT(renderCache.getMetaData(siteConfig, request.uri)).flatMap { cached =>
              OptionT
                .fromOption(StaticFile.notModified(request.some, ETag(cached.etag), HttpDate.unsafeFromEpochSecond(cached.lastModified.toSeconds).some))
                .orElse {
                  StaticFile.fromPathCompressed(cached.contentFile, request.some)
                }
            }.value

          def apply(siteConfig: SiteConfig[F])(self: Request[F] => OptionT[F, Response[F]]): HttpRoutes[F] =
            HttpRoutes[F] {
              case renderbackConfig.SelfRequest(request) =>
                OptionT.liftF(logger.trace(s"${request.uri} - request from renderer: ${request.headers.get[headers.`User-Agent`]}")) >> self(request)
              case request                               =>
                OptionT.liftF(logger.trace(s"${request.uri} - request from world: ${request.headers.get[headers.`User-Agent`]}")) >>
                  OptionT {
                    findCached(siteConfig, request).flatMap {
                      case Some(response) => response.some.pure[F]
                      case None           =>
                        getSemaphore(request.uri).flatMap { sem =>
                          sem.permit.use { _ =>
                            findCached(siteConfig, request).flatMap {
                              case Some(response) => response.some.pure[F]
                              case None           =>
                                concurrencySemaphore.permit.use { _ =>
                                  logger.debug(s"${request.uri} rendering...") >>
                                    renderUrl(
                                      siteConfig.browserUri(request.uri),
                                      siteConfig.render,
                                      siteConfig.stages,
                                      siteConfig.rewrite,
                                    ).flatMap { r =>
                                      if (r.status >= 200 && r.status < 300) {
                                        OptionT
                                          .liftF(renderCache.cacheRenderResult(siteConfig, r)).flatMap { cached =>
                                            StaticFile
                                              .fromPathCompressed(
                                                cached.contentFile,
                                                request.some,
                                              ).map { resp =>
                                                r.timeToRender.fold(resp) { timeToRender =>
                                                  resp.putHeaders(
                                                    Header.Raw(
                                                      ci"Server-Timing",
                                                      s"""Prerender;dur=${timeToRender.toMillis};desc="Headless render time (ms)""""
                                                    )
                                                  )
                                                }
                                              }
                                          }
                                          .value
                                      } else {
                                        F.pure {
                                          response[F](
                                            r.status,
                                            r.content,
                                            r.headers,
                                            r.etag,
                                            r.lastModified,
                                            r.timeToRender
                                          ).some
                                        }
                                      }
                                    }
                                }
                            }
                          }
                        }
                    }
                  }
            }
        }
      }
    }

}
