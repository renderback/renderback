package io.renderback.config

import io.circe.Codec
import io.circe.Decoder
import io.circe.Encoder

sealed abstract class CacheType(val name: String) extends Product with Serializable
object CacheType {
  case object Redis extends CacheType("redis")
  case object Mem   extends CacheType("mem")

  val all = Seq(Redis, Mem)

  implicit val cacheTypeCodec: Codec[CacheType] = Codec.from(
    Decoder.decodeString.emap(s => CacheType.all.find(_.name == s).toRight(s"Invalid cache type: ${s}")),
    Encoder.encodeString.contramap(_.name)
  )

}
