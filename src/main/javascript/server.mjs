import express from 'express';
import ssr, {ssrAll, clearCache} from './ssr.mjs';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const { adminAccessKey, prerender, target, prerenderPaths, pageConfig, cacheResponses } = config

console.log('config', JSON.stringify(config, null, 4))

const app = express();

const browser = await puppeteer.launch({
  product: 'chrome',
  ignoreHTTPSErrors: true,
  headless: true,
  executablePath: '/usr/bin/google-chrome-stable',

  args: ['--ignore-certificate-errors', '--user-agent=saa/ssr', '--no-sandbox', '--disable-setuid-sandbox']
});

app.post('/__ssr/admin/clear-cache', async (req, res, next) => {
  if (req.header('Authorization') === `Bearer ${adminAccessKey}`) {
    if (typeof adminAccessKey === 'undefined' || !adminAccessKey || adminAccessKey === 'secret-access-key' || adminAccessKey.trim() === '') {
      console.error('Admin access key is not configured.')
      return res.status(401).send(`Unauthorized.`);
    }
    clearCache()
    const shouldPreRender = typeof req.query['pre-render'] !== 'undefined'
    if (shouldPreRender) {
      await runPreRender()
      return res.status(200).send(`Cache cleared. Pre-rendering has been run.`);
    } else {
      return res.status(200).send(`Cache cleared.`);
    }
  } else {
    return res.status(401).send('Unauthorized');
  }
});


app.get('*', async (req, res, next) => {
  const {html, ttRenderMs} = await ssr(`${target}${req.originalUrl}`, browser, cacheResponses, pageConfig);
  // Add Server-Timing! See https://w3c.github.io/server-timing/.
  res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`);
  return res.status(200).send(html);
});

app.listen(8080, () => console.log('Server started. Press Ctrl+C to quit'));

async function runPreRender() {
  console.log('pre-rendering')
  await ssrAll(browser, target, prerenderPaths, cacheResponses, pageConfig)
}

if (prerender) {
  await runPreRender()
}
