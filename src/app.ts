import express from 'express'
import errorHandler from 'errorhandler'
import path from 'path'
import proxy from 'express-http-proxy'
import promMid from 'express-prometheus-middleware'
import { yellow, red, cyan } from 'chalk'
import config, { Route } from './config'
import cache from './cache'
import preRender from './pre-render'
import { proxyRoute } from './routes/proxy-route'
import { assetRoute } from './routes/asset-route'
import { assetProxyRoute } from './routes/asset-proxy-route'
import { pageRoute } from './routes/page-route'
import { buildMatcher } from './util'

const { adminAccessKey } = config

const app = express()

app.enable('etag')
app.use(promMid())
app.use(errorHandler())

const shortRouteDescription = (route: Route): string => {
  switch (route.type) {
    case 'page':
      return `${yellow(route.type)} -> ${route.source}`
    case 'asset':
      return `${yellow(route.type)} -> ${route.dir}`
    case 'proxy':
      return `${yellow(route.type)} -> ${route.target}`
    case 'asset-proxy':
      return `${yellow(route.type)} -> ${route.target}`
    case 'page-proxy':
      return `${yellow(route.type)} -> ${route.target}`
    case 'not-found':
      return `${yellow(route.type)}`
    default:
      return JSON.stringify(route)
  }
}

const logRoute = (url: string, route: Route) => {
  switch (config.log.routeMatch) {
    case 0:
      return
    case 1:
      console.log(`[app] route match ${cyan(url)} -- ${yellow(route.type)}`)
      break
    case 2:
      console.log(`[app] route match ${cyan(url)} -- ${shortRouteDescription(route)}`)
      break
    default:
      console.log(`[app] route match ${cyan(url)} -- ${JSON.stringify(route)}`)
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
      console.error(red('Admin access key is not configured.'))
      return res.status(401).send(`Unauthorized.`)
    }

    cache.clear()
    const shouldPreRender = typeof req.query['pre-render'] !== 'undefined'
    if (shouldPreRender) {
      if (!config.preRender) {
        return res.status(200).send(`Cache cleared. Pre-rendering has not been run: pre-render is not configured.`)
      }
      if (config.preRenderPaths.length === 0) {
        return res
          .status(200)
          .send(`Cache cleared. Pre-rendering has not been run: pre-render path are not configured.`)
      }
      await preRender()
      return res.status(200).send(`Cache cleared. Pre-rendering has been run.`)
    }
    return res.status(200).send(`Cache cleared.`)
  }
  return res.status(401).send('Unauthorized')
})

config.routes.forEach((route) => {
  const matcher = buildMatcher(route)
  switch (route.type) {
    case 'proxy':
      console.info(`[app] configuring proxy route -- ${matcher} -> ${route.target}`)
      app.use(matcher, (req, resp, next) => {
        logRoute(req.originalUrl, route)
        return proxyRoute(route, req, resp, next)
      })
      break

    case 'asset':
      // eslint-disable-next-line no-case-declarations
      const dir = route.dir.startsWith('/') ? route.dir : path.join(__dirname, route.dir)
      console.info(`[app] configuring asset route -- ${matcher} -> ${dir}`)

      app.use(matcher, async (req, resp, next) => {
        logRoute(req.originalUrl, route)
        return assetRoute(route, dir, req, resp, next)
      })

      break
    case 'asset-proxy':
      // eslint-disable-next-line no-case-declarations
      console.info(`[app] configuring asset-proxy route -- ${matcher} -> ${route.target}`)
      app.use(matcher, (req, resp, next) => {
        logRoute(req.originalUrl, route)
        return assetProxyRoute(route, req, resp, next)
      })
      break

    case 'page':
      console.info(`[app] configuring ${route.type} route -- ${matcher} -> ${route.source}`)
      app.use(matcher, async (req, res) => {
        logRoute(req.originalUrl, route)
        return pageRoute(route, req, res)
      })
      break

    case 'page-proxy':
      console.info(`[app] configuring ${route.type} route -- ${matcher} -> ${route.target}`)
      app.use(matcher, async (req, res, next) => {
        logRoute(req.originalUrl, route)

        if (req.header('User-Agent') === config.userAgent) {
          req.url = req.originalUrl
          if (config.log.selfRequests) {
            console.log(`[app] self request: ${req.originalUrl}, proxying -> ${route.target}${req.url}`)
          }
          return proxy(route.target)(req, res, next)
        }

        return pageRoute(route, req, res)
      })
      break

    default:
      console.error(red(`[app] unrecognized route type: ${JSON.stringify(route)}`))
      break
  }
})

app.use((req, res) => res.status(404).send('Not Found'))

export default app
