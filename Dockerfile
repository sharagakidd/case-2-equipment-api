# Стадия 1: установка всех зависимостей и подготовка исходников.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src

# Стадия 2: рабочее окружение — только production-зависимости.
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
# bcrypt — нативный модуль: инструменты нужны, если нет готового бинарника под alpine.
RUN apk add --no-cache --virtual .build python3 make g++ \
  && npm ci --omit=dev \
  && npm cache clean --force \
  && apk del .build

COPY --from=build /app/src ./src

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
