package io.renderback.scrape

import io.renderback.ProxiedAsset
import io.renderback.RenderResult

final case class ScrapeResult[F[_]](
  renderResults: Seq[RenderResult],
  proxiedAssets: Seq[ProxiedAsset[F]]
)
