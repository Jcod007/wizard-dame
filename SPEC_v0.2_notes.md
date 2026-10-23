# Wizard Dame — Document de conception v0.2 : notes de prise en charge

Source : document complet fourni par Ekoue dans la conversation du 2026-10-23
(« WIZARD DAME — DOCUMENT COMPLET DE CONCEPTION », version 0.2).
Ce fichier résume les décisions pour le développement ; le texte d'Ekoue fait foi.

## Statuts (selon le document)
- ÉTABLI : à respecter.
- PROPOSITION : à implémenter de façon cohérente, peut évoluer après tests.
- À TESTER : équilibrage à vérifier en parties de test.
- Règle du document : signaler les ambiguïtés au lieu d'inventer silencieusement des règles.

## Ce qui change par rapport au prototype v1 déjà construit localement
Le prototype v1 (dames classiques : diagonales seulement, cases foncées seulement,
carte avant le déplacement, main de 3 sans limite de pioche, chaînes de captures,
4 effets de cartes) est **remplacé** par la v0.2 sur les points suivants :

1. **Déplacement de base dans les 8 directions** (orthogonaux + diagonaux), 1 case,
   vers n'importe quelle case vide du plateau — pas seulement les cases foncées
   (les pions démarrent sur les cases foncées des 3 premières rangées, 12 par joueur, 8×8).
2. **Capture par saut dans les 8 directions**, adjacence + case derrière vide.
   Capture **non obligatoire**. **Une seule capture** par déplacement de base —
   les captures multiples exigent une carte/propriété explicite (plus de chaîne libre).
3. **Structure de tour** : pioche éventuelle → déplacement principal → carte facultative
   (max 1, APRÈS le déplacement) → résolution/déclenchements → vérifications de victoire
   → expirations → joueur suivant. Ordre de résolution stable en 9 étapes (§5.3),
   protections résolues avant le retrait d'un pion, boucles de déclenchements interdites.
4. **Main et deck** : 3 cartes au départ, **maximum 4**, pioche en début de tour si main < 4.
   Carte jouée → défausse (sauf cartes bannies : Fusion, Résurrection, Dernier pari).
   Pioche vide → défausse mélangée. Mains secrètes ; decks prédéfinis au prototype,
   comparables sans être identiques. Pas de cartes de réaction au premier prototype.
   Avant de jouer une carte, l'interface affiche cible, conditions, coût, risque,
   effet, durée et conséquences connues. Carte dont les conditions ne sont pas remplies :
   injouable, reste en main.
5. **Pièce essentielle (nouveau, ÉTABLI)** : chaque joueur désigne secrètement un de ses
   pions de départ ; identité cachée pour l'adversaire, apparence non révélatrice.
   Capturer la pièce essentielle adverse = victoire sans éliminer tous les pions.
   Proposition d'interface : sélection secrète par chaque joueur avant la partie
   (sur le même écran : phase de sélection à l'abri du regard, à confirmer par Ekoue).
6. **Formes des pions** : cosmétiques (pixel art), aucun pouvoir par elles-mêmes
   sauf règle/propriété explicite. Confirme le choix du prototype v1.
7. **Principes de conception (§1)** : l'ingéniosité avant la puissance ; chaque carte doit
   créer une décision/intérêt stratégique, pas seulement de la puissance ; la puissance
   implique des contraintes (usage unique, conditions, sacrifice, tempo, risque).
8. **Catalogue de 30 cartes (§7)** en 6 familles — Mouvement (Pas spectral, Échange,
   Repoussement, Pas de côté, Marque de passage), Défense (Bouclier runique, Ancrage,
   Garde de case, Dissipation, Dernier rempart), Fusion/transformation (Fusion, Mutation,
   Purification, Éveil, Réversion), Pièges/bluff/information (Piège runique, Leurre, Sonde,
   Voile, Fausse piste), Perturbation/contrôle (Gel, Silence magique, Contresort,
   Interférence, Lien), Retour/duplication/risque (Résurrection, Duplication, Sacrifice,
   Pacte instable, Dernier pari). Chaque carte = définition structurée dans le code
   (id, nom, famille, description, cible, conditions, coûts, risques, effet, durée,
   cible invalide, usage unique).
   Note : les 4 effets du prototype v1 (Bouclier/Ailes/Pas double/Gel) sont remplacés
   par ce catalogue (Bouclier runique = protection contre LA prochaine capture, consommé ;
   Gel = pas de re-gel au tour suivant ; Pas double n'existe plus tel quel).

## Ambiguïtés signalées (à ne pas inventer silencieusement)
- **Système de fusion** : le §7.3 renvoie à un « système de fusion défini dans ce document »,
  mais le calcul des propriétés du pion fusionné (quelles propriétés se combinent, limites,
  forme du nouveau pion, conditions d'admissibilité des deux pions) n'est pas dans le texte
  reçu (le document reçu s'arrête à la carte 30, §7.6). En attendant la section manquante :
  implémenter Fusion avec une règle provisoire **documentée comme provisoire** dans le code
  et le README, ou la laisser en définition structurée non activée — décision signalée à Ekoue.
- **Propriétés des pions** : le document parle de propriétés permanentes/temporaires/
  conditionnelles/déclenchées et d'interactions émergentes, mais la liste des propriétés
  elles-mêmes n'est pas dans le texte reçu. Mutation (« propriété commune choisie parmi
  deux possibilités déterminées par le jeu ») suppose ce catalogue de propriétés.
- **Promotion / Dame** : la v0.2 ne mentionne pas de promotion au rang de Dame ;
  le prototype v1 en avait une. Ne pas la réintroduire sans décision d'Ekoue.
- **Victoire hors pièce essentielle** : éliminer tous les pions adverses (vision §1) et,
  par cohérence avec le moteur, adversaire sans coup légal — à confirmer.
- **Sonde** : « moitié supérieure ou inférieure » du plateau — du point de vue de qui ?
  (orientation du joueur 1 par défaut, à confirmer.)
- **Sélection secrète de la pièce essentielle sur un seul écran** : procédure exacte
  (écran de passation) = proposition d'interface à valider.

## Direction artistique
Pixel art intégral (section 12 d'Ekoue, déjà appliquée au prototype v1 : sprites 16×16
pixel par pixel, cartes 12×12, aucune forme lisse/vectorielle, palettes limitées par joueur,
animations en steps()). À conserver dans la refonte v0.2.
