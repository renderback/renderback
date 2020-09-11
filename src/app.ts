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

const shortRuleDescription = (rule: RoutingRule): string => {
  switch (rule.rule) {
    case 'page':
      return `${rule.rule} -> ${rule.source}`
    case 'asset':
      return `${rule.rule} -> ${rule.dir}`
    case 'proxy':
      return `${rule.rule} -> ${rule.target}`
    case 'asset-proxy':
      return `${rule.rule} -> ${rule.target}`
    case 'page-proxy':
      return `${rule.rule} -> ${rule.target}`
    case 'not-found':
      return `${rule.rule}`
    default:
      return JSON.stringify(rule)
  }
}

const modifyUrl = (modifyScript: string, url: string) => {
  // eslint-disable-next-line no-eval
  const modifyFunction = eval(modifyScript)
  return modifyFunction(url)
}

const logRule = (url: string, rule: RoutingRule) => {
  switch (config.log.ruleMatch) {
    case 0:
      return
    case 1:
      console.log(`${url} -- `, rule.rule)
      break
    case 2:
      console.log(`${url} -- ${shortRuleDescription(rule)}`)
      break
    default:
      console.log(`${url} -- `, JSON.stringify(rule))
  }
}

const pageRoute = async (
  req: Request,
  res: Response,
  rule: PageRoutingRule | PageProxyRoutingRule
): Promise<Response> => {
  if (req.header('User-Agent') === config.userAgent && rule.rule === 'page') {
    if (config.log.requestsFromHeadless) {
      console.log(
        `request from headless: ${req.originalUrl}, serving ${rule.source}`
      )
    }
    res.status(200).sendFile(`${rule.source}`)
    return res
  }
  const { html, etag, ttRenderMs } = await renderUrl(
    rule.rule === 'page-proxy'
      ? `${rule.target}${
          rule.modifyUrl
            ? modifyUrl(rule.modifyUrl, req.originalUrl)
            : req.originalUrl
        }`
      : `http://${envConfig.hostname}:${config.port}${req.originalUrl}`,
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
      console.info(`configuring proxy rule -- ${matcher} -> ${rule.target}`)
      app.use(matcher, (req, resp, next) => {
        logRule(req.originalUrl, rule)
        return proxy(rule.target, {
          proxyReqPathResolver: (request) =>
            rule.modifyUrl
              ? modifyUrl(rule.modifyUrl, request.originalUrl)
              : request.originalUrl,
        })(req, resp, next)
      })
      break

    case 'asset':
      // eslint-disable-next-line no-case-declarations
      const dir = rule.dir.startsWith('/')
        ? rule.dir
        : path.join(__dirname, rule.dir)
      console.info(`configuring asset rule -- ${matcher} -> ${dir}`)

      app.use(matcher, async (req, resp, next) => {
        logRule(req.originalUrl, rule)
        req.url = req.originalUrl
        const contentType = mime.lookup(req.url) || 'application/octet-stream'

        if (
          req.acceptsEncodings().indexOf('br') >= 0 &&
          fs.existsSync(`${dir}${req.url}.br`)
        ) {
          if (config.log.preCompressedAssets) {
            console.log(`  ${req.url} -> ${req.url}.br (${contentType})`)
          }
          req.url = `${req.url}.br`
          resp.set('Content-Encoding', 'br')
          resp.contentType(contentType)
        } else if (
          req.acceptsEncodings().indexOf('gzip') >= 0 &&
          fs.existsSync(`${dir}${req.url}.gz`)
        ) {
          if (config.log.preCompressedAssets) {
            console.log(`  ${req.url} -> ${req.url}.gz (${contentType})`)
          }
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
      console.info(
        `configuring asset-proxy rule -- ${matcher} -> ${rule.target}`
      )
      app.use(matcher, (req, resp, next) => {
        logRule(req.originalUrl, rule)
        return proxy(rule.target, {
          proxyReqPathResolver: (request) =>
            rule.modifyUrl
              ? modifyUrl(rule.modifyUrl, request.originalUrl)
              : request.originalUrl,
        })(req, resp, next)
      })
      break

    case 'page':
    case 'page-proxy':
      console.info(
        `configuring ${rule.rule} rule -- ${matcher} -> ${
          rule.rule === 'page' ? rule.source : rule.target
        }`
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
