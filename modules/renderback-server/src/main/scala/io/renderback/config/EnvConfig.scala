package io.renderback
package config

import cats.data.OptionT
import cats.effect.Sync
import cats.syntax.all._
import com.comcast.ip4s._
import com.typesafe.config.ConfigFactory
import fs2.io.file.Files
import fs2.io.file.Path
import io.circe.config.parser
import org.http4s.headers
import org.typelevel.log4cats.Logger

import java.net.InetAddress
import scala.concurrent.duration.Duration
import scala.concurrent.duration.FiniteDuration
import scala.util.Try

final case class EnvRedisConfig(
  host: String,
  port: Int,
  password: Option[String]
)

final case class EnvConfig(
  browser: BrowserConfig,
  internalHost: Host, // for browserless to connect to, host.docker.internal for dev
  browserUserAgent: headers.`User-Agent`,
  browserRetries: Int,
  bindHost: Host,
  bindPort: Port,
  cacheType: CacheType,
  cacheDir: Path,
  redis: EnvRedisConfig,
)

object EnvConfig {

  private val defaultBrowserConfig: BrowserConfig = BrowserConfig.CDPEndpoint("ws://localhost:3000", none)

  def readEnv[F[_]: Files](implicit F: Sync[F], logger: Logger[F]): F[EnvConfig] = for {
    rawConfig             <- F.fromTry { Try(ConfigFactory.load()) }
    configuration         <- F.fromEither { parser.decodePath[Configuration](rawConfig, "renderback.env") }
    browserConnectTimeout <- F.delay(configuration.browserConnectTimeout.map(Duration(_)).collect { case f: FiniteDuration => f })
    browserConfig         <- Sync[F].delay {
                               configuration.browserExecutable.map(BrowserConfig.Executable.apply) orElse
                                 configuration.browserCdpEndpoint.map(BrowserConfig.CDPEndpoint(_, browserConnectTimeout)) orElse
                                 configuration.browserWsEndpoint.map(BrowserConfig.WsEndpoint(_, browserConnectTimeout))
                             }
    browserConfig         <- OptionT.fromOption[F](browserConfig).getOrElseF {
                               logger.info(s"[!] none of [BROWSER_EXECUTABLE, BROWSER_CDP_ENDPOINT, BROWSER_WS_ENDPOINT] env variables is set") >>
                                 logger.info(s"[!] using default $defaultBrowserConfig").as(defaultBrowserConfig)
                             }
    resolvedHostName      <- F.blocking(InetAddress.getLocalHost.getHostName)
    internalHost          <- F.fromOption(Host.fromString(configuration.internalHostName.getOrElse(resolvedHostName)), new IllegalArgumentException("Invalid internal hostname"))
    browserUserAgentStr    = configuration.browserUserAgent.getOrElse("renderback/0.1.0")
    bindHost              <- OptionT
                               .fromOption[F](configuration.bindHost)
                               .getOrElseF {
                                 logger.info(s"[!] BIND_HOST env variable is not set, using default 0.0.0.0") >>
                                   F.fromOption(Host.fromString("0.0.0.0"), new IllegalStateException("failed to parse 0.0.0.0 as host"))
                               }
    bindPort              <- OptionT
                               .fromOption[F](configuration.bindPort)
                               .getOrElseF {
                                 logger.info(s"[!] BIND_PORT env variable is not set, using default 48080").as(port"48080")
                               }
    cacheDir              <- OptionT
                               .fromOption[F](configuration.cacheDir).map(Path(_))
                               .getOrElseF {
                                 Files[F].createTempDirectory.flatTap { path =>
                                   logger.info(s"[!] CACHE_DIR env variable is not set, using temp directory '$path'")
                                 }
                               }
    browserUserAgent      <- Sync[F].fromEither { headers.`User-Agent`.parse(browserUserAgentStr) }
    browserRetries        <- OptionT.fromOption[F](configuration.browserRetries).getOrElseF {
                               logger.info(s"[!] BROWSER_RETRIES env variable is not set, using default number of retries = 2").as(2)
                             }
    redisHost             <- OptionT.fromOption[F](configuration.redisHost).getOrElseF {
                               logger.info(s"[!] REDIS_HOST env variable is not set, using default 'localhost'").as("localhost")
                             }
    redisPort             <- OptionT.fromOption[F](configuration.redisPort.flatMap(s => Try(s.toInt).toOption)).getOrElseF {
                               logger.info(s"[!] REDIS_PORT env variable is not set, using default 6379").as(6379)
                             }
    redisPassword          = configuration.redisPassword
    redisPasswordFile      = configuration.redisPasswordFile
    redisPasswordFromFile <- OptionT
                               .fromOption[F](redisPasswordFile)
                               .flatMapF { file =>
                                 val path = Path(file)
                                 Files[F].isRegularFile(Path(file), followLinks = true).flatMap {
                                   case true  => Files[F].readAll(path).through(fs2.text.utf8.decode).compile.string.map(_.some)
                                   case false => none[String].pure[F]
                                 }
                               }.value
  } yield EnvConfig(
    browser = browserConfig,
    internalHost = internalHost,
    browserUserAgent = browserUserAgent,
    browserRetries = browserRetries,
    bindHost = bindHost,
    bindPort = bindPort,
    cacheType = configuration.cacheType.getOrElse(CacheType.Mem),
    cacheDir = cacheDir,
    redis = EnvRedisConfig(
      host = redisHost,
      port = redisPort,
      password = redisPasswordFromFile.orElse(redisPassword)
    )
  )

}
