package io.renderback

import cats.syntax.all._
import cats.effect.Async
import fs2.Pipe
import fs2.io.file.Files
import fs2.io.file.Path

object FilePipe {

  def apply[F[_]](
    in: Path,
    out: Path,
    pipeThrough: Pipe[F, Byte, Byte]
  )(implicit F: Async[F]): F[Path] =
    Files[F].readAll(in).through(pipeThrough).through(Files[F].writeAll(out)).compile.drain.as(out)

}
