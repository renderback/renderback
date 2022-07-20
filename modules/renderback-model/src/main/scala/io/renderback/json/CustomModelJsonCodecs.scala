package io.renderback.json

import cats.syntax.all._
import com.comcast.ip4s
import io.circe.Codec
import io.circe.Decoder
import io.circe.Encoder

import scala.concurrent.duration.Duration
import scala.concurrent.duration.FiniteDuration
import scala.util.Try
import io.lemonlabs.uri.Host
import io.lemonlabs.uri.Url

object CustomModelJsonCodecs extends CustomModelJsonCodecs

trait CustomModelJsonCodecs {

  implicit final lazy val codeDuration: Codec[Duration] = Codec.from(
    Decoder.decodeString.emap(s => Try(Duration(s)).toEither.leftMap(_.getMessage)),
    Encoder.encodeString.contramap(_.toString)
  )

  implicit final lazy val codeFiniteDuration: Codec[FiniteDuration] =
    codeDuration.iemap[FiniteDuration] {
      case dur: FiniteDuration => dur.asRight[String]
      case other               => s"not a finite duration: $other".asLeft
    }(identity)

  implicit val codeUrl: Codec[Url] = Codec.from(
    Decoder.decodeString.emap { string =>
      Url.parseTry(string).toEither.leftMap(_.getMessage)
    },
    Encoder.encodeString.contramap(_.toString())
  )

  implicit val codeUrlHost: Codec[Host] = Codec.from(
    Decoder.decodeString.emap { string =>
      Host.parseTry(string).toEither.leftMap(_.getMessage)
    },
    Encoder.encodeString.contramap(_.toString())
  )

  implicit val codeHostName: Codec[ip4s.Hostname] = Codec.from(
    Decoder.decodeString.emap { string =>
      ip4s.Hostname.fromString(string).toRight(s"Invalid hostname: $string")
    },
    Encoder.encodeString.contramap(_.toString)
  )

  implicit val codeHost: Codec[ip4s.Host] = Codec.from(
    Decoder.decodeString.emap { string =>
      ip4s.Host.fromString(string).toRight(s"Invalid host: $string")
    },
    Encoder.encodeString.contramap(_.toString)
  )

  implicit val codePort: Codec[ip4s.Port] = Codec.from(
    Decoder.decodeString.emap { string =>
      ip4s.Port.fromString(string).toRight(s"Invalid port: $string")
    },
    Encoder.encodeString.contramap(_.toString())
  )

}
