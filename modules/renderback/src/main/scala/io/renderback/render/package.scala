package io.renderback

import org.http4s.Header
import org.http4s.Headers

package object render {

  implicit class HeadersExt(headers: Headers) {

    def putOpt[H](h: Option[H])(implicit H: Header[H, _]): Headers = {
      h.fold(headers)(h => headers.put(h))
    }

  }

}
