FROM node:18

WORKDIR /app

# Dépendances pour compiler better-sqlite3 (bindings natifs)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "--max-old-space-size=4096", "server.js"]
