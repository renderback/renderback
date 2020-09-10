import errorHandler from 'errorhandler'
import greenlock from 'greenlock-express'
import app from './app'
import config from './config'
import preRender from './pre-render'

app.use(errorHandler())

const server = config.greenlock
  ? greenlock
      .init({
        packageRoot: __dirname,
        configDir: './greenlock.d',
        cluster: false,
      })
      .serve(app)
  : app.listen(config.port, async () => {
      if (config.prerender) {
        await preRender()
      }
      console.log('Server started. Press Ctrl+C to quit')
    })

export default server
