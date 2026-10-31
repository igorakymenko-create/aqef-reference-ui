FROM node:24.13.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build
FROM nginx:1.28.0-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY config/providers.json /usr/share/nginx/html/providers.json
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/10-check-token.sh /docker-entrypoint.d/10-check-token.sh
RUN chmod +x /docker-entrypoint.d/10-check-token.sh
EXPOSE 80
