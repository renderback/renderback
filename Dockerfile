FROM node:slim
WORKDIR /home/node/spa-ssr-proxy
COPY --chown=node package.json /home/node/spa-ssr-proxy/
RUN npm install
COPY --chown=node src/main/javascript/* /home/node/spa-ssr-proxy/

FROM node:slim

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY --from=0 --chown=node:node /home/node/spa-ssr-proxy /home/node/spa-ssr-proxy
WORKDIR /home/node/spa-ssr-proxy
USER node
RUN npm install
EXPOSE 8080
CMD ["npm", "start"]
