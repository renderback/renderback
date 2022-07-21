### Try it out

In the following steps we are going to:

* create a Docker network (for the renderback to be able to connect to the headless browser)
* start a headless browser in a Docker container
* build an example single-page application
* start the renderback server in a Docker container

#### Docker network


```shell
docker network create renderback
````

#### Headless browser

[browserless](https://github.com/browserless/chrome)

```shell
docker run --rm -it \
  -e DEBUG='browserless*' \
  -e PREBOOT_CHROME=true \
  -e KEEP_ALIVE=true \
  -e MAX_CONCURRENT_SESSIONS=2 \
  -e CONNECTION_TIMEOUT=30000 \
  -e FUNCTION_ENABLE_INCOGNITO_MODE=true \
  -e DEFAULT_BLOCK_ADS=false \
  -e EXIT_ON_HEALTH_FAILURE=true \
  --name browserless \
  --net=renderback \
  browserless/chrome:latest
```

#### Example application 

```shell
git clone https://github.com/SimonPe25/Example-React-Router-6-.git
cd Example-React-Router-6-
npm install
npm run build
```

At this point we should have a `build` directory with the static files for the app.

```shell
# provide the full path to the build directory 
export MY_SPA_ROOT=.../Example-React-Router-6-/build/
```

#### renderback server

Get the `example/example.yaml` from this repository (or clone the whole repository).

```shell
# provide the full path to the example.yaml
export MY_RENDERBACK_CONFIG=.../example.yaml
```

Now start the renderback server in a Docker container:

```shell
docker run \
  --rm -it \
  -p 48080:48080 \
  --net=renderback \
  --volume "$MY_RENDERBACK_CONFIG":/etc/renderback/config.yaml \
  --volume "$MY_SPA_ROOT":/opt/renderback/content \
  -e BROWSER_CDP_ENDPOINT=ws://browserless:3000 \
  -e LOG_LEVEL_RENDERBACK=TRACE \
  -e BROWSER_RETRIES=2 \
  renderback/renderback:0.3.0-M2 \
  --config=/etc/renderback/config.yaml
```

#### Visiting the app

If everything went fine, you can now open `http://localhost:48080` in your browser.

### Configuration

* [Server configuration](docs/server-configuration.md)
* [Site configuration](docs/site-configuration.md)
