# Placeholdr: compila con Node y sirve los estáticos con nginx.
# Todo el trabajo (descargas, imágenes, PDF) ocurre en el navegador del usuario;
# nginx solo sirve ficheros y hace de proxy con caché para Showdown (sin CORS).
#
#   docker build -t placeholdr .
#   docker run -d -p 8080:80 placeholdr     ->  http://localhost:8080

FROM node:22-alpine AS build
WORKDIR /repo/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
# bustos.json vive en la raíz del repo (lo comparte el CLI congelado)
COPY bustos.json /repo/bustos.json
COPY web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
EXPOSE 80
