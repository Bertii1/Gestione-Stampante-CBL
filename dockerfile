# Usa l'immagine Node.js LTS Alpine per ridurre le dimensioni
FROM node:20-alpine

# Installa dipendenze di sistema necessarie per bcrypt e altre native modules
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# Crea un utente non-root per sicurezza
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Imposta la directory di lavoro
WORKDIR /usr/src/app

# Copia i file di dipendenze per sfruttare la cache Docker
COPY package*.json ./

COPY . .

# Installa le dipendenze in modalità production
RUN npm install --omit=dev && npm cache clean --force

# Rimuovi le dipendenze di build non più necessarie
RUN apk del python3 make g++

# Copia il codice sorgente
COPY --chown=nodejs:nodejs . .

# Cambia ownership dei file all'utente nodejs
RUN chown -R nodejs:nodejs /usr/src/app

# Cambia all'utente non-root
USER nodejs

# Espone la porta dell'applicazione
EXPOSE 800

# Aggiungi health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:800/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Usa il script di inizializzazione Docker
CMD ["node", "docker-init.js"]

