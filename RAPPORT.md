# Rapport de TP NoSQL : Architecture et Analyse

## 1. Modèles de Données

### 1.1 Modèle Relationnel (PostgreSQL)
- **Users**: `id` (PK), `name`, `email`
- **Products**: `id` (PK), `name`, `price`
- **Orders**: `user_id` (FK), `product_id` (FK). Table de jointure n-n.
- **Follows**: `follower_id` (FK), `followee_id` (FK). Table d'auto-jointure pour le graphe social.

### 1.2 Modèle Graphe (Neo4j)
- **Nœuds**: `:User`, `:Product`
- **Relations**: 
  - `(User)-[:FOLLOWS]->(User)`
  - `(User)-[:ORDERED]->(Product)`

## 2. Spécifications & Conception Logicielle

### 2.1 Architecture
L'architecture suit un modèle 3-tiers conteneurisé :
- **Frontend** : React.js.
- **Backend** : Node.js avec Express.
- **Données** : PostgreSQL & Neo4j.

### 2.2 Pattern DAL (Data Access Layer)
Le backend implémente le pattern DAO (Data Access Object) pour abstraire la source de données.
- `AbstractDAO` : Interface définissant les méthodes (getTopProductsByFollowers, getProductFollowerCount, getViralProductCount).
- `PostgresDAO` : Implémentation SQL utilisant `pg`.
- `Neo4jDAO` : Implémentation NoSQL utilisant `neo4j-driver`.

## 3. Requêtes

### 3.1 Liste produits commandés par cercles de followers (Niveau 1..N)
Cette requête permet de voir l'influence.
* **SQL** : Utilise une `CTE RECURSIVE` pour traverser le graphe social `follows` jusqu'à la profondeur N, puis joint avec `orders` et `products`.
* **Cypher** : Utilise des motifs de chemin de longueur variable `MATCH (u)<-[:FOLLOWS*1..N]-(f)-[:ORDERED]->(p)`.

### 3.2 Nombre d'achats d'un produit par followers (Niveau 1..N)
* **SQL** : `CTE RECURSIVE` + `COUNT`.
* **Cypher** : `MATCH ... RETURN COUNT(f)`.

### 3.3 Viralité : Achats par followers à un niveau précis (Niveau N)
Cette requête isole un cercle social spécifique (ex: les amis d'amis uniquement).
* **SQL** : `CTE RECURSIVE` avec clause `WHERE depth = N`.
* **Cypher** : Relation de longueur fixe `MATCH (u)<-[:FOLLOWS*N]-(f)...`.

## 4. Analyse des performances

> À compléter

### 4.1 Injection de données
* **PostgreSQL** : Performant sur les insertions structurées, mais peut ralentir avec les index sur `follows` si le volume est énorme. Les insertions par lots (batch) sont utilisées.
* **Neo4j** : L'utilisation de `UNWIND` permet des insertions rapides. Cependant, la création des relations `FOLLOWS` est coûteuse si les utilisateurs n'existent pas encore (d'où l'importance de les créer avant).

### 4.2 Requêtes
* **Faible profondeur (N=1, 2)** : PostgreSQL et Neo4j sont comparables. PostgreSQL utilise des index B-Tree efficaces.
* **Grande profondeur (N>3)** : 
    * **PostgreSQL** : Les performances se dégradent exponentiellement à cause des nombreuses jointures récursives (CTE).
    * **Neo4j** : Conçu pour le "index-free adjacency", il excelle à parcourir les graphes profonds. Il devrait se montrer nettement plus rapide pour N=4 ou 5.

## 5. Conclusion
Le modèle relationnel reste robuste pour les données structurées et les analyses transactionnelles simples. Cependant, pour des requêtes d'analyse de réseau social impliquant des traversées récursives profondes (reccommandation, viralité), le modèle graphe (Neo4j) offre une syntaxe plus naturelle et des performances supérieures grâce à sa structure de stockage optimisée pour les relations.