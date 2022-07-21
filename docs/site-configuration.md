## Site configuration

The site is configured in a YAML file (alternatively, a JSON file with the same structure can be used).

(see also: [basic example](../example/example.yaml))

### Top level fields:

```yaml
host: "..."
internalHost: "..."
internalPort: "..."
browserUrl: "..."
```

| Name           | Description                                                                                                  |
|----------------|--------------------------------------------------------------------------------------------------------------|
| `host`         | host of the site (default: internal host configured for the server)                                          |
| `internalHost` | host the headless browser will navigate to when rendering (default: internal host configured for the server) |
| `internalPort` | port the headless browser will navigate to when rendering (default: internal port configured for the server) |
| `browserUrl`   | base URL the headless browser will navigate to (overrides the above two settings)                            |


### Routes

A site has a set of routes. They are tried sequentially, in order they are defined in the configuration.

The following types of routes are supported:

* `Asset` - static content, served from files in the app distribution dir
* `AssetProxy` - static content, served by proxying from another HTTP (vs serving from the app distribution dir) 
* `Page` - the application page (html): rendered in the headless browser 
* `PageProxy` - same as `Page`, but the page source (initial HTML) is requested from another HTTP server 
* `Static` - static content (specified directly in the configuration)
* `Proxy` - the requests will be proxied to another HTTP server (including the request method, headers, body, etc)

```yaml
routes: 
  - type: Page
    setting1: "..."
    etc: "..."
  - type: Asset
    setting1: "..."
    etc: "..."
  - type: Proxy
    setting1: "..."
    etc: "..."
```

#### Matcher

Each route has a set of matchers, all optional.

The route is served when all the matchers match the request path.

A matcher matches when any of the options provided for it (in an array) matches. 

```yaml
routes:
  - type: Page
    matcher:
      path:
        - "/path1"
        - "/path2"
        - "/path3/*"
      ext: 
        - js
        - css
      regex: 
        - "regex1"
        - "regex2"
      exclude: 
        - ".dont-serve"
      noExt: false
```

| Name      | Description                                                                             |
|-----------|-----------------------------------------------------------------------------------------|
| `path`    | the request path must be equal to the value (of be a prefix, if the path ends with `/*` |
| `ext`     | the file extension the in the request path must match                                   |
| `regex`   | the request path must match the regular expression                                      |
| `exclude` | the request path must NOT match the regular expression                                  |
| `noExt`   | the request path must NOT have a file extension                                         |

#### Route settings


##### `Page`

```yaml
routes:
  - type: Page
    source: "..."

```
| Name     | Description                |
|----------|----------------------------|
| `source` | full path to the html file |

##### `Asset`

```yaml
routes:
  - type: Asset
    dir: "..."

```
| Name  | Description                                        |
|-------|----------------------------------------------------|
| `dir` | full path to the directory with files to be served |

##### `PageProxy`

```yaml
routes:
  - type: PageProxy
    target: "..."

```
| Name     | Description                                     |
|----------|-------------------------------------------------|
| `target` | the URL the html file at the origin HTTP server |

##### `AssetProxy`

```yaml
routes:
  - type: AssetProxy
    target: "..."

```
| Name     | Description                            |
|----------|----------------------------------------|
| `target` | the base URL of the origin HTTP server |

##### `Static`

```yaml
routes:
  - type: Static
    content: "..."

```
| Name      | Description              |
|-----------|--------------------------|
| `content` | the content to be served |

##### `Proxy`

```yaml
routes:
  - type: Proxy
    target: "..."

```
| Name     | Description                            |
|----------|----------------------------------------|
| `target` | the base URL of the origin HTTP server |


### Page rendering configuration

The way the page is rendered in the headless browser can be configured.

```yaml
render:
  waitSelector: "..."
  allowXHR: false
  allowWS: false
  allowOtherRequests: false
  abortResourceRequests: true
  requestBlacklist: 
    - "..."
    - "..."
```

| Name                    | Description                                                                                        |
|-------------------------|----------------------------------------------------------------------------------------------------|
| `waitSelector`          | a CSS selector for the browser to wait before considering the page to have been rendered, optional |
| `allowXHR`              | whether the XHR requests should be allowed                                                         |
| `allowWS`               | whether the websocket connections should be allowed                                                |
| `allowOtherRequests`    | whether other requests should be allowed                                                           |
| `abortResourceRequests` | whether the resource requests (CSS, images) should be aborted                                      |
| `requestBlacklist`      | a set regular of regular expressions, any request with URL matching one of those will be aborted   |

### Pre-rendering configuration

renderback can start pre-rendering the pages when it starts. It will look for links in the rendered pages and follow them (up to the provided `depth`).

```yaml
preRender:
  paths: 
    - "/"
    - "/another-page/"
  exclude: 
    - "..."
    - "..."
  depth: 1
```

| Name      | Description                                                                 |
|-----------|-----------------------------------------------------------------------------|
| `paths`   | a list of starting paths                                                    |
| `exclude` | a list of regular expressions, will skip the paths matching any of these    |
| `depth`   | "scraping" depth (`1` means only the provided `paths` will be pre-rendered) |
