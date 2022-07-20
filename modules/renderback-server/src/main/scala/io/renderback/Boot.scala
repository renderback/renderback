package io.renderback

import cats.effect._
import cats.syntax.all._
import com.comcast.ip4s.Host
import com.comcast.ip4s.Hostname
import com.comcast.ip4s.Port
import com.monovore.decline.Opts
import com.monovore.decline.effect.CommandIOApp

object Boot
    extends CommandIOApp(
      name = "renderback",
      header = "renderback",
      version = buildinfo.BuildInfo.version
    ) {

  private val serverOpts: Opts[StartServerCommand] =
    (
      Opts
        .option[String](long = "host", help = "host to bind the server to (default - env BIND_HOST or 0.0.0.0)")
        .mapValidated { s =>
          Host.fromString(s).toValidNel(s"Invalid hostname: $s")
        }
        .orNone,
      Opts
        .option[Int](long = "port", help = "port to bind the server to (default - env BIND_PORT random port)")
        .mapValidated { p =>
          Port.fromInt(p).toValidNel(s"Invalid port: $p")
        }
        .orNone,
      Opts.option[String](long = "config", help = "path to the server configuration file (json)"),
    ).mapN(StartServerCommand.apply)

  override def main: Opts[IO[ExitCode]] =
    serverOpts.map { s =>
      RenderingServer.start[IO](s).useForever
    }

}
