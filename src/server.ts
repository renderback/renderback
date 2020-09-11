import errorHandler from 'errorhandler'
import greenlock from 'greenlock-express'
import app from './app'
import config, { envConfig } from './config'
import preRender from './pre-render'

console.log(`use greenlock: ${envConfig.useGreenlock}`)
if (envConfig.useGreenlock) {
  console.log(`greenlock maintainer: ${envConfig.greenlockMaintainer}`)
  if (!envConfig.greenlockMaintainer) {
    console.log(`greenlock maintainer is missing, disabling greenlock`)
    envConfig.useGreenlock = false
  }
}
console.log(`will pre-render: ${envConfig.shouldPreRender}`)
if (envConfig.shouldPreRender) {
  console.log(`pre-render start url: ${envConfig.preRenderStartUrl}`)
}

app.use(errorHandler())

const server = envConfig.useGreenlock
  ? greenlock
      .init({
        packageRoot: __dirname,
        maintainerEmail: envConfig.greenlockMaintainer,
        configDir: './greenlock.d',
        cluster: false,
      })
      .serve(app)
  : app.listen(config.port, async () => {
      if (config.preRender && envConfig.shouldPreRender) {
        await preRender(
          config.preRender,
          config.pageConfig,
          envConfig.preRenderStartUrl
        )
      }
      console.log(
        `Server started at http://${envConfig.hostname}:${config.port}`
      )
      console.log('Press Ctrl+C to quit')
    })

export default server
