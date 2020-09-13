FROM node:slim

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable libxss1 libcap2-bin \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

WORKDIR /home/node
EXPOSE 80
EXPOSE 443

RUN npm install -g --production spa-ssr-proxy@0.0.8

USER node
CMD ["run.sh"]
CMD ["node", "/usr/local/lib/node_modules/spa-ssr-proxy/dist/server.js"]
