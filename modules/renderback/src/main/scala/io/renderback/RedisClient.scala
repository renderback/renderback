package io.renderback

import cats.effect.Async
import cats.effect.Resource
import cats.syntax.all._
import org.log4s.getLogger
import org.typelevel.keypool.KeyPool
import org.typelevel.keypool.Reusable
import dev.profunktor.redis4cats.Redis
import dev.profunktor.redis4cats.effect.Log.Stdout._

import scala.concurrent.duration._

trait RedisClient[F[_]] {

  def get(key: String*): F[Option[String]]
  def put(key: String*)(value: String): F[Unit]

}

object RedisClient {

  def apply[F[_]](host: String, port: Int, password: Option[String], prefix: Seq[String])(implicit F: Async[F]): Resource[F, RedisClient[F]] = {
    KeyPool
      .Builder((_: Unit) => Redis[F].utf8(s"redis://${password.fold("")(p => s":$p")}@$host:$port")).withDefaultReuseState(Reusable.Reuse)
      .withIdleTimeAllowedInPool(10.minutes)
      .withMaxPerKey(Function.const(1)(_))
      .withMaxTotal(10)
      .build
      .map { kp =>

        new RedisClient[F] {

          private def _key(key: String*): String = (prefix ++ key).mkString(":")

          def get(key: String*): F[Option[String]] = {
            val theKey = _key(key: _*)
            kp.take(()).use { redis =>
              redis.value.get(theKey)
            }
          }

          def put(key: String*)(value: String): F[Unit] = {
            val theKey = _key(key: _*)
            kp.take(()).use { redis =>
              redis.value.set(theKey, value)
            }
          }

        }

      }

  }

}
