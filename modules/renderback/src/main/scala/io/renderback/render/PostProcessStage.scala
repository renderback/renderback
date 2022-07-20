package io.renderback
package render

trait PostProcessStage[F[_]] {

  def apply(page: Page[F]): F[Unit]

}
