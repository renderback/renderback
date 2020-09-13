import { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'
import proxy from 'express-http-proxy'
import { runtimeConfig, StaticAssetProxyRoutingRule } from '../config'
import cache from '../cache'

export const assetProxyRoute = async (
  rule: StaticAssetProxyRoutingRule,
  req: Request,
  resp: Response,
  next: NextFunction
): Promise<Response> => {
  req.url = req.originalUrl

  if (runtimeConfig.cacheEverything) {
    const userResDecorator = (
      proxyRes: Response,
      proxyResData: any,
      userReq: Request
    ): Buffer | string | Promise<Buffer | string> => {
      cache.setAsset(`${userReq.protocol}://${userReq.hostname}${userReq.url}`, proxyResData)
      return proxyResData
    }
    return proxy(rule.target, {
      userResDecorator,
    })(req, resp, next)
  }
  return proxy(rule.target)(req, resp, next)
}
