package io.renderback
package render

import cats.effect.Async
import cats.syntax.all._
import io.renderback.config.ContentRewriteConfig
import org.typelevel.log4cats.Logger

object RemoveCssSelectorsStage {

  def apply[F[_]: Async](rewriteConfig: ContentRewriteConfig)(implicit logger: Logger[F]): PostProcessStage[F] = (page: Page[F]) => {
    rewriteConfig.cssSelectorRemove
      .traverse[F, Unit] { selector =>
        val jsFunc =
          """
            |(elements) => {
            |  elements.forEach(element => {
            |    element.parentNode.removeChild(element)
            |  })
            |}
            |""".stripMargin

        logger.trace(s"remove by css selector: $selector") >>
          page.evalOnSelectorAll(selector, jsFunc).void
      }.void
  }

}
