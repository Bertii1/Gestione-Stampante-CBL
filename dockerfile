# Base comune
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Installiamo dipendenze di sistema per compilare moduli nativi (es. bcrypt)
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

COPY package*.json ./

# --- Dev stage ---
FROM base AS dev
# Installo tutte le dipendenze, incluso nodemon
RUN npm install && npm install -g nodemon
COPY . .
EXPOSE 800
CMD ["nodemon", "docker-init.js"]

# --- Prod stage ---
FROM base AS prod
# Crea utente non-root per sicurezza
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Installa solo le deps di produzione
RUN npm install --omit=dev && npm cache clean --force

# Copia codice e cambia ownership
COPY --chown=nodejs:nodejs . .
USER nodejs

EXPOSE 800

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:800/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "docker-init.js"]
