package io.renderback
package render

import cats.effect.Async
import cats.syntax.all._
import io.renderback.config.ContentRewriteConfig
import io.renderback.config.CssSelectorUpdate
import org.typelevel.log4cats.Logger

object UpdateCssSelectorsStage {

  def apply[F[_]: Async](rewriteConfig: ContentRewriteConfig)(implicit logger: Logger[F]): PostProcessStage[F] = (page: Page[F]) => {
    rewriteConfig.cssSelectorUpdate
      .traverse[F, Unit] { case CssSelectorUpdate(selector, updateFunction) =>
        val jsFunc =
          """
            |(elements, functionStr) => {
            |  const fn = eval(functionStr)
            |  elements.forEach((element) => {
            |    fn(element)
            |  })
            |}
            |""".stripMargin

        logger.trace(s"update by css selector: $selector") >>
          page.evalOnSelectorAll(selector, jsFunc, updateFunction).void
      }.void
  }

}
