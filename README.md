# Wizard Dame — v0.2 (PROTOTYPE)

> **État : prototype en cours de développement**, déployé pour tests. Tout n'est pas développé : test navigateur restant, 3 cartes simplifiées et 2 cartes en attente (voir la synthèse des juges dans `rapports-equipe/`). **Migration Phaser FAITE (2026-10-23)** — voir la section « Architecture » plus bas.

**Jeu de stratégie tactique au tour par tour, inspiré des dames : cartes, bluff, fusions et propriétés émergentes.**

Implémentation du *Document complet de conception v0.2* d'Ekoue (2026-10-23 ; voir `SPEC_v0.2_notes.md`). Aucun build : **Phaser 3.60.0 est vendorisé localement** (`vendor/phaser.min.js`, 1 158 769 octets, aucun CDN au runtime) — servir ce dossier en HTTP statique (compatible GitHub Pages).

## Règles implémentées (v0.2)

- **Plateau 8×8, 12 pions par joueur. Placement libre et secret (décision d'Ekoue, 2026-10-23)** : chaque joueur pose ses 12 pions où il veut dans ses 3 rangées (J1 : rangées 1-3 en bas, J2 : rangées 6-8), sans voir ceux de l'adversaire (pions adverses masqués jusqu'au début de la partie), avec un bouton « placer le reste au hasard ». Flux : `deploy1 → select1 → passation → deploy2 → select2 → move` (`deployPawn`, `undeployPawn`, `autoDeploy`, `finishDeploy`, `passDevice` dans `engine.js`, testés par `tests/tests-placement-libre.js`). Sans l'option `{ deploy: true }`, `createGame` garde l'ancienne mise en place (utilisée par les suites de tests historiques et la simulation). Le Joueur 1 (violet, en bas) commence.
- **Déplacement de base : 1 case dans les 8 directions** vers une case vide. Aucune traversée de pièce.
- **Capture par saut (8 directions)** : pion adverse adjacent, case immédiatement derrière libre. **Non obligatoire. Une seule capture par déplacement de base** — aucune chaîne (ni par défaut, ni dans le catalogue initial).
- **Pas de promotion / Dame** : la v0.2 ne la mentionne pas, elle n'est donc pas réintroduite (la couronne dorée de la v1 a été retirée des sprites).
- **Protections avant retrait (§4.3)** : les captures contre un pion protégé sont exclues des coups légaux ; une protection à usage unique (Bouclier runique, Égide) est consommée lorsqu'elle bloque.
- **Pièce essentielle (ÉTABLI)** : avant la partie, chaque joueur choisit secrètement un de ses pions via un flux de passation (écran « passe l'appareil » entre les deux choix, plateau masqué). Rien sur l'apparence ne le signale. **Capturer la pièce essentielle adverse = victoire immédiate.** Un bouton « maintenir pour révéler » permet au propriétaire de se rappeler sa position (et son info Sonde) — sur écran partagé, l'adversaire ne doit pas regarder. Autres victoires : capturer tous les pions adverses ; adversaire sans aucun coup légal au début de son tour *(hypothèse de cohérence, à confirmer — voir plus bas)*.
- **Structure de tour (§5)** : 1) pioche si main < 4 ; 2) déplacement principal ; 3) **au maximum 1 carte, jouée après le déplacement** ; 4-5) résolution dans l'ordre stable du §5.3, protections d'abord ; 6) vérification de la pièce essentielle et des autres victoires ; 7) expirations de fin de tour. Une carte dont les conditions ne sont pas remplies est **injouable et reste en main**. Avant confirmation, l'interface affiche cible, conditions, coût, risque, effet et durée (§5.2).
- **Mains et decks (§6)** : 3 cartes au départ, **maximum 4**. Pioche vide → défausse remélangée ; pioche et défausse vides → aucune pioche. **Seule la main du joueur courant est affichée** ; la main adverse apparaît en dos de cartes (nombre seulement). Cartes jouées → défausse, sauf cartes **bannies** (Fusion, Résurrection, Dernier pari) qui quittent la partie. Decks prédéfinis, comparables sans être identiques (37 cartes chacun) :

