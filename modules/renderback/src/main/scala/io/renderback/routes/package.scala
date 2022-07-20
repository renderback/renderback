package io.renderback

import org.http4s._
import org.http4s.headers.ETag
import org.http4s.headers.`Last-Modified`
import org.typelevel.ci._

import scala.concurrent.duration.FiniteDuration

package object routes {

  def noCache[F[_]](r: Response[F]): Response[F] =
    r.withHeaders(
      r.headers.headers
        .filterNot(_.name == ci"Last-Modified")
        .filterNot(_.name == ci"ETag")
    )

  def response[F[_]](
    status: Int,
    content: String,
    headers: Headers,
    etag: String,
    lastModified: FiniteDuration,
    timeToRender: Option[FiniteDuration],
  ): Response[F] =
    Response(
      status = Status.fromInt(status).getOrElse(Status.ServiceUnavailable),
      body = EntityEncoder.stringEncoder.toEntity(content).body,
      headers = renderResultHeaders(headers, etag, lastModified, timeToRender)
    )

  def response[F[_]](
    status: Int,
    content: fs2.Stream[F, Byte],
    headers: Headers,
    etag: String,
    lastModified: FiniteDuration,
    timeToRender: Option[FiniteDuration],
  ): Response[F] =
    Response(
      status = Status.fromInt(status).getOrElse(Status.ServiceUnavailable),
      body = content,
      headers = renderResultHeaders(headers, etag, lastModified, timeToRender)
    )

  def renderResultHeaders(
    headers: Headers,
    etag: String,
    lastModified: FiniteDuration,
    timeToRender: Option[FiniteDuration]
  ): Headers =
    (Headers(
      Seq.concat(
        timeToRender.toSeq.map[Header.ToRaw] { time =>
          Header.Raw(
            ci"Server-Timing",
            s"""Prerender;dur=${time.toMillis};desc="Headless render time (ms)""""
          )
        }
      ): _*
    ) ++ headers)
      .put(ETag(etag))
      .put(`Last-Modified`(HttpDate.unsafeFromEpochSecond(lastModified.toSeconds)))

}
