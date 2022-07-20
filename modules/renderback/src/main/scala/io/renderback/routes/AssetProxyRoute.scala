package io.renderback.routes

import cats.effect.Async
import cats.syntax.all._
import fs2.Chunk
import fs2.Stream
import io.renderback.ProxiedAsset
import io.renderback.config.RouteRule
import io.renderback.scrape.ScrapeRegistry
import org.http4s.HttpRoutes
import org.http4s.Uri
import org.http4s.client.Client
import org.typelevel.log4cats.Logger

trait AssetProxyRoute[F[_]] {

  def mkRoutes(rule: RouteRule.AssetProxy): HttpRoutes[F]

}

object AssetProxyRoute {

  def apply[F[_]](
    client: Client[F],
    scrapeRegistry: ScrapeRegistry[F],
  )(implicit F: Async[F], logger: Logger[F]): AssetProxyRoute[F] = {
    val clientApp = client.toHttpApp

    (rule: RouteRule.AssetProxy) =>
      HttpRoutes.of[F] { request =>
        logger.debug(s"${request.uri} : proxying to ${rule.target} ...") *> {
          val uri = Uri.unsafeFromString(rule.target.toString()).withPath(request.uri.path)
          clientApp(request.withUri(uri))
            .flatMap { response =>
              F.ref(Vector.empty[Chunk[Byte]]).map { vec =>
                val newBody = Stream
                  .eval(vec.get)
                  .flatMap(v => Stream.emits(v).covary[F])
                  .flatMap(c => Stream.chunk(c).covary[F])

                response.withBodyStream(
                  // Cannot Be Done Asynchronously - Otherwise All Chunks May Not Be Appended Previous to Finalization
                  response.body
                    .observe(_.chunks.flatMap(c => Stream.exec(vec.update(_ :+ c))))
                    .onFinalizeWeak {
                      scrapeRegistry.registerProxiedAsset(
                        ProxiedAsset(
                          uri = uri,
                          redirect = None,
                          status = response.status,
                          content = newBody,
                          headers = response.headers
                        )
                      )
                    }
                )
              }
            }
        }
      }
  }

}
