FROM node:20

WORKDIR /usr/src/app

COPY . .

COPY package*.json ./

RUN npm install express mysql2 jsonwebtoken bcrypt telnet-client

EXPOSE 3000

CMD ["node", "Router.js"]


