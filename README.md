# TP NoSQL — Comparaison PostgreSQL vs Neo4j

Application full-stack d'analyse d'influence en réseau social, comparant les performances d'un SGBDR (PostgreSQL) et d'une base orientée graphe (Neo4j).

## Prérequis

- **Docker** et **Docker Compose** installés
- ~8 Go de RAM disponible (Neo4j heap 4 Go + PostgreSQL)
- ~10 Go d'espace disque

## Lancement

```bash
# Cloner le projet
git clone <url-du-repo>
cd imtminesales-tpnosql

# Lancer l'ensemble des services
docker-compose up --build
```

C'est tout. Docker Compose démarre 4 conteneurs :

| Service          | URL                          | Description                     |
|------------------|------------------------------|---------------------------------|
| **Frontend**     | http://localhost:3000         | Interface React                 |
| **Backend**      | http://localhost:5000         | API Express                     |
| **PostgreSQL**   | localhost:5432                | Base relationnelle              |
| **Neo4j**        | http://localhost:7474         | Console Neo4j (Bolt sur 7687)   |

## Utilisation

### 1. Remplissage des bases de données

- Ouvrir http://localhost:3000
- Aller sur l'onglet **Remplissage BDD**
- Choisir la cible : PostgreSQL, Neo4j ou les deux
- Ajuster les paramètres si besoin (par défaut : 1M users, 10K produits, 0-5 commandes/user, 0-20 followers/user)
- Cliquer sur **Lancer l'import**
- La progression s'affiche en temps réel via SSE (Server-Sent Events)

### 2. Requêtes d'analyse

Trois onglets de requêtes sont disponibles :

- **Followers** — Produits commandés par les cercles de followers d'un individu (niveau 1 à N)
- **Produit spécifique** — Nombre de followers ayant commandé un produit donné
- **Viral** — Détection de propagation virale d'un produit à travers les cercles sociaux

Pour chaque requête :
1. Choisir la base à interroger (PostgreSQL, Neo4j ou les deux)
2. Renseigner les paramètres (User ID, Product ID, niveau de profondeur)
3. Cliquer sur **Exécuter**
4. Les résultats s'affichent avec le temps d'exécution de chaque base

## Structure du projet

```
.
├── docker-compose.yaml          # Orchestration des 4 services
├── init.sql                     # Schéma PostgreSQL (tables + index)
├── .env                         # Variables d'environnement (credentials)
├── backend/
│   ├── server.js                # Point d'entrée Express
│   ├── routes/api.js            # Définition des routes REST
│   ├── controllers/             # Logique métier + SSE
│   ├── dao/                     # Pattern DAO (Abstract → Postgres / Neo4j)
│   ├── db/                      # SQLite pour sauvegarde des résultats
│   └── utils/dataGenerator.js   # Génération de données aléatoires
└── analyseur/                   # Frontend React (CRA)
    └── src/
        ├── App.js               # Routeur d'onglets
        ├── components/tabs/     # 4 onglets (Import, Recommended, Adoption, Viral)
        ├── components/common/   # Composants réutilisables (DbSelector, ResultCard, TimeBadge)
        └── utils/               # Helpers (api.js, format.js)
```

## Configuration

Les variables d'environnement sont définies dans `.env` :

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=socialnetwork
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_AUTH=neo4j/password
```

## Arrêt

```bash
docker-compose down
```

Pour supprimer aussi les volumes (données Neo4j, SQLite) :

```bash
docker-compose down -v
```
