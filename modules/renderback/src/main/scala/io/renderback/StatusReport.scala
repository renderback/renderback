package io.renderback

import cats.effect.Sync
import org.log4s.getLogger
import org.typelevel.log4cats.Logger

trait StatusReport[F[_]] {

  def event(e: StatusEvent): F[Unit]

}

object StatusReport {

  def log[F[_]: Sync](implicit logger: Logger[F]): StatusReport[F] = new StatusReport[F] {

    def event(e: StatusEvent): F[Unit] = e match {
      case StatusEvent.InitializingScraper() => logger.debug(s"initiating the scraper...")
      case StatusEvent.Rendering(uri, depth) => logger.debug(s"rendering $uri depth: $depth")
      case StatusEvent.Rendered(uri, time)   => logger.info(s"rendered $uri in ${time.map(_.toMillis).fold("")(s => s"$s ms")}")
      case StatusEvent.Navigating(uri)       => logger.debug(s"navigating to: $uri")
      case StatusEvent.VisitedCount(count)   => logger.debug(s"visited: $count pages")
      case StatusEvent.RemainingCount(count) => logger.debug(s"remaining: $count pages")
      case StatusEvent.Done(visited)         => logger.info(s"done: $visited pages rendered")

    }

  }

}
