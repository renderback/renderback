package io.renderback

import com.microsoft.playwright

package object toolkit {

  def redirectChain(request: playwright.Request): List[playwright.Request] =
    Option(request.redirectedFrom()) match {
      case None       => List.empty
      case Some(from) => from :: redirectChain(from)
    }

}
