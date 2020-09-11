import express, { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import proxy from 'express-http-proxy'
import renderUrl from './render-url'
import config, {
  envConfig,
  PageProxyRoutingRule,
  PageRoutingRule,
  RoutingRule,
} from './config'
import cache from './cache'
import preRender from './pre-render'

const { adminAccessKey, pageConfig, cacheResponses } = config

const app = express()

app.enable('etag')

const buildMatcher = (rule: RoutingRule) => {
  const paths = rule.path ? rule.path : []
  const regexes = rule.regex ? rule.regex.map((p) => new RegExp(p)) : []
  const extensions = rule.ext
    ? [new RegExp(`^.+\\.(${rule.ext.join('|')})$`)]
    : []

  return [...paths, ...regexes, ...extensions]
}

const logRule = (url: string, rule: RoutingRule) => {
  console.log(`rule matched at ${url}`, JSON.stringify(rule))
}

const pageRoute = async (
  req: Request,
  res: Response,
  rule: PageRoutingRule | PageProxyRoutingRule
): Promise<Response> => {
  if (req.header('User-Agent') === config.userAgent && rule.rule === 'page') {
    res.status(200).sendFile(`${rule.source}`)
    return res
  }
  const { html, etag, ttRenderMs } = await renderUrl(
    rule.rule === 'page-proxy'
      ? `${rule.target}${req.originalUrl}`
      : `http://express-http.local:${config.port}${req.originalUrl}`,
    cacheResponses,
    pageConfig
  )
  if (ttRenderMs) {
    // See https://w3c.github.io/server-timing/.
    res.set(
      'Server-Timing',
      `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`
    )
  }
  res.set('etag', etag)
  res.status(200).send(html)
  return res
}

app.post('/__ssr/admin/clear-cache', async (req, res) => {
  if (req.header('Authorization') === `Bearer ${adminAccessKey}`) {
    if (
      typeof adminAccessKey === 'undefined' ||
      !adminAccessKey ||
      adminAccessKey === 'secret-access-key' ||
      adminAccessKey.trim() === ''
    ) {
      console.error('Admin access key is not configured.')
      return res.status(401).send(`Unauthorized.`)
    }

    cache.clear()
    const shouldPreRender = typeof req.query['pre-render'] !== 'undefined'
    if (shouldPreRender) {
      if (!config?.preRender) {
        return res
          .status(200)
          .send(
            `Cache cleared. Pre-rendering has not been run: preRender configuration is missing.`
          )
      }
      if (envConfig.shouldPreRender) {
        return res
          .status(200)
          .send(
            `Cache cleared. Pre-rendering has not been run: preRender is disabled.`
          )
      }

      await preRender(config.preRender, config.pageConfig)
      return res.status(200).send(`Cache cleared. Pre-rendering has been run.`)
    }
    return res.status(200).send(`Cache cleared.`)
  }
  return res.status(401).send('Unauthorized')
})

config.rules.forEach((rule) => {
  const matcher = buildMatcher(rule)
  switch (rule.rule) {
    case 'proxy':
      console.info('configuring proxy rule', matcher, rule.target)
      app.use(matcher, (req, resp, next) => {
        logRule(req.originalUrl, rule)
        return proxy(rule.target, {
          proxyReqPathResolver: (req) => req.originalUrl,
        })(req, resp, next)
      })
      break

    case 'asset':
      // eslint-disable-next-line no-case-declarations
      const dir = rule.dir.startsWith('/')
        ? rule.dir
        : path.join(__dirname, rule.dir)
      console.info('configuring asset rule', matcher, dir)

      app.use(matcher, async (req, resp, next) => {
        logRule(req.originalUrl, rule)
        req.url = req.originalUrl
        const contentType = mime.lookup(req.url) || 'application/octet-stream'
        console.log('asset rule matched', req.originalUrl)

        console.log('looking for pre-compressed assets')
        if (fs.existsSync(`${dir}${req.url}.br`)) {
          console.log(`${req.url} -> ${req.url}.br ${contentType}`)
          req.url = `${req.url}.br`
          resp.set('Content-Encoding', 'br')
          resp.contentType(contentType)
        } else if (fs.existsSync(`${dir}${req.url}.gz`)) {
          console.log(`${req.url} -> ${req.url}.gz ${contentType}`)
          req.url = `${req.url}.gz`
          resp.set('Content-Encoding', 'gzip')
          resp.contentType(contentType)
        }

        return express.static(dir, {
          maxAge: rule.maxAge || 31557600000,
          fallthrough: false,
        })(req, resp, next)
      })

      break
    case 'asset-proxy':
      // eslint-disable-next-line no-case-declarations
      console.info('configuring asset-proxy rule', matcher, rule.target)
      app.use(matcher, (req, resp, next) => {
        logRule(req.originalUrl, rule)
        return proxy(rule.target, {
          proxyReqPathResolver: (req) => req.originalUrl,
        })(req, resp, next)
      })
      break

    case 'page':
    case 'page-proxy':
      console.info(
        `configuring page rule (${rule.rule})`,
        matcher,
        rule.rule === 'page' ? rule.source : rule.target
      )
      app.use(matcher, async (req, res) => {
        logRule(req.originalUrl, rule)
        return pageRoute(req, res, rule)
      })
      break

    default:
      console.error('unrecognized routing rule', rule)
      break
  }
})

app.use((req, res) => res.status(404).send('Not Found'))

export default app
