import promClient from 'prom-client'

export const renderTimeMetric = new promClient.Histogram({
  name: 'render_time',
  help: 'Render time',
  labelNames: ['url'],
})
