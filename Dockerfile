# Railway web app: built with Node, served by nginx (which also forwards API calls to the backend).
#   docker build -t railway-frontend:1.17.0 .
#   docker run -p 8081:8080 -e BACKEND_URL=http://host.docker.internal:8080 railway-frontend:1.17.0

# ---- 1. build the static site
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# ---- 2. serve it (nginx without root, listening on 8080)
FROM nginxinc/nginx-unprivileged:1.27-alpine
# Where nginx forwards /customer and /admin; the Docker Compose service name by default
ENV BACKEND_URL=http://backend:8080
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
