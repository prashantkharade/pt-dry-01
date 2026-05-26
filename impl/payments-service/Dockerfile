FROM node:22-alpine AS builder
RUN apk add --no-cache bash python3 py3-pip alpine-sdk
WORKDIR /app
COPY package*.json ./
RUN npm install -g typescript
COPY src ./src
COPY tsconfig.json ./
COPY service.config.json ./
RUN npm install && npm run build

FROM node:22-alpine
RUN apk add --no-cache bash
RUN npm install -g pm2
WORKDIR /app
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/service.config.json ./
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 4004
ENTRYPOINT ["/bin/bash", "-c", "/app/entrypoint.sh"]
