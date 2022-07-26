import sbt._

import sbt.Keys._

object ScalaOptions {
  val fixOptions = Seq(
    scalacOptions ~= (
      _.filterNot(
        Set(
          "-Wdead-code",
          "-Ywarn-dead-code",
          "-Wunused:imports",
          "-Wunused:params"
        )
      ) ++ Seq("-Ymacro-annotations")
    ),
    Test / scalacOptions ~= (_.filterNot(_.startsWith("-Wunused:")).filterNot(_.startsWith("-Ywarn-unused")))
  )

}
