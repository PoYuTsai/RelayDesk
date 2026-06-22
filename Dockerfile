FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && mkdir -p /data \
  && chown -R node:node /app /data

ENV NODE_ENV=production
ENV RELAYDESK_HOST=0.0.0.0
ENV RELAYDESK_PORT=8791
ENV RELAYDESK_DATA_DIR=/data

EXPOSE 8791

USER node

CMD ["node", "server/relay-server.mjs"]
