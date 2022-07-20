package io.renderback

import org.http4s.Uri

import scala.concurrent.duration.Duration
import scala.concurrent.duration.FiniteDuration

sealed trait StatusEvent extends Product with Serializable

object StatusEvent {

  case class InitializingScraper()                            extends StatusEvent
  case class Rendering(uri: Uri, depth: Int)                  extends StatusEvent
  case class Rendered(uri: Uri, time: Option[FiniteDuration]) extends StatusEvent
  case class Navigating(uri: Uri)                             extends StatusEvent
  case class VisitedCount(visited: Int)                       extends StatusEvent
  case class RemainingCount(remaining: Int)                   extends StatusEvent
  case class Done(visited: Int)                               extends StatusEvent

}
