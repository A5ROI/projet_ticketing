# Projet Ticketing - Instructions Docker

## Prérequis
- Docker et Docker Compose installés
- Ports 5000 et 3306 disponibles sur la machine

## Démarrage du projet
1. Ouvrir un terminal dans le dossier du projet
2. Exécuter la commande : `docker-compose up --build`
3. Attendre que les conteneurs démarrent
4. Accéder à l'application via : http://localhost:5000

## Arrêt du projet
- Pour arrêter les conteneurs : Ctrl+C dans le terminal
- Pour supprimer les conteneurs : `docker-compose down