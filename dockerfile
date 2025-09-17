FROM node:20

WORKDIR /usr/src/app

# Copia prima package.json per cache layer ottimizzata
COPY package*.json ./

# Installa dipendenze
RUN npm install express mysql2 jsonwebtoken bcrypt telnet-client

# Copia tutto il resto del codice
COPY . .

# Espone la porta configurata nell'environment
EXPOSE 800

# Usa il script di inizializzazione Docker
CMD ["node", "docker-init.js"]


