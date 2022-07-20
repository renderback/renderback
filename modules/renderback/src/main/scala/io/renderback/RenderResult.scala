package io.renderback

import cats.syntax.all._
import io.circe.Codec
import io.circe.generic.semiauto.deriveCodec
import org.http4s.Headers
import org.http4s.Uri

import scala.concurrent.duration.FiniteDuration

final case class RenderResult(
  uri: Uri,
  redirect: Option[Uri],
  status: Int,
  content: String,
  lastModified: FiniteDuration,
  etag: String,
  headers: Headers,
  timeToRender: Option[FiniteDuration] = None,
) {

  def withTimeToRender(time: FiniteDuration): RenderResult = copy(timeToRender = time.some)

}

object RenderResult {

  def etag[F[_]](now: FiniteDuration, content: String): String =
    s"${now.toMillis.toHexString}-${content.length.toHexString}"

  implicit val codec: Codec[RenderResult] = deriveCodec

}
