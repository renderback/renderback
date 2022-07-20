import com.typesafe.sbt.SbtGit.GitKeys.gitReader

inThisBuild(
  List(
    organization                        := "io.renderback",
    homepage                            := Some(url("https://github.com/renderback/renderback")),
    licenses                            := Seq("Apache-2.0" -> url("https://www.apache.org/licenses/LICENSE-2.0")),
    scmInfo                             := Some(ScmInfo(url("https://github.com/renderback/renderback"), "scm:git@github.com/renderback/renderback.git")),
    developers                          := List(Developer("yurique", "Iurii Malchenko", "i@yurique.com", url("https://github.com/yurique"))),
    description                         := "Server side rendering server for single-page applications",
    Test / publishArtifact              := false,
    dynverSeparator                     := "-",
    scalafmtOnCompile                   := true,
    versionScheme                       := Some("early-semver"),
    scalaVersion                        := ScalaVersions.v213,
    githubWorkflowJavaVersions          := Seq(JavaSpec.temurin("17")),
    githubWorkflowTargetTags ++= Seq("v*"),
    githubWorkflowPublishTargetBranches := Seq(RefPredicate.StartsWith(Ref.Tag("v"))),
    githubWorkflowPublish               := Seq(WorkflowStep.Sbt(List("ci-release"))),
    githubWorkflowBuild                 := Seq(WorkflowStep.Sbt(List("test"))),
    githubWorkflowEnv ~= (_ ++ Map(
      "PGP_PASSPHRASE"    -> s"$${{ secrets.PGP_PASSPHRASE }}",
      "PGP_SECRET"        -> s"$${{ secrets.PGP_SECRET }}",
      "SONATYPE_PASSWORD" -> s"$${{ secrets.SONATYPE_PASSWORD }}",
      "SONATYPE_USERNAME" -> s"$${{ secrets.SONATYPE_USERNAME }}"
    )),
    sonatypeCredentialHost              := "s01.oss.sonatype.org"
  )
)

val baseDockerImage    = "eclipse-temurin"
val baseDockerImageTag = "17-jre"

addCommandAlias("dpl", "docker:publishLocal")
addCommandAlias("dpr", "docker:publish")

lazy val `renderback-model` =
  crossProject(JSPlatform, JVMPlatform)
    .crossType(CrossType.Pure)
    .in(file("modules/renderback-model"))
    .enablePlugins(GitVersioning)
    .disablePlugins(RevolverPlugin)
    .settings(
      libraryDependencies ++=
        Seq.concat(
          Dependencies.circe.value,
          Dependencies.ip4s.value,
          Dependencies.`scala-uri`.value,
        )
    )
    .settings(commonSettings)

lazy val renderback =
  project
    .in(file("modules/renderback"))
    .disablePlugins(RevolverPlugin)
    .settings(
      libraryDependencies ++=
        Seq.concat(
          Dependencies.http4s.value,
          Dependencies.playwright.value,
          Dependencies.redis4cats.value,
          Dependencies.`typesafe-config`.value,
          Dependencies.`circe-config`.value,
          Dependencies.circe.value,
          Dependencies.`circe-yaml`.value,
          Dependencies.`cats-effect`.value,
          Dependencies.`cats-retry`.value,
          Dependencies.fs2.value,
          Dependencies.monocle.value,
          Dependencies.keypool.value,
          Dependencies.log4cats.value,
          Dependencies.slf4j.value,
          Dependencies.logback.value,
        )
    )
    .settings(commonSettings)
    .dependsOn(`renderback-model`.jvm)

lazy val `renderback-server-model` =
  project
    .in(file("modules/renderback-server-model"))
    .disablePlugins(RevolverPlugin)
    .settings(
      libraryDependencies ++=
        Seq.concat(
          Dependencies.circe.value,
          Dependencies.ip4s.value,
          Dependencies.`scala-uri`.value,
        )
    )
    .settings(commonSettings)
    .dependsOn(`renderback-model`.jvm)

lazy val `renderback-server` =
  project
    .in(file("modules/renderback-server"))
    .enablePlugins(BuildInfoPlugin, JavaAppPackaging, DockerPlugin)
    .settings(
      buildInfoKeys := Seq[BuildInfoKey](
        version,
      ),
      libraryDependencies ++=
        Seq.concat(
          Dependencies.http4s.value,
          Dependencies.circe.value,
          Dependencies.`circe-yaml`.value,
          Dependencies.`cats-effect`.value,
          Dependencies.`cats-retry`.value,
          Dependencies.fs2.value,
          Dependencies.monocle.value,
          Dependencies.decline.value,
          Dependencies.log4cats.value,
        ),
    )
    .settings(commonSettings)
    .settings(
      Docker / packageName := "renderback/renderback",
      dockerUpdateLatest   := true,
      dockerEnvVars        := dockerEnvVars.value.updated("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1"),
      dockerBaseImage      := s"${baseDockerImage}:${baseDockerImageTag}",
    )
    .dependsOn(`renderback-server-model`, renderback)

lazy val commonSettings: Seq[Def.Setting[_]] = Seq.concat(
  Seq(
    addCompilerPlugin(("org.typelevel" % "kind-projector" % "0.13.2").cross(CrossVersion.full)),
    git.gitHeadCommit                 := gitReader.value.withGit(_.headCommitSha).map(_.take(7)),
    libraryDependencies ++= Dependencies.scalatest.value,
  ),
  ScalaOptions.fixOptions
)

lazy val noPublish = Seq(
  publishLocal / skip := true,
  publish / skip      := true,
  publishTo           := Some(Resolver.file("Unused transient repository", file("target/unusedrepo")))
)

lazy val root = project
  .in(file("."))
  .disablePlugins(RevolverPlugin)
  .settings(noPublish)
  .settings(
    name := "renderback-root"
  )
  .aggregate(
    `renderback-model`.jvm,
    `renderback-model`.js,
    renderback,
    `renderback-server-model`,
    `renderback-server`
  )
