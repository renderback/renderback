# spa-ssr-proxy (Single-Page Application Server-Side Rendering Proxy)

### Usage / how it works

To use this proxy you will (obviously) need an origin server that will be providing the original HTML 
documents of your SPA.

One way to set this up is like the following:

```
+-------------------------------------------------------------------------------------------------+                     
| CDN / reverse proxy server                                                                      |                     
| https://my-app.somewhere                                                                        |                     
|                              Splits the incoming traffic:                                       |                     
|                                                                                                 |                     
| /api/...                     images/stylesheets/              pages (html documents)            |                     
|     |                        other static assets               |                                |                     
|     |                                      |                   |                                |                     
+-----|--------------------------------------|-------------------|--------------------------------+                     
      |                                      |                   |                                                      
      |                                      |                   |                                                      
      |                                      |                   |                                                      
      v                                      |                   v                                                      
+----------------------------------------+   |                 +----------------------------------+                     
| API server                             |   |                 | spa-ssr-proxy                    |                     
| https://api.origin.my-app.somewhere    |   |                 |                                  |                     
|                                        |   |                 | https://ssr.my-app.somewhere     |                     
| serves /api/... requests               |   |                 |                                  |                     
|                                        |   |                 | Proxies requests, executes JS,   |                     
+----------------------------------------+   |                 | and serves the generated HTML    |                     
                                             |                 |    |                             |                     
                                             |                 +----|-----------------------------+                     
                                             |                      |                                                   
                                             v                      v                                                   
                                   +----------------------------------------+                                           
                                   |Static origin server                    |                                           
                                   |                                        |                                           
                                   |https://static.origin.my-app.somwhere   |                                           
                                   |                                        |                                           
                                   | serves all static assets:              |                                           
                                   | - images                               |                                           
                                   | - stylesheets                          |                                           
                                   | - fonts                                |                                           
                                   | - javascript                           |                                           
                                   | - html                                 |                                           
                                   | = etc                                  |                                           
                                   |                                        |                                           
                                   +----------------------------------------+                                     
```

* `Static origin server` -- you deploy your web-app assets to this server (the app should be able to work when 
served from this server)
* `API server` -- your back-end (API), if any  
* `spa-ssr-proxy` -- this proxy
* `CDN / reverse proxy server` -- the servers your users will actually be served by

`CDN / reverse proxy server` needs to be configured to split the traffic:
* API requests should be routed to your API server
* images/stylesheets and other static assets should be routed to the `Static origin server` (to which you deploy your static app).
* URLs that are pages (paths that are handled by your SPA) should be forwarded to the `spa-ssr-proxy`.

When `spa-ssr-proxy` receives a request, it replaces the domain name with the domain of `Static origin server` 
(specified in the configuration), and loads that URL in a headless browser. After the scripts are executed the 
response is served back to the user. User's browser then loads all the assets and runs your SPA.

### Caching

`spa-ssr-proxy` can be configured to cache the rendered pages (by URL). If caching is disabled, all requests will be 
rendered in the headless browser.

### Pre-rendering

`spa-ssr-proxy` can be configured to pre-render a set of pages (only makes sense with caching enabled). This way 
even the first user (or Google) will see the response quickly.

### Clearing cache

There is an admin endpoint to clear the caches (and optionally re-run pre-rendering):

```
POST https://ssr.my-app.somewhere/__ssr/admin/clear-cache?pre-render
Authorization: Bearer ${access-key}
```

Access key if specified in the configuration. `pre-render` parameter is optional, if not set -- pre-rendering will not
be re-run after clearing the cache. 

### Wait selector

When the page is rendered inside the headless browser, we need a way to know if your app has finished rendering 
the page.

For that, `spa-ssr-proxy` will first wait for all HTTP connections to be closed.
After that, it will wait for an element with a particular CSS selector to appear in the dom.

It's configured by `pageConfig.waitSelector`.

The value in the template is `title#title` - which means the page is considered rendered as soon as there is a 
`<title>` element with `id=title` (you can tweak your APP to do that when it knows it has finished rendering).

For the pre-render (which uses the `history` API to navigate through the specified list of pages) we need a way
to clear this "signal". This is specified by `pageConfig.resetSelectorScript`, in the template it's set to this:

```
document.head.querySelector('title').removeAttribute('id')
```
 
