import sbt._

import org.portablescala.sbtplatformdeps.PlatformDepsPlugin.autoImport._

object Dependencies {

  val circe: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "io.circe" %%% "circe-core"           % DependencyVersions.circe,
      "io.circe" %%% "circe-generic"        % DependencyVersions.circe,
      "io.circe" %%% "circe-generic-extras" % DependencyVersions.circe,
      "io.circe" %%% "circe-parser"         % DependencyVersions.circe,
    )
  }

  val `circe-yaml`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "io.circe" %% "circe-yaml" % DependencyVersions.`circe-yaml`,
    )
  }

  val `cats-effect`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.typelevel" %% "cats-effect" % DependencyVersions.`cats-effect`,
    )
  }

  val fs2: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "co.fs2" %% "fs2-core" % DependencyVersions.fs2
    )
  }

  val monocle: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "dev.optics" %% "monocle-core"  % DependencyVersions.monocle,
      "dev.optics" %% "monocle-macro" % DependencyVersions.monocle,
    )
  }

  val keypool: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.typelevel" %% "keypool" % DependencyVersions.keypool
    )
  }

  val http4s: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.http4s" %% "http4s-circe"        % DependencyVersions.http4s,
      "org.http4s" %% "http4s-dsl"          % DependencyVersions.http4s,
      "org.http4s" %% "http4s-ember-server" % DependencyVersions.http4s,
      "org.http4s" %% "http4s-ember-client" % DependencyVersions.http4s,
    )
  }

  val `http4s-core`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.http4s" %%% "http4s-core" % DependencyVersions.http4s,
    )
  }

  val `scala-uri`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "io.lemonlabs" %%% "scala-uri" % DependencyVersions.`scala-uri`
    )
  }

  val decline: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "com.monovore" %% "decline"        % DependencyVersions.decline,
      "com.monovore" %% "decline-effect" % DependencyVersions.decline
    )
  }

  val `cats-retry`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "com.github.cb372" %% "cats-retry" % DependencyVersions.`cats-retry`,
    )
  }

  val log4cats: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.typelevel" %% "log4cats-core" % DependencyVersions.log4cats
    )
  }

  val playwright: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "com.microsoft.playwright" % "playwright" % DependencyVersions.playwright
    )
  }

  val redis4cats: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "dev.profunktor" %% "redis4cats-effects" % DependencyVersions.redis4cats
    )
  }

  val `typesafe-config`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "com.typesafe" % "config" % DependencyVersions.`typesafe-config`
    )
  }

  val `circe-config`: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "io.circe" %% "circe-config" % DependencyVersions.`circe-config`
    )
  }

  val logback: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "ch.qos.logback" % "logback-classic" % DependencyVersions.logback
    )
  }

  val slf4j: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.slf4j" % "slf4j-api" % DependencyVersions.`slf4j`
    )
  }

  val ip4s: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "com.comcast" %%% "ip4s-core" % DependencyVersions.ip4s,
    )
  }

  val scalatest: Def.Initialize[Seq[ModuleID]] = Def.setting {
    Seq(
      "org.scalatest" %%% "scalatest" % DependencyVersions.scalatest % Test
    )
  }

}
