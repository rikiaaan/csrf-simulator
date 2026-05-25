FROM node:26.1.0-alpine3.23 AS base

WORKDIR /app

COPY . .

RUN npm i

EXPOSE 80

CMD ["node", "src/server.ts"]
