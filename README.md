# Wizard Dame — v0.2 (PROTOTYPE)

> **État : prototype en cours de développement**, déployé pour tests. Tout n'est pas développé : test navigateur restant, 3 cartes simplifiées et 2 cartes en attente (voir la synthèse des juges dans `rapports-equipe/`). **Migration Phaser FAITE (2026-10-23)** — voir la section « Architecture » plus bas.

**Jeu de stratégie tactique au tour par tour, inspiré des dames : cartes, bluff, fusions et propriétés émergentes.**

Implémentation du *Document complet de conception v0.2* d'Ekoue (2026-10-23 ; voir `SPEC_v0.2_notes.md`). Aucun build : **Phaser 3.60.0 est vendorisé localement** (`vendor/phaser.min.js`, 1 158 769 octets, aucun CDN au runtime) — servir ce dossier en HTTP statique (compatible GitHub Pages).

## Règles implémentées (v0.2)

- **Plateau 8×8, 12 pions par joueur**, placés sur les cases foncées des 3 premières rangées, mise en place symétrique. Le Joueur 1 (violet, en bas) commence.
- **Déplacement de base : 1 case dans les 8 directions** vers une case vide. Les pions **ne sont pas limités aux cases foncées** après le départ. Aucune traversée de pièce.
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
2. **Fusion provisoire** : nouveau pion sur la case du **premier** pion choisi, **forme du premier pion**, union des propriétés plafonnée à **2 positives + 1 négative**. **La pièce essentielle ne peut pas être fusionnée** (le sort de l'essentielle dans une fusion est indéfini ; c'est le choix le plus sûr). La Fusion reste **bannie** après usage, comme établi.
3. **Victoire par absence de coup légal** au début du tour adverse : ajoutée par cohérence avec le moteur, **à confirmer**.
4. **Sonde** : moitiés = rangées 1-4 (« supérieure ») / 5-8 (« inférieure ») vues du Joueur 1, **à confirmer**.
5. **Sélection de l'essentielle** : flux de passation sur un seul écran (proposition d'interface du document), **à valider** par Ekoue.
6. **Sacrifice** : la défausse de dépassement après pioche se fait par défaut depuis la fin de la main (le joueur ne choisit pas encore carte par carte dans l'UI).

## Direction artistique — pixel art intégral

- **Pions** : sprites **16×16 définis pixel par pixel** (`SPRITE_MAPS`), 6 formes uniques (cercle, carré, triangle, losange, hexagone, étoile), palettes limitées par joueur (J1 violet `#7c3aed`/`#b79cff`, gemme or ; J2 orange `#ea580c`/`#ffb37a`, gemme ciel), affichés avec `image-rendering: pixelated` — aucun flou, aucun anticrénelage, aucun dégradé lissé, aucun vectoriel.
- **Cartes = vraies cartes à collectionner** (référence visuelle fournie par Ekoue, captures dans `references/` — pour le style seulement, aucun élément copié) : mise en page structurée — **en-tête avec le nom et un badge circulaire numéroté** (n° du catalogue, 1 à 30) en coin, **grande fenêtre d'illustration**, **panneau de texte séparé** (fond parchemin) sous l'illustration, **bande du bas** avec l'icône et le nom de famille + mentions (BANNIE, UNIQUE). Cadres épais à bordures pixel en escalier, teintés par famille.
- **L'illustration est une SCÈNE complète, pas une icône sur fond uni** : scène procédurale 48×36 logique dessinée pixel par pixel (`cardSceneURL` dans `ui-dom.js`, résolution interne doublée à 96×72 pour des multiples entiers à l'affichage) — décor propre à chaque famille (pierres runiques et piliers pour Défense, montagnes et chemin pour Mouvement, cristaux pour Fusion, forêt sombre pour Pièges, ciel d'orage et éclairs pour Perturbation, arche et lune pour Retour), ombrage en **tramage damier** à tons durs (aucun dégradé), sujet (glyphe de famille agrandi) **grand et centré**, entouré d'une **aura magique** (deux anneaux pixel pointillés aux couleurs de la carte) et de **runes flottantes** dorées/teintées aux quatre coins — l'aura et les runes visualisent le pouvoir de la carte (ex. Bouclier runique : anneaux or/violet et runes autour du bouclier). La carte en main montre une version simplifiée de la même mise en page ; le **panneau de détail/confirmation** affiche la carte en grand format avec tous ses champs (§5.2).
- **Corrections visuelles du Designer Cartes appliquées (rapport 05, C1–C12)** : sujet de scène en **couleur pleine** avec contour sombre (fini le quasi-noir illisible), teinte propre à chaque carte dominante sur le sujet, **en-tête et pied codés par la couleur de la famille**, badge numéroté qui **déborde** de la carte, **vraie version compacte en main** (première phrase + clamp 4 lignes), bandeau méta « cible • durée », libellés de famille accentués (« Défense », « Piège »), noms longs en police réduite, media query mobile réparée. Reste le gros chantier **G1 : un sujet de scène unique par carte** (aujourd'hui, un glyphe par famille teinté par carte).
- **Interface** : coins carrés, bordures en escalier, police monospace, compteurs et indicateurs dans le même langage. Marqueurs de plateau en pixel/chiffres (garde ✦, piège ✷ — visible seulement par son propriétaire pendant son tour, soupçon « ? », puces d'état B/R/É/A/E/G/L/V/S…).

## Sons 8-bit (Web Audio, aucun fichier externe)

Sons générés en code (ondes carrées/triangulaires, courts, volume modeste, contexte audio initialisé paresseusement au premier geste car les navigateurs l'exigent) : **déplacement, capture (arpège), pioche, carte jouée, activation de bouclier, gel, fusion, résurrection, piège déclenché, changement de tour, sélection, buzz d'action invalide, victoire**. Bouton **Son : OUI/NON** dans l'en-tête.

## Animations et effets visuels

- **Déplacement animé case par case** : le pion « saute » de sa case d'origine à sa destination en **4 images (steps())**, avec un arc en escalier — aucun fondu fluide moderne.
- **Un effet visuel distinct par carte** : table `CARD_FX` indexée par id de carte — couleurs et motif propres à chaque effet (anneau doré pour Bouclier runique, neige bleue pixel pour Gel, particules convergentes pour Fusion et Duplication, montée dorée pour Résurrection et Éveil, flash de rune pour Piège runique et Garde de case, voile gris pour Voile et Silence, double éclat pour Échange/Interférence/Réversion, liaison pour Lien, etc.), plus un flash pixel sur chaque case ciblée.
- Particules de capture, de déclenchement de piège et de disparition de leurre ; bannière de victoire clignotante en `steps()`.

## Architecture (migration Phaser, 2026-10-23)

Migration exécutée selon le plan de la synthèse des juges (§5) — moteur décidé par Ekoue : **Phaser 3.60.0**, vendorisé en local (`vendor/phaser.min.js`, 1 158 769 octets), **aucun CDN au runtime, aucune étape de build** : GitHub Pages sert les fichiers statiques tels quels.

- **`engine.js` — logique pure** : constantes, catalogue `CARDS`, decks, machine à états, système de propriétés provisoire, `CARD_FX`, et les données pixel art (`SPRITE_MAPS`, palettes de scènes) comme données. **Zéro DOM, zéro Phaser** : il se charge sous Node exactement comme `game.js` le faisait, et toutes les suites de tests passent contre lui avec des sorties identiques à l'ancien monolithe.
- **`phaser-main.js` — plateau en Phaser** : config `pixelArt: true` (aucun lissage), mise à l'échelle entière (Scale FIT sur un plateau logique 512×512) ; scène Boot qui génère les textures des pions (16×16 par forme et par palette) depuis `SPRITE_MAPS` via canvas textures ; scène Board : cases, pions (sprites persistants par id), surbrillances des coups légaux (`pawnMoves`), clics → `applyMove`, **saut animé en 4 pas discrets** (image par image), **particules pixel par carte** alimentées par `CARD_FX` (déplacement quantifié en 6 pas), marqueurs en sprites/texte (gardes ✦, pièges ✷ du propriétaire, leurres, marque de soupçon, puces d'état).
- **`ui-dom.js` — hybride DOM** (recommandation de l'orchestrateur) : main de cartes, panneau de détail §5.2, journal, indicateur de tour, menus, écran de victoire, passation du choix secret (texte en DOM) et bouton Son restent en DOM/CSS, repris de l'ancienne interface, et appellent les mêmes fonctions du moteur. Le synthétiseur de sons 8-bit Web Audio est repris **tel quel**. Pont plateau ⇄ DOM : `WDBoard.sync(view, hop)` et `window.WDCellClick(r, c)`.
- **`game.js` — ancien monolithe CONSERVÉ** : la parité logique est prouvée (tests identiques), mais le test navigateur réel n'a pas encore eu lieu ; le monolithe ne sera retiré qu'après ce test. `index.html` charge désormais la version Phaser.

## Tests

- `node --check` : OK sur `engine.js`, `phaser-main.js`, `ui-dom.js` et les suites de `tests/`.
- `tests/tests-corrections-orchestrateur.js` contre `engine.js` : **9 PASS / 0 FAIL** (identique à `game.js`).
- `tests/tests-logique-juge-script.js` contre `engine.js` : **23 PASS / 12 FAIL** — identique à la baseline post-corrections de l'orchestrateur ; le FAIL B11 est l'inversion connue (le test constate l'ancien comportement « capture refusée », le moteur applique désormais la capture annulée + protection consommée, comme voulu).
- `tests/simulation-bot-vs-bot.js` (200 parties, bots aléatoires) contre `engine.js` : **200/200 terminées, 0 erreur moteur, 256,4 plis moyens, victoires par la pièce essentielle 200/200** (baseline orchestrateur sur `game.js` : 200/200, ~241,6 plis, essentielles dominantes).
- Suites du constructeur v2/v2b (cartes) contre `engine.js` : sorties identiques aux baselines `game.js` (v2 : les 2 seuls échecs sont les assertions de l'ancien comportement « capture contre protégé exclue », remplacé volontairement par la correction A de l'orchestrateur).
- Service local vérifié : `index.html`, `engine.js`, `phaser-main.js`, `ui-dom.js`, `vendor/phaser.min.js`, `style.css` tous en **HTTP 200**.
- Limites : **pas encore de test navigateur réel** de la version Phaser (l'environnement d'exécution bloque les URL locales pour l'outil navigateur) — il reste planifié sur l'URL publique après déploiement ; le rendu Phaser, les sons et une partie complète doivent y être vérifiés. Les mains « secrètes » le sont par affichage (seule la main du joueur courant est rendue) mais les deux joueurs partagent le même écran.

## Reste à faire (hors migration)

- **Test navigateur réel** sur l'URL publique (rendu Phaser, sons, partie complète, corrections visuelles C1–C12 à valider à l'œil).
- **G1 — sujets de scène uniques par carte** (chantier design du rapport 05).
- **Backlog gameplay de la synthèse (§6.3), NON touché par la migration** : durées Silence/Lien, Dernier rempart (décision d'Ekoue), Purification (catalogue de propriétés d'Ekoue), Dissipation vs gel en cours, J2 qui commence à 4 cartes, Lien contourné par les cartes de déplacement, anti-re-gel, piège asymétrique J1/J2.
- Retrait de `game.js` après parité navigateur prouvée.

## Fichiers

- `index.html` — page, panneaux, écrans de passation (charge Phaser vendorisé, `engine.js`, `phaser-main.js`, `ui-dom.js`)
- `style.css` — interface pixel art + cartes à collectionner (bloc corrections Designer en fin de fichier)
- `engine.js` — logique pure du jeu (aucun DOM, aucun Phaser), catalogue des 30 cartes, données pixel art
- `phaser-main.js` — rendu Phaser du plateau (textures, surbrillances, animations, particules)
- `ui-dom.js` — UI DOM hybride (cartes, détail §5.2, journal, passation, sons Web Audio)
- `vendor/phaser.min.js` — Phaser 3.60.0 vendorisé (aucun CDN au runtime)
- `game.js` — ancien monolithe conservé jusqu'à parité navigateur prouvée
- `tests/` — suites de logique rejouables + simulation bot-vs-bot
- `rapports-equipe/` — rapports des 7 juges et synthèse de l'orchestrateur
- `SPEC_v0.2_notes.md` — notes de prise en charge du document v0.2 et ambiguïtés signalées
- `references/` — captures fournies par Ekoue (référence de style pour les cartes, à ne pas copier)
- `build-engine.py` / `build-ui-dom.py` — scripts d'extraction traçable d'`engine.js` et d'`ui-dom.js` depuis `game.js`
- `README.md` — ce document
