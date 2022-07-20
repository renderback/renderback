package io.renderback
package config

import cats.syntax.all._
import org.http4s.Uri
import com.comcast.ip4s._
import io.renderback.render.PostProcessStage

case class SiteConfig[F[_]](
  routes: Seq[RouteRule],
  render: RenderConfig,
  preRender: ScrapeConfig,
  rewrite: ContentRewriteConfig = ContentRewriteConfig(),
  urlRewrite: UrlRewriteConfig = UrlRewriteConfig(),
  stages: Seq[PostProcessStage[F]],
  host: Uri.Host,
  internalHost: Uri.Host,
  internalPort: Port,
  browserUrl: Option[Uri],
) {

  private val browserRoot: Uri =
    browserUrl.getOrElse(
      Uri(scheme = Uri.Scheme.http.some, authority = Uri.Authority(host = internalHost, port = internalPort.value.some).some)
    )

  def browserUri(uri: Uri): Uri =
    browserRoot.withPath(uri.path).copy(query = uri.query, fragment = uri.fragment)

  def browserUri(path: Uri.Path): Uri =
    browserRoot.withPath(path)

}
