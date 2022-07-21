### Env variables

Table:

| Name                           |     | Description                                                               |
|--------------------------------|:----|---------------------------------------------------------------------------|
| `BROWSER_EXECUTABLE`           |     | path to the browser executable (optional)                                 |
| `BROWSER_CDP_ENDPOINT`         |     | browser CDP endpoint                                                      |
| `BROWSER_WS_ENDPOINT`          |     | browser WS endpoint                                                       |
| `BROWSER_CONNECT_TIMEOUT`      |     | connection timeout (ex.: `5 seconds`)                                     |
| `RENDERBACK_INTERNAL_HOSTNAME` |     | the internal hostname of the renderback server (default: system hostname) |
| `BROWSER_USER_AGENT`           |     | user-agent to be used by the headless browser                             |
| `BROWSER_RETRIES`              |     | number of times to retry if rendering of a page fails (default: `2`)      |
| `BIND_HOST`                    |     | host for the server to bind to (default: `0.0.0.0`)                       |
| `BIND_PORT`                    |     | port the server to bind to (default `48080`)                              |
| `CACHE_TYPE`                   |     | type of cache to use: `mem` or `redis` (default: `mem`)                   |
| `CACHE_DIR`                    |     | directory to store the cached pages in (default: temporary directory)     |
| `REDIS_HOST`                   |     | redis host (default: `localhost`)                                         |
| `REDIS_PORT`                   |     | redis port (default: `6379`)                                              |
| `REDIS_PASSWORD`               |     | redis password                                                            |
| `REDIS_PASSWORD_FILE`          |     | file to read the redis password from                                      |

All the env variables are optional.

If none of `BROWSER_EXECUTABLE`/`BROWSER_CDP_ENDPOINT`/`BROWSER_WS_ENDPOINT` is specified, a 
CDP endpoint `ws://localhost:3000` will be assumed.

If `redis` cache type is specified:

* if `REDIS_PASSWORD_FILE` is provided - the password will be read from that file; 
* otherwise, if `REDIS_PASSWORD` is provided - it will be used as a password;
* otherwise, the password will not be used when connecting to redis.

### Command line arguments

| Name                      | Description                                                                      |
|---------------------------|----------------------------------------------------------------------------------|
| `--host HOST`             | host for the server to bind to, optional, overrides the `BIND_HOST` env variable |
| `--port PORT`             | port for the server to bind to, optional, overrides the `BIND_PORT` env variable |
| `--config PATH_TO_CONFIG` | path to the site configuration file, required                                    |


