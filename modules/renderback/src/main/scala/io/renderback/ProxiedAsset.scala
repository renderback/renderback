package io.renderback

import org.http4s.Headers
import org.http4s.Status
import org.http4s.Uri

final case class ProxiedAsset[F[_]](
  uri: Uri,
  redirect: Option[Uri],
  status: Status,
  content: fs2.Stream[F, Byte],
  headers: Headers,
)
