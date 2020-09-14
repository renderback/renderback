import { Request, Response } from 'express'
import config, { envConfig, PageProxyRoute, PageRoute } from '../config'
import renderUrl from '../render-url'

export const pageRoute = async (route: PageRoute | PageProxyRoute, req: Request, res: Response): Promise<Response> => {
  if (req.header('User-Agent') === config.userAgent) {
    if (route.type === 'page') {
      if (config.log.selfRequests) {
        console.log(`[page-route] self request: ${req.originalUrl}, serving ${route.source}`)
      }
      res.status(200).sendFile(`${route.source}`)
      return res
    }
    console.error(
      `[page-route] !!! unexpected state: self request, route type is ${route.type}, should not have ended up here`
    )
    process.exit(1)
  }
  const { content, etag, ttRenderMs } = await renderUrl(
    route.type === 'page-proxy'
      ? `${route.target}${req.originalUrl}`
      : `http://${envConfig.hostname}:${config.httpPort}${req.originalUrl}`
  )
  if (ttRenderMs) {
    // See https://w3c.github.io/server-timing/.
    res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`)
  }
  res.set('etag', etag)
  res.status(200).send(content)
  return res
}
