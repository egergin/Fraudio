FROM node:22-alpine AS build
WORKDIR /app
# Lock dosyası da kopyalanır; npm ci ile yeniden üretilebilir kurulum sağlanır.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
