# Étape 1 : Construction de l'application React
FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./

# Installer les dépendances
RUN npm install

# Copier le reste du code source
COPY . .

# Exposer le port par défaut de Create React App
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
