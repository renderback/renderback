package io.renderback
package config

import com.comcast.ip4s.Host
import com.comcast.ip4s.Port

final case class BindConfig(
  host: Host,
  port: Port,
)
