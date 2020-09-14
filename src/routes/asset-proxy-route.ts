import { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'
import proxy from 'express-http-proxy'
import { runtimeConfig, AssetProxyRoute } from '../config'
import cache from '../cache'

export const assetProxyRoute = async (
  route: AssetProxyRoute,
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
      cache.setAsset(`${userReq.protocol}://${userReq.hostname}${userReq.url}`, proxyResData, proxyRes.statusCode)
      return proxyResData
    }
    return proxy(route.target, {
      userResDecorator,
    })(req, resp, next)
  }
  return proxy(route.target)(req, resp, next)
}
