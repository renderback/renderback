import express, { Request, Response } from 'express'
import errorHandler from 'errorhandler'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import proxy from 'express-http-proxy'
import promMid from 'express-prometheus-middleware'
import { NextFunction } from 'express-serve-static-core'
import renderUrl from './render-url'
import config, {
  envConfig,
  PageProxyRoutingRule,
  PageRoutingRule,
  ProxyRoutingRule,
  RoutingRule,
  StaticAssetProxyRoutingRule,
  StaticAssetRoutingRule,
} from './config'
import cache from './cache'
import preRender from './pre-render'
import { modifyUrl } from './util'
import { proxyRoute } from './routes/proxy-route'
import { assetRoute } from './routes/asset-route'
import { assetProxyRoute } from './routes/asset-proxy-route'
import { pageRoute } from './routes/page-route'

const { adminAccessKey } = config

const app = express()

app.enable('etag')
app.use(promMid())
app.use(errorHandler())

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
      if (!config.preRender) {
        return res
          .status(200)
          .send(
            `Cache cleared. Pre-rendering has not been run: pre-render is not configured.`
          )
      }
      if (config.preRender.paths.length === 0) {
        return res
          .status(200)
          .send(
            `Cache cleared. Pre-rendering has not been run: pre-render path are not configured.`
          )
      }
      await preRender()
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
        return proxyRoute(rule, req, resp, next)
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
        return assetRoute(rule, dir, req, resp, next)
      })

      break
    case 'asset-proxy':
      // eslint-disable-next-line no-case-declarations
      console.info(
        `configuring asset-proxy rule -- ${matcher} -> ${rule.target}`
      )
      app.use(matcher, (req, resp, next) => {
        logRule(req.originalUrl, rule)
        return assetProxyRoute(rule, req, resp, next)
      })
      break

    case 'page':
      console.info(
        `configuring ${rule.rule} rule -- ${matcher} -> ${rule.source}`
      )
      app.use(matcher, async (req, res) => {
        logRule(req.originalUrl, rule)
        return pageRoute(rule, req, res)
      })
      break

    case 'page-proxy':
      console.info(
        `configuring ${rule.rule} rule -- ${matcher} -> ${rule.target}`
      )
      app.use(matcher, async (req, res, next) => {
        logRule(req.originalUrl, rule)

        if (req.header('User-Agent') === config.userAgent) {
          req.url = req.originalUrl
          if (config.log.requestsFromHeadless) {
            console.log(
              `request from headless: ${req.originalUrl}, proxying -> ${rule.target}${req.url}`
            )
          }
          return proxy(rule.target)(req, res, next)
        }

        return pageRoute(rule, req, res)
      })
      break

    default:
      console.error('unrecognized routing rule', rule)
      break
  }
})

app.use((req, res) => res.status(404).send('Not Found'))

export default app
