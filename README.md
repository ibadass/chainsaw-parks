# LizParKs

Checklist des parcs d'attraction du monde entier.
Application web statique (HTML, CSS, JavaScript natif), sans authentification, installable en PWA et utilisable hors ligne.

## Fonctionnalités

- Liste de parcs classés par pays, avec drapeau et compteur par pays
- Barre de recherche (insensible aux accents, sur le nom, la ville et le pays)
- Filtre par pays
- Filtre par statut : Tous / Visités / À visiter, avec compteurs
- Tri par pays, nom ou prix
- Prix estimé d'une journée pour 2 adultes sur chaque parc
- Onglet « Récap budget » : total, moyenne, extrêmes et répartition par tranche de prix des parcs visités
- Checklist « Visité » par parc, avec barre de progression (sur la sélection courante, et total global)
- Feu d'artifice plein écran quand un parc est coché, aux couleurs du drapeau du pays, avec un tampon « Visité ! »
  (12 types de bombes : pivoine, chrysanthème, palmier, croisette, bombe à étages, kamuro doré, cœur, étoile…,
  ondes de choc, secousse de la page et pluie de paillettes finale)
- Bouquet géant aux paliers de 10, 25, 50, 75 et 100 % des parcs visités
- Sons synthétisés (Web Audio, désactivés par défaut) : fusées, explosions, crépitements
- Easter egg : Konami code (↑ ↑ ↓ ↓ ← → ← → B A) pour le mode tronçonneuse
- Accessibilité :
  - boutons « Animations » et « Son » mémorisés ; par défaut, les animations suivent le réglage système « réduire les animations »
  - <kbd>Échap</kbd> arrête le feu d'artifice en cours
  - chaque coche est annoncée aux lecteurs d'écran (« Europa-Park marqué comme visité. 5 sur 144. »)
  - animations coupées + son actif : un petit jingle confirme la coche
- Synchronisation entre plusieurs onglets ouverts
- Sauvegarde automatique dans le navigateur (`localStorage`)
- Export et import de la checklist au format JSON
- PWA : installable (bouton « Installer l'appli », aide pas à pas sur iPhone), fonctionne hors ligne après le premier chargement
- Page [confidentialité](confidentialite.html) (exigée par les stores)

## Lancer en local

Les modules ES, le `fetch` du JSON et le service worker ne fonctionnent pas en ouvrant
directement `index.html` (`file://`). Il faut servir le dossier via HTTP :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Puis ouvrir l'URL affichée (par exemple `http://localhost:3000`).

## Format du fichier JSON

Export (fichier `lizparks-checklist-AAAA-MM-JJ.json`) et import utilisent le même format :

```json
{
  "app": "chainsaw-parks",
  "version": 1,
  "exportedAt": "2026-01-01T12:00:00.000Z",
  "visited": ["disneyland-paris", "europa-park"]
}
```

- `app` vaut toujours `chainsaw-parks`, l'ancien nom du projet : le changer rendrait les anciennes sauvegardes
  inimportables (même raison pour les clés `localStorage`, qui commencent aussi par `chainsaw-parks:`).
- `app` et `version` sont vérifiés à l'import : un fichier d'une autre application ou d'une version
  non prise en charge est refusé.
- `visited` contient les identifiants des parcs cochés. Les identifiants inconnus sont ignorés
  (le nombre est signalé à l'utilisateur).
- L'import **remplace** la checklist actuelle, après confirmation.

## Données

Les parcs sont dans [data/parks.json](data/parks.json). Chaque entrée :

```json
{ "id": "europa-park", "name": "Europa-Park", "city": "Rust", "country": "Allemagne", "countryCode": "DE", "priceEur": 70 }
```

- `id` : identifiant unique, en minuscules, chiffres et tirets (`^[a-z0-9-]+$`). Il sert de clé dans les sauvegardes : ne pas le modifier une fois publié.
- `countryCode` : code ISO 3166-1 alpha-2 en majuscules (sert à afficher le drapeau).
- `priceEur` : prix estimé d'un billet adulte 1 jour, en euros (multiplié par 2 à l'affichage). `0` = entrée libre, `null` = inconnu.
- `closed` (optionnel) : `true` si le parc a fermé définitivement.

**Attention :** la liste et les prix ont été rédigés de mémoire (ordre de grandeur 2025, convertis en euros)
et n'ont pas été vérifiés auprès des parcs eux-mêmes. Certaines villes, noms ou prix peuvent être inexacts.
Relire le fichier avant une mise en production.

## Icônes

Les icônes sont dans [icons/](icons/) : `icon.svg` (source) et `icon-192.png` / `icon-512.png`,
`icon-maskable.svg` (version avec marge de sécurité pour les icônes rondes d'Android) et ses PNG, et
`apple-touch-icon.png` (iPhone, 180 px). Elles sont originales.

Les captures d'écran du manifeste (fenêtre d'installation enrichie) sont dans [screenshots/](screenshots/).

## Service worker et mise à jour

[sw.js](sw.js) pré-cache l'application au premier chargement (stratégie réseau d'abord,
avec repli sur le cache). Après une modification des fichiers, incrémenter `CACHE_NAME`
dans `sw.js` pour forcer la mise à jour chez les utilisateurs.

## Structure

```
index.html          Page unique
confidentialite.html  Politique de confidentialité
css/styles.css      Thème et mise en page
js/app.js           Interface : recherche, filtre, checklist, export/import
js/storage.js       Persistance localStorage (checklist, préférences) et format JSON
js/fireworks.js     Feu d'artifice plein écran (canvas) et tampon animé
js/sound.js         Effets sonores synthétisés (Web Audio)
js/flags.js         Couleurs des drapeaux pour le feu d'artifice
data/parks.json     Liste des parcs
manifest.webmanifest, sw.js, icons/, screenshots/   PWA
```

## Déploiement et stores

Tout le contenu est statique : il suffit de publier le dossier sur n'importe quel hébergement
statique (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.) en HTTPS, condition requise
pour l'installation PWA.

Guide pas à pas (mise en ligne gratuite, installation sur téléphone, Microsoft Store, Google Play,
App Store) : [PUBLICATION.md](PUBLICATION.md).
