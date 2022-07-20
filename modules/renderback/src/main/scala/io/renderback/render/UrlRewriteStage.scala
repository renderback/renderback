package io.renderback
package render

import cats.effect.Async
import cats.syntax.all._
import io.renderback.config.RegexReplace
import io.renderback.config.UrlRewriteConfig
import org.typelevel.log4cats.Logger

object UrlRewriteStage {

  def apply[F[_]: Async](urlRewriteConfig: UrlRewriteConfig)(implicit logger: Logger[F]): PostProcessStage[F] = (page: Page[F]) => {
    urlRewriteConfig.replace
      .traverse[F, Unit] { case RegexReplace(regex, replacement) =>
        val jsFunc =
          s"""|(elements, regexAndReplace) => {
              |  const [regex, replace] = regexAndReplace
              |  elements.forEach((element) => {
              |    const { href } = element
              |    const newHref = element.href.replace(new RegExp(regex, 'g'), replace)
              |    element.href = newHref
              |  })
              |}
              |""".stripMargin

        logger.trace(s"url rewrite: $regex --> $replacement") >>
          page.evalOnSelectorAll("a", jsFunc, Array(regex, replacement)).void
      }.void
  }

}