| Famille | Cartes (J1 / J2) |
|---|---|
| Mouvement | Pas spectral ×2/×1, Échange ×1/×2, Repoussement ×2/×1, Pas de côté ×2/×2, Marque de passage ×1/×2 |
| Défense | Bouclier runique ×2/×2, Ancrage ×1/×1, Garde de case ×1/×1, Dissipation ×1/×1, Dernier rempart ×1/×1 |
| Fusion | Fusion ×1/×1, Mutation ×2/×1, Purification ×1/×1, Éveil ×1/×2, Réversion ×1/×1 |
| Pièges/bluff | Piège runique ×2/×1, Leurre ×1/×2, Sonde ×1/×1, Voile ×1/×1, Fausse piste ×1/×1 |
| Perturbation | Gel ×2/×2, Silence magique ×1/×1, Contresort ×1/×1, Interférence ×1/×1, Lien ×1/×1 |
| Retour/risque | Résurrection ×1/×1, Duplication ×1/×1, Sacrifice ×1/×1, Pacte instable ×1/×1, Dernier pari ×1/×1 |

- **Principes §1** respectés dans le catalogue : chaque carte crée une décision (pas de simple bonus de puissance) et les cartes fortes portent des contraintes (usage unique/bannissement, sacrifice, coût différé, conditions strictes).

## Les 30 cartes — statut d'implémentation

Toutes sont définies dans le code comme **définitions structurées** (`CARDS` dans `engine.js` : id, nom, famille, description, cible, conditions, coûts, risques, effet, durée, bannissement/usage unique) qui pilotent l'interface et la résolution — pas 30 cas bricolés dans l'UI.

**Complètes :** Pas spectral, Échange (refusé si un pion est ancré), Repoussement (adjacence à un pion allié, case derrière libre, ancré refusé), Pas de côté, Marque de passage (traverser une case occupée lors d'un glissement de 2, sans capturer), Bouclier runique (prochaine capture, consommé), Ancrage, Garde de case, Dissipation, Dernier rempart (coût supplémentaire si cible essentielle : sacrifice d'une autre carte, choisi dans le panneau), Mutation, Purification (ordre déterministe : première propriété de chaque type), Éveil (glissement de 2 pendant le prochain tour, puis immobilisation), Réversion (restaure le dernier snapshot de propriétés), Piège runique (caché — visible seulement pendant le tour de son propriétaire ; immobilise le premier adversaire qui entre, pour son prochain tour ; 3 tours complets max), Leurre (ne bloque pas ; disparaît à 1 case d'un adversaire), Sonde (usage unique ; moitié selon les rangées 1-4 / 5-8, orientation du Joueur 1 ; expire après 2 tours ; info derrière le bouton de révélation), Voile (inspections adverses bloquées), Fausse piste (marque de soupçon « ? » déplaçable sur un pion non essentiel), Gel (interdiction de re-geler un pion gelé au tour précédent), Contresort (effet temporaire ou piège/garde ciblés), Interférence (le lanceur révèle une carte ; l'adversaire choisit — boutons numérotés face cachée — la carte qu'il défausse), Lien (distance de Manhattan ≤ 3 appliquée dans le calcul des coups légaux des deux pions), Résurrection (rangée de départ libre, aucun effet temporaire, max 1 propriété positive, bannie), Duplication (double sans propriété, jamais essentiel ; l'original perd une propriété positive jusqu'à la fin de son prochain tour), Sacrifice (pion **banni définitivement** — pas ressuscitable ; pioche 2 puis défausse jusqu'à 4, en commençant par la fin de main — choix par défaut documenté), Pacte instable, Dernier pari (condition ≤ 2 pions vérifiée ; choix déplacement de 2 en ligne / protection ; fin du tour : toute la main défaussée, pas de pioche au tour suivant).

**Simplifiées (signalées) :**
- **Silence magique** : dans le catalogue provisoire des propriétés, toutes les propriétés sont traitées comme « actives » ; la distinction actif/passif viendra avec le vrai catalogue.
- **Dernier rempart** : le document dit « jusqu'à la fin du tour en cours » — appliqué tel quel (expire à la fin du tour du lanceur), ce qui en fait surtout une protection contre les effets immédiats ; durée à re-tester en partie (§1.3 : carte faible mais fiable/coût spécial sur l'essentielle).
- **Durées comptées en « tours »** : les effets temporaires décrémentent à la fin du tour de leur propriétaire (`ownerEnd`) ou de l'adversaire (`oppEnd`) selon leur nature — c'est l'interprétation déterministe retenue, à valider en test.

