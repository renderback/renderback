package io.renderback

import com.comcast.ip4s.Host
import com.comcast.ip4s.Port

final case class StartServerCommand(
  host: Option[Host],
  port: Option[Port],
  configPath: String,
)
