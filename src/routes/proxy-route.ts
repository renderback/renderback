import { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'
import proxy from 'express-http-proxy'
import { ProxyRoutingRule } from '../config'
import { modifyUrl } from '../util'

export const proxyRoute = async (
  rule: ProxyRoutingRule,
  req: Request,
  resp: Response,
  next: NextFunction
): Promise<Response> => {
  return proxy(rule.target, {
    proxyReqPathResolver: (request) =>
      rule.modifyUrl ? modifyUrl(rule.modifyUrl, request.originalUrl) : request.originalUrl,
  })(req, resp, next)
}