**Corrections appliquées par l'orchestrateur après la ronde des 7 juges (2026-10-23, voir `rapports-equipe/00-synthèse-orchestrateur.md`) :**
- **Protections consommées** : une capture contre un pion protégé est une tentative légale ; la protection annule la capture et se consume (§4.3). Avant : captures exclues des coups légaux → Bouclier runique et Égide étaient permanents.
- **Gel** : un joueur dont tous les pions sont immobilisés passe son tour au lieu de perdre la partie.
- **Marque de passage** : la capture vers une case n'est plus écrasée par le glissement vers la même case.
- **Dernier pari (interface)** : le mode « déplacer de 2 cases » demande maintenant les 2 cibles (pion + case) — il était injouable dans l'UI.
- **Garde de case** : durée portée à 1,5 tour (décrément 0,5/fin de tour) pour qu'un allié puisse réellement y entrer avant expiration — interprétation signalée, à valider (le texte « fin du prochain tour adverse » rendait la carte morte).
- **Tests versionnés** : les suites de tests de logique vivent désormais dans `tests/` (avant : uniquement dans /tmp, non rejouables).

## ⚠ Choix provisoires en attente de validation (ambiguïtés du document)

Le système de fusion et le catalogue des propriétés **ne figurent pas dans le texte v0.2 reçu** (le §7.3 y renvoie, mais la section est absente). En attendant la section d'Ekoue :

