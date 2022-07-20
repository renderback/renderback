package io.renderback
package config

import fs2.io.file.Path

sealed trait CacheConfig extends Product with Serializable {

  def cacheDir: Path

}

object CacheConfig {

  final case class Mem(cacheDir: Path) extends CacheConfig

  final case class Redis(
    cacheDir: Path,
    host: String,
    port: Int,
    password: Option[String]
  ) extends CacheConfig

}
