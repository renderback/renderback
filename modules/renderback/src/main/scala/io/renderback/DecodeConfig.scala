package io.renderback

import cats.effect.Async
import cats.effect.Resource
import cats.syntax.all._
import fs2.io.file.Files
import fs2.io.file.Path
import fs2.text
import io.circe.Decoder
import io.circe.parser.decode
import io.circe.yaml.parser

object DecodeConfig {

  def apply[F[_]: Files, T: Decoder](path: Path)(implicit F: Async[F]): Resource[F, T] =
    Resource.eval {
      Files[F].readAll(path).through(text.utf8.decode).compile.string.flatMap { string =>
        if (path.extName == ".yaml" || path.extName == ".yml") {
          F.fromEither(parser.parse(string).flatMap(_.as[T]))
        } else {
          F.fromEither(decode[T](string))
        }
      }
    }

  class ConfigurationError(message: String, cause: Throwable = null) extends Exception(message, cause)

}
