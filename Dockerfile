# --- Stage 1: Build ---
FROM node:24-slim AS builder
# Seteamos el directorio de trabajo explícitamente
WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copiamos todo el proyecto
COPY . .

# Paso de diagnóstico: esto nos dirá si la carpeta scripts existe
RUN ls -R ./scripts

# Ahora sí, el build funcionará porque encontrará ./scripts/build.js
RUN yarn build

# --- Stage 2: Production ---
FROM node:24-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "dist/app.js"]