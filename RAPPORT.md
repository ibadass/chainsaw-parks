# Rapport de modifications

Trois demandes traitées : corrections, navigation, prix et récap budget.

La syntaxe JS est valide et chacun des 144 parcs a un prix, mais l'app n'a pas été testée dans un
navigateur : à vérifier en local avec `npx serve .`.

## Problèmes corrigés

- **Filtre « Visités » / « À visiter »** : quand on cochait ou décochait un parc, sa carte restait
  affichée alors que les compteurs changeaient. Maintenant elle disparaît et le focus clavier passe
  sur la carte voisine.
- **Focus clavier invisible sur les cartes** : le contour était coupé par la forme découpée des
  cartes. Il est maintenant dessiné à l'intérieur.
- **Plusieurs onglets ouverts** : un onglet pouvait écraser la checklist d'un autre. Ils restent
  maintenant synchronisés.
- **Calculs en double** : la liste filtrée et le total des visites étaient recalculés deux fois à
  chaque affichage.
- **Données** :
  - Djurs Sommerland est à Nørre Nebel (pas Nørre Snede), Futuroscope à Chasseneuil-du-Poitou.
  - Noms mis à jour : Vialand s'appelle Isfanbul, Vinpearl Land s'appelle VinWonders, et Chorzów
    est devenu Legendia.
  - Vidám Park et Playcenter sont marqués « Fermé définitivement ».
- Une puce cassée dans [README.md](README.md) et la version du cache dans [sw.js](sw.js) (passée à v3).

## Navigation

- Deux onglets qui restent visibles en haut au défilement : **Checklist** et **Récap budget**. Ils
  passent par l'adresse de la page, donc le bouton retour marche et le lien `#recap` mène
  directement au récap.
- Nouveau tri : par pays, par nom, ou par prix croissant / décroissant.
- Quand aucun parc ne s'affiche, un bouton « Réinitialiser les filtres » apparaît.

## Prix

- Chaque parc a un champ `priceEur` dans [data/parks.json](data/parks.json) : le prix d'un billet
  adulte pour 1 jour, en euros. La carte affiche le prix pour 2, par exemple « ≈ 210 € pour 2 ».
  Le Prater (Vienne) affiche « Entrée libre ».
- **Ces prix sont des estimations de mémoire**, ordre de grandeur 2025, convertis en euros. Ils
  n'ont pas été vérifiés auprès des parcs et beaucoup varient selon la date. À relire avant de se
  fier au récap.

## Onglet Récap budget

Ne prend en compte que les parcs visités :

- Total dépensé pour 2, nombre de parcs, moyenne par parc, parc le plus cher et le moins cher.
- Répartition par tranche de prix pour 2 (moins de 50 €, 50–100 €, … , 200 € et plus), avec le
  sous-total et la part du budget. Chaque tranche se déplie pour voir la liste des parcs.

## Fichiers modifiés

- [index.html](index.html)
- [js/app.js](js/app.js)
- [css/styles.css](css/styles.css)
- [data/parks.json](data/parks.json)
- [sw.js](sw.js)
- [README.md](README.md)

## Suite possible

Pouvoir saisir le prix réellement payé pour chaque parc visité, pour que le récap ne repose plus sur
des estimations.
