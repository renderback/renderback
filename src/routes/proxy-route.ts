import { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'
import proxy from 'express-http-proxy'
import { ProxyRoute } from '../config'
import { modifyUrl } from '../util'

export const proxyRoute = async (
  route: ProxyRoute,
  req: Request,
  resp: Response,
  next: NextFunction
): Promise<Response> => {
  return proxy(route.target, {
    proxyReqPathResolver: (request) =>
      route.modifyUrl ? modifyUrl(route.modifyUrl, request.originalUrl) : request.originalUrl,
  })(req, resp, next)
}
