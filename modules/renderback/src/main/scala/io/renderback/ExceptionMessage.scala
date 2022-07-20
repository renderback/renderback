package io.renderback

object ExceptionMessage {

  def unapply(e: Throwable): Some[String] = e match {
    case e => Some(e.getMessage)
  }

}
