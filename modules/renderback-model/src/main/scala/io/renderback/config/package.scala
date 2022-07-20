package io.renderback

import io.renderback.json.CustomModelJsonCodecs

package object config extends CustomModelJsonCodecs {

  implicit private[config] val configuration: io.circe.generic.extras.Configuration =
    io.circe.generic.extras.Configuration.default.withDefaults.withDiscriminator("type")

}
