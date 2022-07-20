package io.renderback.scrape

import cats.Monad
import cats.syntax.all._
import cats.effect.Async
import cats.effect.Ref
import org.http4s.Uri
import org.log4s.getLogger
import io.renderback.Page
import io.renderback.ProxiedAsset
import io.renderback.RenderResult
import org.typelevel.log4cats.Logger

trait ScrapeRegistry[F[_]] {

  def scanForLinks(page: Page[F], scrapeDepth: Int): F[Unit]
  def markSeen(paths: Seq[Uri]): F[Unit]
  def addInitialUrisToVisit(paths: Seq[Uri]): F[Unit]
  def addUrisToVisit(paths: Seq[UriToVisit]): F[Unit]
  def visitedUrisCount: F[Int]
  def remainingUrisCount: F[Int]
  def next: F[Option[UriToVisit]]
  def registerRenderResult(result: RenderResult): F[Unit]
  def registerProxiedAsset(asset: ProxiedAsset[F]): F[Unit]
  def renderResults: F[Seq[RenderResult]]
  def proxiedAssets: F[Seq[ProxiedAsset[F]]]

}

final case class UriToVisit(
  uri: Uri,
  depth: Int
)

object ScrapeRegistry {

  def apply[F[_]: Async](
    maxDepth: Int,
    extractLinks: ExtractLinks[F]
  )(implicit logger: Logger[F]): F[ScrapeRegistry[F]] = {
    for {
      seenUris    <- Ref.of[F, Set[Uri]](Set.empty)
      visitedUris <- Ref.of[F, Set[Uri]](Set.empty)
      urisToVisit <- Ref.of[F, Seq[UriToVisit]](Seq.empty)
      results     <- Ref.of[F, Seq[RenderResult]](Seq.empty)
      assets      <- Ref.of[F, Seq[ProxiedAsset[F]]](Seq.empty)
    } yield new ScrapeRegistry[F] {

      def scanForLinks(page: Page[F], depth: Int): F[Unit] = {
        if (depth <= maxDepth) {
          logger.debug(s"scraping page, depth: $depth ...") >>
            extractLinks(page)
              .flatTap { uris =>
                logger.info(s"found links: ${uris.size}")
              }
              .flatMap { uris =>
                uris.traverse { uri =>
                  (
                    seenUris.get.map(_.contains(uri)),
                    urisToVisit.get.map(_.exists(_.uri == uri))
                  ).tupled.flatMap { case (seen, enqueued) =>
                    if (seen || enqueued) {
                      ().pure[F]
                    } else {
                      logger.debug(s"found link: $uri") >>
                        seenUris.update(_ + uri) >>
                        urisToVisit.update(
                          _ :+ UriToVisit(
                            uri = uri,
                            depth = depth + 1
                          )
                        )
                    }
                  }
                }.void
              }
        } else {
          logger.debug(s"not scraping: $depth > $maxDepth")
        }

      }

      def markSeen(paths: Seq[Uri]): F[Unit] =
        seenUris.update(_ ++ paths)

      def addInitialUrisToVisit(initialPaths: Seq[Uri]): F[Unit] =
        addUrisToVisit(initialPaths.map(UriToVisit(_, depth = 1)))

      def addUrisToVisit(paths: Seq[UriToVisit]): F[Unit] =
        urisToVisit.update(_ ++ paths)

      def visitedUrisCount: F[Int] =
        visitedUris.get.map(_.size)

      def remainingUrisCount: F[Int] =
        urisToVisit.get.map(_.size)

      def next: F[Option[UriToVisit]] = {
        visitedUris.get.flatMap { visited =>
          urisToVisit
            .modify { paths =>
              val filtered = paths.filterNot(p => visited.contains(p.uri))
              filtered.headOption match {
                case Some(nextInQueue) => (filtered.tail, nextInQueue.some)
                case None              => (filtered, none)
              }
            }.flatTap {
              case Some(nextInQueue) => visitedUris.update(_ + nextInQueue.uri)
              case None              => ().pure[F]
            }
        }
      }

      def registerRenderResult(result: RenderResult): F[Unit] = results.update(_ :+ result)

      def registerProxiedAsset(asset: ProxiedAsset[F]): F[Unit] = assets.update(_ :+ asset)

      def renderResults: F[Seq[RenderResult]] = results.get

      def proxiedAssets: F[Seq[ProxiedAsset[F]]] = assets.get

    }
  }

  def noop[F[_]: Monad]: ScrapeRegistry[F] = new ScrapeRegistry[F] {

    def scanForLinks(page: Page[F], scrapeDepth: Int): F[Unit] = ().pure[F]

    def markSeen(paths: Seq[Uri]): F[Unit] = ().pure[F]

    def addInitialUrisToVisit(paths: Seq[Uri]): F[Unit] = ().pure[F]

    def addUrisToVisit(paths: Seq[UriToVisit]): F[Unit] = ().pure[F]

    def visitedUrisCount: F[Int] = 0.pure[F]

    def remainingUrisCount: F[Int] = 0.pure[F]

    def next: F[Option[UriToVisit]] = none[UriToVisit].pure[F]

    def registerRenderResult(result: RenderResult): F[Unit] = ().pure[F]

    def registerProxiedAsset(asset: ProxiedAsset[F]): F[Unit] = ().pure[F]

    def renderResults: F[Seq[RenderResult]] = Seq.empty[RenderResult].pure[F]

    def proxiedAssets: F[Seq[ProxiedAsset[F]]] = Seq.empty[ProxiedAsset[F]].pure[F]

  }

}