Which does what we want -- removes the `id` attribute from the `<title>` element, so when your app sets it again, 
the page is considered to be rendered.

### Pre-render navigation

If order to navigate while pre-rendering, you need to tell the `spa-ssr-proxy` how to do that. This is configured by 
`pageConfig.navigateScript`.

In the template it's set to 
```
window.routeTo('${url}')
```
(`${url}` will be replaced by the page URL).

For this to work, you'll need to set `window.routeTo = (url) => { do the things to route to ${url}, like pushState(null, null, url) }` in your app.

Or you can specify a different `navigateScript`.

### Other configuration options

There is a number of other configuration options to control the way your app is run in the headless browser (like aborting 
requests for CSS/images/fonts or other resources that you don't want to be accessed from within the headless browser).

A few options allow to control the verbosity of the `spa-ssr-proxy` log.

A brief description is below.

### Config file

(`config.template.json`)

```jsonc
{
  "cacheResponses": true,                         // whether or not to cache the responses
                                                  // if set to false pages will be requested and rendered on every request 
  "prerender": true,                              // if set to true the specified pages will be pre-rendered (and cached, if cacheResponses=true) on boot  
  "target": "https://origin-server",              // the origin where the requests will be proxied 
  "adminAccessKey": "secret-access-key",          // access key for admin access (to clear the cache/re-render)
  "pageConfig": {
    "waitSelector": "title#title",                // see the explanation above
    "resetSelectorScript": "document.head.querySelector('title').removeAttribute('id')", 
    // see the explanation below

    "navigateScript": "window.routeTo('${url}')", // see the explanation below
    "logErrors": true,                            // if true, will log page errors to the console
    "logConsole": false,                          // if true, will log all page console output to the console
    "logResponses": false,                        // if true, will log hxr responses to the console
    "logFailedRequests": true,                    // if true, will log failed xhr requests, unless intentionally aborted  
    "abortResourceRequests": true,                // intentionally abort requests to images, stylesheets and fonts
    "requestBlacklist": [                         // intentionally block requests with URL matching any of the regexes in the list  
        "regex1",                                 // for example "\/video\/" -- will block all xhr requests that have "video" in the url
        "regex2",
        // ...
    ]
  },
  "prerenderPaths": [ // the pages to be pre-rendered on boot (if prerender=true)
    "/page-1",
    "/page-2/page-3"
  ]
}
```


# Running

To run the `spa-ssr-proxy` in docker, first, prepare the `config.json` 
(use the provided `config.template.json` as a starting point).

Then, run the docker container: 

```bash
docker run --rm -it -v (pwd)/config.json:/home/node/spa-ssr-proxy/config.json -p 30090:8080 yurique/spa-ssr-proxy:latest
```

* `-v (pwd)/config.json:/home/node/spa-ssr-proxy/config.json` -- mounts your `config.json` file into the working dir 
of the node app
* `-p 30090:8080` -- `spa-ssr-proxy` binds to port `30090`, this binds it to port `8080` on the host machine (can be any port
that works for you)
* `--rm` -- to remove the container after it shuts down
* `-it` -- if you want it to be run in foreground (and `ctrl-c` it)

After this, you will need to set up the other parts of the setup.

For local development/testing, the following should work:

`nginx` as a `CDN / reverse proxy server`:

```
upstream backend {
     server 127.0.0.1:30070;
}
upstream frontend {
     server 127.0.0.1:30080; // might be a webpack dev-server
}
upstream ssr {
     server 127.0.0.1:8080;
}

server {
    server_name         http://static.origin.my-app.local;

    # this is needed as inside the headless browser your app will believe it's running
    # at static.origin.my-app.local, and if you send API requests to /api/.. this will handle it
    # the same rule will be below in the ssr server
    #
    # Alternatively, you can run you API on a separate domain (like api.my-app.local) 
    location ~ /api/ {
        proxy_pass http://backend;
    }

    location / {
        proxy_pass http://frontend;
    }
    
}

server {
    server_name         http://my-app.local;

    location ~ /api/ {
        proxy_pass http://saa-backend;
    }

    location / {
        proxy_pass http://ssr;
    }
    

}

# if you run your API server on a separate domain
server {
    server_name         http://api.my-app.local;

    location / {
        proxy_pass http://backend;
    }
    
}

``` 

[[ work in progress ]]
