package io.renderback
package cache

import cats.data.OptionT
import cats.effect.Async
import cats.effect.Ref
import cats.effect.Resource
import cats.syntax.all._
import fs2.compression.Compression
import fs2.io.file.Files
import fs2.io.file.Path
import io.circe.generic.JsonCodec
import io.circe.parser._
import io.circe.syntax._
import io.renderback.config.CacheConfig
import io.renderback.config.SiteConfig
import org.http4s.Headers
import org.http4s.Uri
import org.typelevel.log4cats.Logger

import java.util.UUID
import scala.concurrent.duration.FiniteDuration

@JsonCodec
case class RenderResultMetaData(
  status: Int,
  lastModified: FiniteDuration,
  etag: String,
  headers: Headers,
  contentFile: Path,
  contentFileGz: Option[Path] = None,
  contentFileBr: Option[Path] = None,
)

class RenderCache[F[_]: Files: Compression](cache: SimpleCache[F], cacheDir: Path)(implicit F: Async[F], logger: Logger[F]) {

  private def _key(siteConfig: SiteConfig[F], uri: Uri): Seq[String] = {
    Seq(
      siteConfig.internalHost.renderString,
      uri.path.renderString
    )
  }

  private def metaData(
    renderResult: RenderResult,
    cacheDir: Path
  ): F[RenderResultMetaData] = {
    Async[F]
      .delay(UUID.randomUUID().toString)
      .map { randomUUID =>
        val cacheFile = cacheDir.resolve(
          Seq(
            renderResult.uri.authority.fold("no-host")(_.host.renderString),
            randomUUID.replace('-', '/'),
            renderResult.uri.path.segments
              .map(_.toString.replaceAll("[^a-zA-Z0-9-_.]]", ""))
              .mkString("-", "-", "-")
              .takeRight(36)
          ).mkString("/")
        )
        RenderResultMetaData(
          status = renderResult.status,
          lastModified = renderResult.lastModified,
          etag = renderResult.etag,
          headers = renderResult.headers,
          contentFile = cacheFile,
        )
      }
  }

  def getMetaData(siteConfig: SiteConfig[F], uri: Uri): F[Option[RenderResultMetaData]] = {
    val key = _key(siteConfig, uri)
    OptionT(cache.get(Seq("meta") ++ key: _*))
      .semiflatMap { string =>
        F.fromEither(decode[RenderResultMetaData](string))
      }
      .flatMapF { result =>
        Files[F].isReadable(result.contentFile).map {
          case true  => result.some
          case false => none
        }
      }
      .value
      .flatTap { result =>
        logger.debug(s"cache get $key: ${if (result.isDefined) "hit" else "miss"}")
      }
  }

  private def gzipFile(contentFile: Path): F[Path] =
    FilePipe(
      contentFile,
      Path(contentFile.toString + ".gz"),
      Compression[F].gzip()
    )

  def cacheRenderResult(
    siteConfig: SiteConfig[F],
    renderResult: RenderResult,
  ): F[RenderResultMetaData] = {
    val key = _key(siteConfig, renderResult.uri)
    logger.debug(s"caching result for ${renderResult.uri}") >>
      metaData(renderResult, cacheDir).flatMap { entry =>
        entry.contentFile.parent.traverse(Files[F].createDirectories) >>
          fs2
            .Stream(renderResult.content)
            .through(fs2.text.utf8.encode)
            .through(Files[F].writeAll(entry.contentFile))
            .compile
            .drain >>
          gzipFile(entry.contentFile).flatMap { gz =>
            val entryWithCompressed = entry.copy(
              contentFileGz = gz.some,
              contentFileBr = none,
            )
            cache.put(Seq("meta") ++ key: _*)(entryWithCompressed.asJson.noSpaces).as(entryWithCompressed)
          }
      }
  }

}

trait SimpleCache[F[_]] {

  def get(key: String*): F[Option[String]]
  def put(
    key: String*
  )(
    value: String,
  ): F[String]

}

object RenderCache {

  def fromConfig[F[_]: Files: Compression](
    config: CacheConfig,
  )(implicit F: Async[F]): Resource[F, RenderCache[F]] = {
    val cache: Resource[F, SimpleCache[F]] = config match {
      case r: CacheConfig.Redis => redis(r)
      case CacheConfig.Mem(_)   => Resource.eval(inMemory[F])
    }
    cache.map(c => new RenderCache(c, config.cacheDir))
  }

  def inMemory[F[_]: Async: Files]: F[SimpleCache[F]] =
    Ref.of[F, Map[String, String]](Map.empty).map { cache =>

      new SimpleCache[F] {
        def get(key: String*): F[Option[String]] = cache.get.map(_.get(key.mkString(":")))
        def put(
          key: String*
        )(value: String): F[String] = cache.updateAndGet(_.updated(key.mkString(":"), value)).as(value)
      }

    }

  def redis[F[_]](config: CacheConfig.Redis)(implicit F: Async[F]): Resource[F, SimpleCache[F]] =
    RedisClient[F](config.host, config.port, config.password, Seq("renderback", "cache")).map { client =>

      new SimpleCache[F] {
        def get(key: String*): F[Option[String]] = client.get(key: _*)
        def put(
          key: String*
        )(value: String): F[String] = client.put(key: _*)(value).as(value)
      }

    }

}
