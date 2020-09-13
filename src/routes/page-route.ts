import { Request, Response } from 'express'
import config, {
  envConfig,
  PageProxyRoutingRule,
  PageRoutingRule,
} from '../config'
import renderUrl from '../render-url'
import { modifyUrl } from '../util'

export const pageRoute = async (
  rule: PageRoutingRule | PageProxyRoutingRule,
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.header('User-Agent') === config.userAgent) {
    if (rule.rule === 'page') {
      if (config.log.requestsFromHeadless) {
        console.log(
          `request from headless: ${req.originalUrl}, serving ${rule.source}`
        )
      }
      res.status(200).sendFile(`${rule.source}`)
      return res
    }
    console.error(
      `!!! unexpected state: request from headless, rule is ${rule.rule}, should not have ended up in pageRoute`
    )
    process.exit(1)
  }
  const { content, etag, ttRenderMs } = await renderUrl(
    rule.rule === 'page-proxy'
      ? `${rule.target}${
          rule.modifyUrl
            ? modifyUrl(rule.modifyUrl, req.originalUrl)
            : req.originalUrl
        }`
      : `http://${envConfig.hostname}:${config.port}${req.originalUrl}`
  )
  if (ttRenderMs) {
    // See https://w3c.github.io/server-timing/.
    res.set(
      'Server-Timing',
      `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`
    )
  }
  res.set('etag', etag)
  res.status(200).send(content)
  return res
}
