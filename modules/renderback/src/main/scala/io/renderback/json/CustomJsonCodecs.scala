package io.renderback.json

import cats.syntax.all._
import fs2.io.file.Path
import io.circe.Codec
import io.circe.Decoder
import io.circe.Encoder
import org.http4s.Header
import org.http4s.Headers
import org.http4s.Uri
import org.typelevel.ci.CIString

trait CustomJsonCodecs extends CustomModelJsonCodecs {

  implicit val codePath: Codec[Path] = Codec.from(
    Decoder.decodeString.map(Path(_)),
    Encoder.encodeString.contramap(_.toString)
  )

  implicit val codeUri: Codec[Uri] = Codec.from(
    Decoder.decodeString.emap { string =>
      Uri.fromString(string).leftMap(_.message)
    },
    Encoder.encodeString.contramap(_.renderString)
  )

  implicit val codeUriHost: Codec[Uri.Host] = Codec.from(
    Decoder.decodeString.map { string =>
      Uri.RegName(string)
    },
    Encoder.encodeString.contramap(_.renderString)
  )

  implicit val headersCodec: Codec[Headers] = Codec.from(
    Decoder.decodeMap[String, String].map { map =>
      Headers(
        map.toList.map { case (name, value) =>
          Header.Raw(CIString(name), value)
        }
      )
    },
    Encoder.encodeMap[String, String].contramap(_.headers.view.map(raw => (raw.name.toString, raw.value)).toMap)
  )

}
