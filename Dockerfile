# --- Stage 1: Build ---
FROM node:24-slim AS builder
WORKDIR /app

# Copiamos archivos de dependencias primero para cachear capas
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copiamos el resto del código (incluyendo scripts y src)
COPY . .

# Ejecutamos el build
RUN yarn build

# --- Stage 2: Production ---
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copiamos solo lo necesario del builder
COPY --from=builder /app/package.json ./
# OJO: Si usas "packages: 'external'" en esbuild, NECESITAS node_modules en producción
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 8080

CMD ["node", "dist/app.js"]