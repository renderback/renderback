FROM node:slim
WORKDIR /home/node

RUN apt-get update \
        && apt-get install -y curl \
        && curl -o- -L https://yarnpkg.com/install.sh | bash

USER node
COPY --chown=node:node .eslintignore /home/node
COPY --chown=node:node .eslintrc.js /home/node
COPY --chown=node:node .gitignore /home/node
COPY --chown=node:node .prettierrc /home/node
COPY --chown=node:node yarn.lock /home/node
COPY --chown=node:node package.json /home/node
COPY --chown=node:node tsconfig.json /home/node
RUN  yarn install
COPY src /home/node/src
RUN yarn build

FROM node:slim

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable libxss1 libcap2-bin \
      --no-install-recommends \
#    && rm -rf /var/lib/apt/lists/*
    && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

USER node
WORKDIR /home/node

COPY --from=0 --chown=node:node /home/node/node_modules /home/node/node_modules
COPY --from=0 --chown=node:node /home/node/dist /home/node/dist
COPY --from=0 --chown=node:node /home/node/package.json /home/node/dist
COPY --from=0 --chown=node:node /home/node/package.json /home/node/package.json

COPY --chown=node:node docker-image/run.sh /home/node/run.sh

EXPOSE 80
EXPOSE 443

CMD ["/bin/bash", "run.sh"]
