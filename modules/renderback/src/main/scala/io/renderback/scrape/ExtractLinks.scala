package io.renderback.scrape

import cats.syntax.all._
import cats.Functor
import org.http4s.Uri
import io.renderback.Page
import scala.jdk.CollectionConverters._

import java.util

trait ExtractLinks[F[_]] {

  def apply(page: Page[F]): F[Seq[Uri]]

}

object ExtractLinks {

  private val extractLinksFn = """(links) => links.map((link) => link.href)"""

  def apply[F[_]: Functor](
    origins: Set[Uri],
    exclude: Set[String],
  ): ExtractLinks[F] =
    (page: Page[F]) =>
      page
        .evalOnSelectorAll[util.ArrayList[String]]("a", extractLinksFn).map(
          _.asScala.toSeq
            .filterNot(_ == null)
            .filterNot(_.isEmpty)
            .filterNot(_ == "#")
            .filterNot(_.startsWith("javascript:"))
            .flatMap { s => Uri.fromString(s).toOption }
            .filter(u => !exclude.exists(exclude => u.path.renderString.matches(exclude)))
            .filter(_.authority.exists(authority => origins.exists(origin => origin.authority.contains(authority))))
            .map { uri =>
              Uri(
                path = uri.path,
                query = uri.query,
                fragment = uri.fragment
              )
            }
        )

}