1. **Propriétés provisoires** (le plus petit ensemble cohérent) : **Égide** (positive, permanente : bloque la première capture subie, puis se consume), **Ailes** (positive, permanente : glissement de 2 cases en ligne, chemin libre, sans capturer), **Entrave** (négative, permanente : plus de déplacements diagonaux). Mutation propose un choix entre Égide et Ailes. Tout le code concerné est commenté « PROVISOIRE ».
2. **Fusion provisoire** : nouveau pion sur la case du **premier** pion choisi, **personnage du premier pion**, union des propriétés plafonnée à **2 positives + 1 négative**. **La pièce essentielle ne peut pas être fusionnée** (le sort de l'essentielle dans une fusion est indéfini ; c'est le choix le plus sûr). La Fusion reste **bannie** après usage, comme établi.
3. **Victoire par absence de coup légal** au début du tour adverse : ajoutée par cohérence avec le moteur, **à confirmer**.
4. **Sonde** : moitiés = rangées 1-4 (« supérieure ») / 5-8 (« inférieure ») vues du Joueur 1, **à confirmer**.
5. **Sélection de l'essentielle** : flux de passation sur un seul écran (proposition d'interface du document), **à valider** par Ekoue.
6. **Sacrifice** : la défausse de dépassement après pioche se fait par défaut depuis la fin de la main (le joueur ne choisit pas encore carte par carte dans l'UI).

## Direction artistique — pixel art intégral (section 12)

- **Grille de pixels stricte** : le plateau est rendu à sa résolution logique (144×144 px : cadre de 8 px + cases de 16 px). Pions, dalles, marqueurs, puces, surbrillances et particules sont tous posés sur cette grille, et l'agrandissement est un **multiple entier de pixels physiques** (zoom = n / devicePixelRatio, recalculé au redimensionnement) : aucun pixel inégal, aucun flou.
- **Plateau — terrain fantastique, plus de damier** (décision d'Ekoue) : carte de terrain continue (herbe, prairie fleurie, dalles moussues, sable, cristaux lumineux) générée par bruit lissé, **symétrique par rotation de 180°**, répartition fixe des biomes et disposition propre à chaque partie, **place runique** au centre (D4-E5). Les biomes sont purement décoratifs. Liseré sombre d'1 px entre les cases pour la lisibilité, cadre biseauté à rivets dorés, **coordonnées A–H / 1–8** en police pixel 3×5. Surbrillances en sprites clignotant image par image : gemme verte (déplacement), crochets rouges (capture), cadre doré (sélection), pointillés dorés (cible de carte), coins blancs (survol).
- **Pions = personnages** (décision d'Ekoue, thème « ordre des mages ») : **Mage, Chevalier, Archère, Golem, Hibou, Esprit**, sprites 16×16 dessinés à la main (`PIECE_SPRITES` dans `art.js`), tenues aux couleurs du camp (violet / orange), contour automatique, ombre portée, **animation de repos** (respiration d'1 px, décalée). Toujours cosmétiques : `SHAPES` contient désormais ces 6 identifiants, affichés via `pieceName()`. Zone de placement en pointillés dorés pendant le déploiement. Puces d'état et marqueurs (garde, piège, soupçon) en sprites pixel, plus de caractères Unicode.
- **Cartes (G1 fait)** : **30 sujets originaux 16×16, un par carte** (`CARD_SUBJECTS` dans `art.js`), posés dans une scène 32×24 sur une seule grille (décor de famille, aura pointillée, runes).
- **Interface** : polices pixel vendorisées (Press Start 2P, Silkscreen, VT323 — OFL, `vendor/fonts/`), boîtes et boutons à coins coupés, **menu principal**, écran des règles, écran de passation, **écran de victoire** (couronne, pion vainqueur, statistiques), compteurs à icônes, dos de cartes, fond étoilé et favicon en pixel art.
- **Animations** : saut en 4 pas avec ombre détachée, **éclats de capture**, **flash de transformation** (propriété/protection gagnée), **matérialisation** (Résurrection, Duplication, Fusion), cercle runique d'activation, bannières de tour et de carte jouée glissant en `steps()`.
- Ressources : `art.js` (données et fonctions pures, testées par `tests/art-check.js`).

## Sons 8-bit (Web Audio, aucun fichier externe)

Sons générés en code (ondes carrées/triangulaires, courts, volume modeste, contexte audio initialisé paresseusement au premier geste car les navigateurs l'exigent) : **déplacement, capture (arpège), pioche, carte jouée, activation de bouclier, gel, fusion, résurrection, piège déclenché, changement de tour, sélection, buzz d'action invalide, victoire**. Bouton **Son : OUI/NON** dans l'en-tête.

## Animations et effets visuels

- **Déplacement animé case par case** : le pion « saute » de sa case d'origine à sa destination en **4 images (steps())**, avec un arc en escalier — aucun fondu fluide moderne.
- **Un effet visuel distinct par carte** : table `CARD_FX` indexée par id de carte — couleurs et motif propres à chaque effet (anneau doré pour Bouclier runique, neige bleue pixel pour Gel, particules convergentes pour Fusion et Duplication, montée dorée pour Résurrection et Éveil, flash de rune pour Piège runique et Garde de case, voile gris pour Voile et Silence, double éclat pour Échange/Interférence/Réversion, liaison pour Lien, etc.), plus un flash pixel sur chaque case ciblée.
- Particules de capture, de déclenchement de piège et de disparition de leurre ; bannière de victoire clignotante en `steps()`.

## Architecture (migration Phaser, 2026-10-23)

Migration exécutée selon le plan de la synthèse des juges (§5) — moteur décidé par Ekoue : **Phaser 3.60.0**, vendorisé en local (`vendor/phaser.min.js`, 1 158 769 octets), **aucun CDN au runtime, aucune étape de build** : GitHub Pages sert les fichiers statiques tels quels.

- **`engine.js` — logique pure** : constantes, catalogue `CARDS`, decks, machine à états (y compris le placement libre et secret), système de propriétés provisoire, `CARD_FX`. **Zéro DOM, zéro Phaser** : il se charge sous Node pour les tests.
- **`art.js` — ressources pixel art** : données et fonctions pures (personnages, terrain, sujets de cartes, police 3×5, sprites d'interface), elles aussi testables sous Node.
- **`phaser-main.js` — plateau en Phaser** : config `pixelArt: true` (aucun lissage), plateau logique 144×144 agrandi par multiple entier de pixels physiques ; scène Boot qui génère les textures depuis `art.js` via canvas textures ; scène Board : terrain, personnages (sprites persistants par id), surbrillances des coups légaux (`pawnMoves`), clics → `WDCellClick`, **saut animé en 4 pas discrets**, **particules pixel par carte** alimentées par `CARD_FX`, marqueurs en sprites pixel.
- **`ui-dom.js` — hybride DOM** : main de cartes, panneau de détail §5.2, journal, indicateur de tour, placement, écrans (menu, règles, passation, victoire) et bouton Son, qui appellent les fonctions du moteur. Synthétiseur de sons 8-bit Web Audio. Pont plateau ⇄ DOM : `WDBoard.sync(view, hop)` et `window.WDCellClick(r, c)`. `window.WDDebug` (état complet de la partie) n'existe qu'avec `?debug` dans l'URL, pour les tests navigateur.
- L'ancien monolithe `game.js` et ses scripts d'extraction (`build-engine.py`, `build-ui-dom.py`) ont été **retirés** après validation de la version Phaser en navigateur (parties complètes jouées sur ordinateur et mobile, sans erreur). Ils restent consultables dans l'historique git.

## Tests

- **`npm test`** lance toutes les suites (`tests/run-all.js`) et échoue si l'une d'elles échoue. `npm run test:sim` lance une simulation de 1 000 parties ; `npm run check` vérifie la syntaxe des sources ; `npm run serve` sert le jeu en local. Aucune dépendance à installer (Node ≥ 18).
- `tests-logique-juge-script.js` (juges) : **27 PASS, 0 FAIL, 8 CONNUS**. Les tests A8a/A8b/B11, qui attendaient l'ancien comportement « capture contre un pion protégé exclue », vérifient désormais la règle en vigueur (correction A : tentative légale, capture annulée, protection consommée). Les **8 bugs CONNUS** (B3, B4, B5, B7, B8, B9, B12, B13) sont des comportements prouvés mais non corrigés, en attente d'une décision de conception (backlog ci-dessous) : ils s'affichent « CONNU » sans faire échouer la suite, et la suite échoue si l'un d'eux se met à passer, pour qu'on le retire de la liste.
- `tests-corrections-orchestrateur.js` : 9 PASS. `tests-journal-deplacements.js` : 10 PASS. `tests-placement-libre.js` : 20 PASS. `art-check.js` : ressources pixel art valides.
- `simulation-bot-vs-bot.js` (200 parties, bots aléatoires) : **200/200 terminées, 0 erreur moteur, 256,4 plis moyens**, victoires par la pièce essentielle 200/200.
- Navigateur : parties complètes jouées (Chrome, ordinateur 1280 px et mobile 390 px à densité ×3), placement secret, capture, carte jouée, écran de victoire — aucune erreur console. Reste à vérifier sur l'URL publique : sons et rendu sur d'autres navigateurs.

## Reste à faire (hors migration)

- **Test sur l'URL publique** : sons, autres navigateurs (Firefox, Safari).
- **Backlog gameplay de la synthèse (§6.3)** — reproduit par les 8 tests CONNUS du juge : durées Silence/Lien, Dernier rempart (décision d'Ekoue), Purification (catalogue de propriétés d'Ekoue), Dissipation vs gel en cours, J2 qui commence à 4 cartes, Lien contourné par les cartes de déplacement, anti-re-gel, piège asymétrique J1/J2.
- **Qualité du code** : découper `playCard` (un `switch` de ~325 lignes) en une fonction de résolution par carte dans `CARDS` ; faire émettre des événements au moteur plutôt que du texte de journal ; passer aux modules ES natifs (sans build) pour sortir de l'espace global.

## Fichiers

- `index.html` — page et panneaux (charge Phaser vendorisé, `engine.js`, `art.js`, `phaser-main.js`, `ui-dom.js`)
- `style.css` — interface pixel art + cartes à collectionner (bloc corrections Designer en fin de fichier)
- `engine.js` — logique pure du jeu (aucun DOM, aucun Phaser), catalogue des 30 cartes, données pixel art
- `art.js` — ressources pixel art de la section 12 (sujets de cartes, pions, dalles, police 3×5, sprites d'interface)
- `vendor/fonts/` — polices pixel OFL (Press Start 2P, Silkscreen, VT323) et leurs licences
- `phaser-main.js` — rendu Phaser du plateau (textures, surbrillances, animations, particules)
- `ui-dom.js` — UI DOM hybride (cartes, détail §5.2, journal, passation, sons Web Audio)
- `vendor/phaser.min.js` — Phaser 3.60.0 vendorisé (aucun CDN au runtime)
- `tests/` — suites de logique rejouables, simulation bot-vs-bot, placement libre, journal, contrôle des ressources pixel art, et `run-all.js` (lanceur de `npm test`)
- `package.json` — scripts `test`, `test:sim`, `check`, `serve` (aucune dépendance)
- `rapports-equipe/` — rapports des 7 juges et synthèse de l'orchestrateur (non versionné dans ce dépôt)
- `SPEC_v0.2_notes.md` — notes de prise en charge du document v0.2 et ambiguïtés signalées
- `references/` — captures fournies par Ekoue (référence de style pour les cartes, à ne pas copier ; non versionné dans ce dépôt)
- `README.md` — ce document
