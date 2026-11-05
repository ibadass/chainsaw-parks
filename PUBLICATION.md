# Publier LizParKs

LizParKs est une **PWA** (application web installable) : un simple lien suffit pour l'installer sur
Android, iPhone et ordinateur, sans passer par un store. Les stores restent possibles, mais seul
celui de Microsoft est gratuit.

| Où                                   | Coût           | Délai                  | À savoir                                         |
| ------------------------------------ | -------------- | ---------------------- | ------------------------------------------------ |
| Lien web + installation (tous appareils) | **0 €**    | 10 minutes             | Recommandé pour commencer                        |
| Microsoft Store (Windows)            | **0 €**        | quelques jours         | Paquet généré par PWABuilder                     |
| Google Play (Android)                | 25 $ une fois  | 14 jours minimum       | 12 testeurs pendant 14 jours, pièce d'identité   |
| App Store (iPhone)                   | 99 $ par an    | 1 à 2 semaines         | Mac obligatoire, risque de refus                 |

---

## 1. Mettre l'appli en ligne gratuitement (GitHub Pages)

L'appli doit être servie en **HTTPS** pour être installable. GitHub Pages le fait gratuitement
(le dépôt doit être **public** avec un compte gratuit).

### Option A : sans ligne de commande

1. Crée un compte sur [github.com](https://github.com/signup).
2. En haut à droite, **+ → New repository**. Nom : `lizparks`, visibilité **Public**, puis **Create repository**.
3. Clique sur **uploading an existing file** et glisse **le contenu** du dossier du projet (pas le dossier
   lui-même) : `index.html`, `confidentialite.html`, `manifest.webmanifest`, `sw.js` et les dossiers `css`,
   `js`, `data`, `icons`, `screenshots`. Puis **Commit changes**.
4. **Settings → Pages**. Dans *Build and deployment*, Source : **Deploy from a branch**, Branch : **main** et
   **/ (root)**, puis **Save**.
5. Une ou deux minutes plus tard, l'appli est en ligne à l'adresse
   `https://TON-PSEUDO.github.io/lizparks/` (lien affiché en haut de la page **Settings → Pages**).

### Option B : en ligne de commande

Après avoir créé le dépôt vide `lizparks` sur GitHub (étapes 1 et 2 ci-dessus) :

```bash
cd /chemin/vers/le/projet
git init -b main
git add .
git commit -m "LizParKs"
git remote add origin https://github.com/TON-PSEUDO/lizparks.git
git push -u origin main
```

Puis active GitHub Pages (étape 4).

### Publier une mise à jour

1. Modifie les fichiers.
2. Incrémente `CACHE_NAME` dans [sw.js](sw.js) (par exemple `lizparks-v8` → `lizparks-v9`).
3. Renvoie les fichiers sur GitHub (nouvel upload, ou `git commit` + `git push`).

Les utilisateurs reçoivent la mise à jour automatiquement à la prochaine ouverture de l'appli.

---

## 2. Installer l'appli sur un appareil

Partage simplement le lien (message, QR code…).

- **Android (Chrome)** : bouton **Installer l'appli** dans la page, ou menu **⋮ → Installer l'application**.
- **iPhone / iPad** : le bouton **Installer l'appli** affiche la marche à suivre : **Partager →
  Sur l'écran d'accueil → Ajouter**. Fonctionne dans Safari, et dans Chrome ou Edge depuis iOS 16.4.
- **Ordinateur (Chrome, Edge)** : bouton **Installer l'appli**, ou icône d'installation dans la barre d'adresse.

L'appli s'ouvre alors en plein écran, a son icône avec les autres applis et marche hors connexion.

> Les nouvelles règles Android de 2026-2027 sur la vérification des développeurs concernent les fichiers
> APK installés hors store. Une PWA installée depuis le navigateur n'est pas concernée.

---

## 3. Microsoft Store (gratuit)

Le compte développeur est gratuit pour les particuliers (vérification d'identité demandée).

1. Mets l'appli en ligne (section 1).
2. Crée un compte développeur **individuel** sur
   [storedeveloper.microsoft.com](https://storedeveloper.microsoft.com).
3. Dans **Partner Center → Applications et jeux → Nouveau produit → Application MSIX ou PWA**, réserve le
   nom **LizParKs**. Dans **Gestion des produits → Identité du produit**, note le *Package ID*, le
   *Publisher ID* et le *Publisher display name*.
4. Sur [pwabuilder.com](https://www.pwabuilder.com), colle l'adresse de l'appli, lance l'analyse, puis
   **Package for stores → Windows**. Renseigne les trois valeurs de l'étape 3 et télécharge le paquet.
5. Dans Partner Center, crée une soumission :
   - **Packages** : envoie le fichier `.msixbundle` du paquet téléchargé ;
   - **Fiche du Store** : description, captures d'écran (dossier [screenshots/](screenshots/)) ;
   - **Politique de confidentialité** : `https://TON-PSEUDO.github.io/lizparks/confidentialite.html` ;
   - **Classification par âge** : remplis le questionnaire (aucun contenu sensible).
6. Soumets. La validation prend en général quelques jours.

---

## 4. Google Play (25 $ une seule fois)

Pas de version gratuite : l'inscription coûte 25 $, une seule fois.

**Prérequis important : le domaine.** Pour que l'appli Android s'ouvre sans barre d'adresse, Google
vérifie un fichier `assetlinks.json` placé **à la racine du domaine** (`/.well-known/assetlinks.json`).
Avec GitHub Pages, l'adresse `TON-PSEUDO.github.io/lizparks/` n'est pas une racine. Deux solutions gratuites :

- héberger l'appli sur [Cloudflare Pages](https://pages.cloudflare.com) ou [Netlify](https://www.netlify.com),
  qui donnent une adresse racine (`lizparks.pages.dev`, `lizparks.netlify.app`) ;
- ou créer un second dépôt GitHub nommé exactement `TON-PSEUDO.github.io` qui contient seulement
  `.well-known/assetlinks.json`.

Étapes :

1. Crée un compte sur la [Play Console](https://play.google.com/console) (25 $, pièce d'identité).
2. Sur [pwabuilder.com](https://www.pwabuilder.com) : **Package for stores → Android**. Tu obtiens un
   fichier `.aab`, un fichier `assetlinks.json` et une **clé de signature**.
   **Garde la clé et son mot de passe précieusement** : sans eux, impossible de publier une mise à jour.
3. Mets `assetlinks.json` en ligne dans `/.well-known/` à la racine du domaine (voir ci-dessus).
4. Dans la Play Console, crée l'appli puis envoie le `.aab` en **test fermé**.
5. Invite au moins **12 testeurs** (adresses Gmail) qui gardent l'appli installée **14 jours d'affilée**.
   Prévois-en 15 ou 16, car si on tombe sous 12, le compteur repart à zéro.
6. Pendant ce temps, remplis la fiche :
   - **Sécurité des données** : aucune donnée collectée ni partagée ;
   - **Règles de confidentialité** : l'URL de `confidentialite.html` ;
   - **Classification du contenu** : questionnaire ;
   - **Captures d'écran** : au moins 2 captures de téléphone au format **9:16** (par exemple 1080 × 1920,
     prises sur ton téléphone ; celles du dossier `screenshots/` sont trop allongées pour Google Play).
7. Après les 14 jours, demande l'accès à la **production** et publie.

---

## 5. App Store (99 $ par an)

Il n'existe **aucune solution gratuite** pour l'App Store : l'Apple Developer Program coûte 99 $ par an
(les exonérations sont réservées aux associations, écoles et administrations).

Si tu veux tout de même y aller :

- il faut un **Mac avec Xcode** ;
- PWABuilder (**Package for stores → iOS**) génère un projet Xcode à compléter et envoyer depuis Xcode ;
- Apple refuse souvent les applis qui ne sont « qu'un site web » (règle 4.2 *Minimum Functionality*).
  LizParKs marche hors ligne et a de vraies fonctionnalités, mais l'acceptation n'est pas garantie.

**Alternative gratuite sur iPhone** : l'installation depuis Safari (section 2) donne une icône sur l'écran
d'accueil, l'ouverture en plein écran et le fonctionnement hors ligne.

---

## Avant toute publication

- [x] Aucune marque ou personnage tiers dans le nom, les textes ou les visuels.
- [x] Page de confidentialité en ligne.
- [x] Icônes classiques, icônes « maskable » (rondes sur Android) et icône iPhone.
- [ ] Relire [data/parks.json](data/parks.json) : la liste et les prix ont été rédigés de mémoire
      et n'ont pas été vérifiés (voir le [README](README.md#données)).
- [ ] Incrémenter `CACHE_NAME` dans [sw.js](sw.js) à chaque mise en ligne.
