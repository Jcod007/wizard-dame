"use strict";
/*
 * Wizard Dame — engine.js : LOGIQUE PURE du jeu (migration Phaser, 2026-10-23).
 * Extrait mécaniquement de game.js : constantes, catalogue CARDS, decks,
 * machine à états, système de propriétés provisoire, CARD_FX, et les DONNÉES
 * pixel art des scènes de cartes — comme données uniquement (les sprites des
 * personnages et du terrain sont dans art.js).
 * ZÉRO référence DOM, ZÉRO référence Phaser : chargeable sous Node (tests)
 * exactement comme game.js. Le rendu vit dans phaser-main.js (plateau) et
 * ui-dom.js (cartes/menus en DOM, sons Web Audio).
 *
 * Wizard Dame — v0.2 (document de conception d'Ekoue, 2026-10-23).
 * Moteur pur (testable sous Node, DOM gardé derrière typeof document) + interface.
 * Aucune dépendance, aucun build.
 *
 * SYSTÈME DE PROPRIÉTÉS PROVISOIRE — EN ATTENTE DE LA SECTION FUSION/PROPRIÉTÉS D'EKOUE :
 * le document v0.2 parle de propriétés sans en donner le catalogue, ni le calcul de Fusion.
 * Le plus petit ensemble cohérent retenu ici (marqué PROVISOIRE dans le README) :
 *   - aegis  (positive, permanente) : bloque la première capture subie, puis se consume.
 *   - ailes  (positive, permanente) : le pion peut glisser de 2 cases en ligne droite/diagonale
 *              si le chemin est libre (sans capturer).
 *   - entrave(positive=false, permanente) : le pion ne peut plus se déplacer en diagonale.
 * Fusion PROVISOIRE : nouveau pion sur la case d'origine du premier pion choisi, forme du
 * premier pion, union des propriétés plafonnée à 2 positives et 1 négative ; la pièce
 * essentielle NE PEUT PAS être fusionnée (règle provisoire, signalée).
 */

/* ================= Pièces : personnages (décision d'Ekoue, 2026-10-23) =================
 * Les anciennes formes géométriques (cosmétiques) sont remplacées par 6 personnages
 * du thème « ordre des mages ». Toujours cosmétiques : aucune règle n'en dépend.
 * Les sprites vivent dans art.js (PIECE_SPRITES). */

var SHAPES = ["mage", "chevalier", "archere", "golem", "hibou", "esprit"];
var PIECE_NAMES = { mage: "Mage", chevalier: "Chevalier", archere: "Archère", golem: "Golem", hibou: "Hibou", esprit: "Esprit" };
function pieceName(shape) { return PIECE_NAMES[shape] || shape; }

var PLAYER_PALETTES = {
  1: { outline: "#241047", main: "#7c3aed", light: "#b79cff", gem: "#f5c542" },
  2: { outline: "#431407", main: "#ea580c", light: "#ffb37a", gem: "#7dd3fc" }
};

/* Glyphe générique 12x12 par famille, teinté par carte (palette propre à chaque carte). */
var FAMILY_GLYPHS = {
  mouvement: [
    ".....XX.....", "....XXXX....", "...XXXXXX...", ".....XX.....",
    ".....XX.....", ".X...XX...X.", "..X..XX..X..", "...X.XX.X...",
    "....XXXX....", ".....XX.....", "............", "............" ],
  defense: [
    ".XXXXXXXXXX.", "X..........X", "X....XX....X", "X...XXXX...X",
    "X...XXXX...X", "X....XX....X", ".X........X.", ".X........X.",
    "..X......X..", "...X....X...", "....X..X....", ".....XX....." ],
  fusion: [
    "............", ".XXX....XXX.", "X...X..X...X", "X...XXXX...X",
    ".X........X.", "..X..XX..X..", "...XXXXXX...", "....XXXX....",
    ".....XX.....", "............", "............", "............" ],
  piege: [
    "............", "....XXXX....", "...X....X...", "...X.XX.X...",
    "....XXXX....", "...X....X...", "..XXXXXX....", ".X.XXXX.X...",
    ".X......X...", "..XXXXXX....", "............", "............" ],
  perturbation: [
    ".....XX.....", ".X...XX...X.", "..X..XX..X..", "...X.XX.X...",
    "....XXXX....", ".XXXXXXXXXX.", "....XXXX....", "...X.XX.X...",
    "..X..XX..X..", ".X...XX...X.", ".....XX.....", "............" ],
  retour: [
    "....XXXX....", "..XX....XX..", ".X........X.", ".X...XX....X",
    "....XXXX...X", ".....XX....X", "............", ".X...XX...X.",
    "..X..XX..X..", "...XXXXXX...", "....XXXX....", "............" ]
};

var FAMILY_COLORS = {
  mouvement: "#4ade80", defense: "#9db4d8", fusion: "#e879f9",
  piege: "#facc15", perturbation: "#7dd3fc", retour: "#fda4af"
};


/* ================= Effets visuels par carte (table par id) ================= */
/* pattern: burst | ring | snow | rise | converge | rune | swap | link | veil */
var CARD_FX = {
  pas_spectral:   { colors: ["#c4b5fd", "#ffffff", "#7c3aed"], pattern: "burst" },
  echange:        { colors: ["#4ade80", "#ffffff", "#166534"], pattern: "swap" },
  repoussement:   { colors: ["#fca5a5", "#ffffff", "#dc2626"], pattern: "burst" },
  pas_de_cote:    { colors: ["#86efac", "#ffffff", "#4ade80"], pattern: "burst" },
  marque_passage: { colors: ["#fde68a", "#ffffff", "#f59e0b"], pattern: "ring" },
  bouclier_runique:{ colors: ["#f5c542", "#fff3c4", "#9db4d8"], pattern: "ring" },
  ancrage:        { colors: ["#9db4d8", "#e8efff", "#64748b"], pattern: "ring" },
  garde_case:     { colors: ["#f5c542", "#9db4d8", "#ffffff"], pattern: "rune" },
  dissipation:    { colors: ["#a7f3d0", "#ffffff", "#34d399"], pattern: "burst" },
  dernier_rempart:{ colors: ["#f5c542", "#ffffff", "#b45309"], pattern: "ring" },
  fusion:         { colors: ["#e879f9", "#f5d0fe", "#a21caf"], pattern: "converge" },
  mutation:       { colors: ["#e879f9", "#86efac", "#ffffff"], pattern: "burst" },
  purification:   { colors: ["#ffffff", "#a7f3d0", "#e879f9"], pattern: "burst" },
  eveil:          { colors: ["#fde68a", "#e879f9", "#ffffff"], pattern: "rise" },
  reversion:      { colors: ["#c4b5fd", "#ffffff", "#7c3aed"], pattern: "swap" },
  piege_runique:  { colors: ["#facc15", "#78350f", "#ffffff"], pattern: "rune" },
  leurre:         { colors: ["#facc15", "#ffffff", "#a16207"], pattern: "burst" },
  sonde:          { colors: ["#fef08a", "#ffffff", "#eab308"], pattern: "ring" },
  voile:          { colors: ["#94a3b8", "#e2e8f0", "#475569"], pattern: "veil" },
  fausse_piste:   { colors: ["#facc15", "#ffffff", "#ca8a04"], pattern: "rune" },
  gel:            { colors: ["#7dd3fc", "#e0f7ff", "#ffffff"], pattern: "snow" },
  silence:        { colors: ["#94a3b8", "#7dd3fc", "#ffffff"], pattern: "veil" },
  contresort:     { colors: ["#fda4af", "#ffffff", "#7dd3fc"], pattern: "burst" },
  interference:   { colors: ["#fda4af", "#facc15", "#ffffff"], pattern: "swap" },
  lien:           { colors: ["#7dd3fc", "#e879f9", "#ffffff"], pattern: "link" },
  resurrection:   { colors: ["#f5c542", "#fff3c4", "#ffffff"], pattern: "rise" },
  duplication:    { colors: ["#fda4af", "#ffffff", "#fb7185"], pattern: "converge" },
  sacrifice:      { colors: ["#ef4444", "#fca5a5", "#450a0a"], pattern: "burst" },
  pacte_instable: { colors: ["#e879f9", "#ef4444", "#f5c542"], pattern: "ring" },
  dernier_pari:   { colors: ["#f5c542", "#ef4444", "#ffffff"], pattern: "ring" }
};

/* ================= Propriétés PROVISOIRES des pions ================= */

var PROPERTY_CATALOG = {
  aegis:   { nom: "Égide", positive: true, permanent: true,
             description: "Bloque la première capture subie, puis se consume." },
  ailes:   { nom: "Ailes", positive: true, permanent: true,
             description: "Peut glisser de 2 cases en ligne (chemin libre, sans capturer)." },
  entrave: { nom: "Entrave", positive: false, permanent: true,
             description: "Ne peut plus se déplacer en diagonale." }
};
var MUTATION_POOL = ["aegis", "ailes"]; // propriétés communes proposées par Mutation (provisoire)

function hasProp(pawn, id) {
  return pawn.props.some(function (p) { return p.id === id && !p.silenced; });
}
function propIndex(pawn, id) {
  for (var i = 0; i < pawn.props.length; i++) if (pawn.props[i].id === id) return i;
  return -1;
}
function addProp(pawn, id) {
  if (propIndex(pawn, id) >= 0) return false;
  pawn.props.push({ id: id, silenced: false });
  return true;
}

/* ================= Catalogue des 30 cartes (définitions structurées) ================= */
/* cible: ownPawn | enemyPawn | anyPawn | ownPair | enemyPair | emptyCell | ownPawnOrCell |
          graveyard | none (avec choix) — voir playCard. duree/cout/risque: texte affiché
          avant confirmation (§5.2) + champs machine quand c'est utile. */

var CARDS = {
  pas_spectral: { nom: "Pas spectral", famille: "mouvement", teinte: "#c4b5fd", cible: "ownPawn",
    description: "Au prochain tour, ce pion pourra glisser de 2 cases en ligne si le chemin est libre (sans capturer).",
    conditions: "Cible : un de tes pions, non immobilisé.", cout: "Aucun.", risque: "Aucun.",
    duree: "Jusqu'à utilisation, au plus tard à la fin de ton prochain tour." },
  echange: { nom: "Échange", famille: "mouvement", teinte: "#4ade80", cible: "ownPair",
    description: "Échange la position de deux de tes pions.",
    conditions: "Deux pions alliés, ni l'un ni l'autre ancré.", cout: "Aucun.", risque: "Aucun.",
    duree: "Immédiat." },
  repoussement: { nom: "Repoussement", famille: "mouvement", teinte: "#fca5a5", cible: "enemyPawn",
    description: "Repousse un pion adverse adjacent à un de tes pions, d'une case à l'opposé de ton pion.",
    conditions: "Cible adverse adjacente à un pion allié ; case derrière elle libre et sur le plateau ; cible non ancrée.",
    cout: "Aucun.", risque: "Peut pousser l'adversaire vers une meilleure case.", duree: "Immédiat." },
  pas_de_cote: { nom: "Pas de côté", famille: "mouvement", teinte: "#86efac", cible: "ownPawnCell",
    description: "Déplace un de tes pions d'une case en diagonale vers une case vide (déplacement supplémentaire).",
    conditions: "Pion allié non immobilisé ; case diagonale libre choisie.", cout: "Aucun.", risque: "Aucun.",
    duree: "Immédiat." },
  marque_passage: { nom: "Marque de passage", famille: "mouvement", teinte: "#fde68a", cible: "ownPawn",
    description: "À ton prochain tour, ce pion pourra traverser une case occupée lors d'un glissement de 2 cases, sans capturer la pièce traversée.",
    conditions: "Cible : un de tes pions.", cout: "Aucun.", risque: "Aucun.",
    duree: "Jusqu'au début de ton prochain tour." },
  bouclier_runique: { nom: "Bouclier runique", famille: "defense", teinte: "#f5c542", cible: "ownPawn",
    description: "Protège un de tes pions contre la prochaine capture ; le bouclier est ensuite consommé.",
    conditions: "Cible : un de tes pions.", cout: "Aucun.", risque: "Ne protège ni de l'immobilisation ni des déplacements forcés.",
    duree: "Jusqu'à la prochaine tentative de capture contre ce pion." },
  ancrage: { nom: "Ancrage", famille: "defense", teinte: "#94a3b8", cible: "ownPawn",
    description: "Ce pion ne peut être ni repoussé ni échangé jusqu'au début de ton prochain tour. Il peut toujours bouger normalement.",
    conditions: "Cible : un de tes pions.", cout: "Aucun.", risque: "Aucun.", duree: "Jusqu'au début de ton prochain tour." },
  garde_case: { nom: "Garde de case", famille: "defense", teinte: "#f5c542", cible: "emptyCell",
    description: "Pose une garde visible sur une case vide : le premier de tes pions qui y entre gagne un Bouclier runique.",
    conditions: "Case vide, sans piège ni garde.", cout: "Aucun.", risque: "Visible par l'adversaire.",
    duree: "Jusqu'à la fin du prochain tour adverse, ou jusqu'à utilisation." },
  dissipation: { nom: "Dissipation", famille: "defense", teinte: "#34d399", cible: "ownPawn",
    description: "Retire un effet temporaire négatif d'un de tes pions (gel, silence, entrave temporaire, lien…).",
    conditions: "Le pion doit porter au moins un effet temporaire négatif.", cout: "Aucun.", risque: "Aucun.",
    duree: "Immédiat." },
  dernier_rempart: { nom: "Dernier rempart", famille: "defense", teinte: "#b45309", cible: "ownPawn",
    description: "Protège un de tes pions d'une capture jusqu'à la fin du tour en cours.",
    conditions: "Cible : un de tes pions. Si c'est ta pièce essentielle, tu dois aussi sacrifier une autre carte de ta main.",
    cout: "Si la cible est la pièce essentielle : défausser une autre carte.", risque: "Durée très courte (voir choix provisoires).",
    duree: "Jusqu'à la fin du tour en cours." },
  fusion: { nom: "Fusion", famille: "fusion", teinte: "#e879f9", cible: "ownPair", bannie: true,
    description: "Fusionne deux de tes pions en un seul (règle PROVISOIRE, voir README) : nouveau pion sur la case du premier pion choisi, sa forme, union des propriétés (max 2 positives, 1 négative).",
    conditions: "Deux pions alliés ; la pièce essentielle ne peut pas être fusionnée (provisoire).",
    cout: "Les deux pions d'origine disparaissent ; la carte est bannie après usage.", risque: "Perdre une pièce essentielle est impossible, mais tu passes de 2 pions à 1.",
    duree: "Permanent." },
  mutation: { nom: "Mutation", famille: "fusion", teinte: "#a3e635", cible: "ownPawnChoice",
    description: "Ajoute à un de tes pions une propriété commune, choisie parmi deux possibilités proposées par le jeu (Égide ou Ailes — catalogue provisoire).",
    conditions: "Le pion ne doit pas déjà avoir la propriété choisie.", cout: "Aucun.",
    risque: "Tu ne garantis pas d'obtenir la propriété idéale : tu choisis entre deux.", duree: "Permanent." },
  purification: { nom: "Purification", famille: "fusion", teinte: "#ffffff", cible: "ownPawn",
    description: "Retire du pion une propriété négative ET une propriété positive (ordre déterministe : la première de chaque type dans la liste du pion).",
    conditions: "Le pion doit porter au moins une propriété négative et une positive.", cout: "Perd aussi une propriété positive.",
    risque: "Peut retirer une propriété précieuse.", duree: "Immédiat." },
  eveil: { nom: "Éveil", famille: "fusion", teinte: "#fde68a", cible: "ownPawn",
    description: "Renforce ce pion pendant un tour : il pourra glisser de 2 cases (chemin libre, sans capturer). À la fin de l'effet, il sera immobilisé jusqu'à la fin de ton prochain tour.",
    conditions: "Cible : un de tes pions.", cout: "Immobilisation différée (fin de l'effet).",
    risque: "Le pion éveillé devient ensuite une cible facile.", duree: "Renfort : 1 tour (le tien, à venir) ; puis immobilisation 1 tour." },
  reversion: { nom: "Réversion", famille: "fusion", teinte: "#c4b5fd", cible: "ownPawn",
    description: "Annule la dernière transformation de ce pion (Mutation, Éveil, Purification…) et restaure ses propriétés d'avant. Ne défait pas une fusion, ne restaure pas un pion éliminé.",
    conditions: "Le pion doit avoir subi une transformation réversible.", cout: "Aucun.", risque: "Aucun.", duree: "Immédiat." },
  piege_runique: { nom: "Piège runique", famille: "piege", teinte: "#facc15", cible: "emptyCell",
    description: "Pose un piège CACHÉ sur une case vide : le premier pion adverse qui y entre est immobilisé pendant son prochain tour. Le piège est alors révélé et consommé.",
    conditions: "Case vide, sans piège ni garde.", cout: "Aucun.", risque: "Si l'adversaire évite la case, aucun effet.",
    duree: "3 tours complets maximum." },
  leurre: { nom: "Leurre", famille: "piege", teinte: "#fde047", cible: "emptyCell",
    description: "Crée un faux pion visuel sur une case vide. Il ne bloque pas, ne capture pas, ne peut pas être capturé ; il disparaît dès qu'un pion adverse s'en approche à une case.",
    conditions: "Case vide.", cout: "Aucun.", risque: "Disparaît vite si l'adversaire avance.", duree: "Jusqu'à approche adverse." },
  sonde: { nom: "Sonde", famille: "piege", teinte: "#fef08a", cible: "none", unique: true,
    description: "Information privée : la pièce essentielle adverse se trouve-t-elle dans la moitié supérieure (rangées 1 à 4) ou inférieure (rangées 5 à 8) du plateau ?",
    conditions: "Une seule utilisation par partie et par joueur.", cout: "Usage unique.", risque: "Information partielle seulement.",
    duree: "L'information expire après 2 de tes tours." },
  voile: { nom: "Voile", famille: "piege", teinte: "#94a3b8", cible: "ownPawn",
    description: "Masque les propriétés de ce pion aux inspections de l'adversaire jusqu'à la fin du prochain tour adverse. Ne masque ni sa position ni son existence.",
    conditions: "Cible : un de tes pions.", cout: "Aucun.", risque: "Aucun.", duree: "Jusqu'à la fin du prochain tour adverse." },
  fausse_piste: { nom: "Fausse piste", famille: "piege", teinte: "#ca8a04", cible: "ownPawn",
    description: "Place (ou déplace) la marque de soupçon visible sur un de tes pions NON essentiel, pour attirer les soupçons de l'adversaire.",
    conditions: "Cible : un de tes pions qui n'est pas la pièce essentielle.", cout: "Aucun.", risque: "Un adversaire méfiant peut deviner la feinte.",
    duree: "Jusqu'à ce qu'un nouveau soupçon soit placé." },
  gel: { nom: "Gel", famille: "perturbation", teinte: "#7dd3fc", cible: "enemyPawn",
    description: "Immobilise un pion adverse jusqu'à la fin de son prochain tour.",
    conditions: "Ne peut pas cibler un pion déjà gelé au tour précédent.", cout: "Aucun.", risque: "Aucun.",
    duree: "Jusqu'à la fin du prochain tour du propriétaire." },
  silence: { nom: "Silence magique", famille: "perturbation", teinte: "#64748b", cible: "anyPawn",
    description: "Désactive les propriétés ACTIVES d'un pion jusqu'à la fin du prochain tour de son propriétaire. Les propriétés passives continuent (voir choix provisoires : ici, toutes les propriétés du catalogue provisoire sont traitées comme actives).",
    conditions: "Cible : un pion (allié ou adverse) portant des propriétés.", cout: "Aucun.", risque: "Peut aussi servir à éteindre un effet gênant sur ton propre pion.",
    duree: "Jusqu'à la fin du prochain tour du propriétaire." },
  contresort: { nom: "Contresort", famille: "perturbation", teinte: "#fda4af", cible: "anyPawnOrCell",
    description: "Annule un effet temporaire ou un piège actif ciblé (sur un pion ou sur une case). Ne peut pas annuler une carte résolue ni une propriété permanente.",
    conditions: "La cible doit porter un effet temporaire ou être une case piégée/gardée.", cout: "Aucun.", risque: "Aucun.",
    duree: "Immédiat." },
  interference: { nom: "Interférence", famille: "perturbation", teinte: "#fb7185", cible: "noneChoice",
    description: "Tu révèles une carte de ta main, puis l'adversaire choisit une carte de SA main et la défausse.",
    conditions: "L'adversaire doit avoir au moins une carte en main ; tu dois en révéler une.", cout: "Révéler une carte de ta main (elle reste dans ta main).",
    risque: "L'adversaire apprend une de tes cartes.", duree: "Immédiat." },
  lien: { nom: "Lien", famille: "perturbation", teinte: "#38bdf8", cible: "enemyPair",
    description: "Lie deux pions adverses : jusqu'à la fin du prochain tour de leur propriétaire, ils ne peuvent pas s'éloigner à plus de 3 cases de distance de Manhattan l'un de l'autre. Tout coup qui violerait cette limite est illégal.",
    conditions: "Deux pions adverses distincts.", cout: "Aucun.", risque: "Aucun.", duree: "Jusqu'à la fin du prochain tour de leur propriétaire." },
  resurrection: { nom: "Résurrection", famille: "retour", teinte: "#f5c542", cible: "graveyardCell", bannie: true,
    description: "Ramène un de tes pions éliminés sur une case libre d'une de tes rangées de départ. Il revient sans effet temporaire et avec au plus une propriété positive.",
    conditions: "Avoir un pion éliminé (non banni définitivement) et une case de départ libre.",
    cout: "La carte est bannie après usage.", risque: "Aucun.", duree: "Permanent." },
  duplication: { nom: "Duplication", famille: "retour", teinte: "#fb7185", cible: "ownPawnCell",
    description: "Crée, sur une case libre adjacente, un double affaibli de ce pion : déplacement de base seulement, aucune propriété, jamais essentiel. L'original perd une propriété positive jusqu'à la fin de ton prochain tour.",
    conditions: "Pion allié et case adjacente libre.", cout: "L'original perd temporairement une propriété positive.",
    risque: "Le double est fragile (aucune propriété).", duree: "Double permanent (tant qu'il survit) ; perte de propriété : jusqu'à la fin de ton prochain tour." },
  sacrifice: { nom: "Sacrifice", famille: "retour", teinte: "#ef4444", cible: "ownPawnSacrifice",
    description: "Élimine définitivement un de tes pions NON essentiel (il ne pourra pas être ressuscité) pour piocher 2 cartes, puis défausser jusqu'à revenir à la limite de main (4).",
    conditions: "Pion allié non essentiel.", cout: "Le pion est perdu définitivement.", risque: "Tu joues avec un pion de moins, pour toujours.",
    duree: "Immédiat." },
  pacte_instable: { nom: "Pacte instable", famille: "retour", teinte: "#e879f9", cible: "ownPawn",
    description: "Double la durée d'un effet positif temporaire de ce pion. À la fin de la durée prolongée, le pion est immobilisé pendant un tour.",
    conditions: "Le pion doit porter un effet positif temporaire à durée comptée.", cout: "Immobilisation différée à la fin de l'effet prolongé.",
    risque: "L'échéance arrive plus tard… mais l'immobilisation aussi, et elle est certaine.", duree: "Double la durée de l'effet choisi." },
  dernier_pari: { nom: "Dernier pari", famille: "retour", teinte: "#f5c542", cible: "pariChoice", bannie: true,
    description: "UNIQUEMENT si tu as au plus 2 pions en jeu. Choix : (a) déplacer un de tes pions de 2 cases en ligne droite sur un chemin libre, ou (b) protéger un de tes pions contre une capture pendant un tour. À la fin du tour, tu défausses TOUTE ta main et tu ne pioches pas au prochain tour.",
    conditions: "Au plus 2 pions en jeu.", cout: "Carte bannie ; fin du tour : défausse de toute la main, pas de pioche au prochain tour.",
    risque: "Énorme : tu termines sans cartes.", duree: "Selon le choix." }
};
var CARD_IDS = Object.keys(CARDS);

/* Decks prédéfinis (comparables, non identiques) — composition documentée dans le README. */
var DECK_RECIPES = {
  1: { pas_spectral: 2, echange: 1, repoussement: 2, pas_de_cote: 2, marque_passage: 1,
       bouclier_runique: 2, ancrage: 1, garde_case: 1, dissipation: 1, dernier_rempart: 1,
       fusion: 1, mutation: 2, purification: 1, eveil: 1, reversion: 1,
       piege_runique: 2, leurre: 1, sonde: 1, voile: 1, fausse_piste: 1,
       gel: 2, silence: 1, contresort: 1, interference: 1, lien: 1,
       resurrection: 1, duplication: 1, sacrifice: 1, pacte_instable: 1, dernier_pari: 1 },
  2: { pas_spectral: 1, echange: 2, repoussement: 1, pas_de_cote: 2, marque_passage: 2,
       bouclier_runique: 2, ancrage: 1, garde_case: 1, dissipation: 1, dernier_rempart: 1,
       fusion: 1, mutation: 1, purification: 1, eveil: 2, reversion: 1,
       piege_runique: 1, leurre: 2, sonde: 1, voile: 1, fausse_piste: 1,
       gel: 2, silence: 1, contresort: 1, interference: 1, lien: 1,
       resurrection: 1, duplication: 1, sacrifice: 1, pacte_instable: 1, dernier_pari: 1 }
};

/* ================= Moteur de jeu (pur) ================= */

var DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
var HAND_MAX = 4, HAND_START = 3;

function makeRng(seed) {
  var s = (seed >>> 0) || 123456789;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function shuffle(arr, rng) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function key(r, c) { return r + "," + c; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

var _pawnSeq = 0;
function makePawn(player, shapeIdx) {
  _pawnSeq++;
  return {
    id: "p" + _pawnSeq, player: player, shape: SHAPES[shapeIdx % SHAPES.length],
    essential: false, double: false,
    props: [],            // propriétés PROVISOIRES [{id, silenced}]
    fx: [],               // effets temporaires [{kind, remaining, tick, data}]
    frozenForTurn: -1,    // n° de tour (compteur du propriétaire) pendant lequel il est immobilisé
    frozenLastTurn: -1,   // dernier tour du propriétaire où il a été gelé (anti re-gel)
    history: []           // snapshots de props avant transformation (Réversion)
  };
}

function buildDeckFor(player, rng) {
  var deck = [];
  var recipe = DECK_RECIPES[player];
  Object.keys(recipe).forEach(function (id) {
    for (var i = 0; i < recipe[id]; i++) deck.push(id);
  });
  return shuffle(deck, rng);
}

/* opts.deploy (décision d'Ekoue, 2026-10-23) : PLACEMENT LIBRE ET SECRET.
   Plateau vide ; chaque joueur pose ses 12 pions où il veut dans ses 3 rangées
   (J1 : rangées 1-3 du bas, J2 : rangées 6-8), puis choisit sa pièce essentielle :
     deploy1 -> select1 -> handover -> deploy2 -> select2 -> move.
   Sans opts.deploy, mise en place historique (cases foncées des 3 premières
   rangées) — conservée pour les suites de tests et la simulation. */
var PIECES_PER_PLAYER = 12;
function deployRows(player) { return player === 1 ? [5, 6, 7] : [0, 1, 2]; }

function createGame(seed, opts) {
  opts = opts || {};
  _pawnSeq = 0;
  var rng = makeRng(seed == null ? 987654321 : seed);
  var board = [];
  for (var r = 0; r < 8; r++) { board.push([]); for (var c = 0; c < 8; c++) board[r].push(null); }
  var idx = 0, rr, cc, reserve = { 1: [], 2: [] };
  if (opts.deploy) {
    for (idx = 0; idx < PIECES_PER_PLAYER; idx++) { reserve[1].push(makePawn(1, idx)); reserve[2].push(makePawn(2, idx)); }
  } else {
    for (rr = 0; rr < 3; rr++) for (cc = 0; cc < 8; cc++) if ((rr + cc) % 2 === 1) board[rr][cc] = makePawn(2, idx++);
    idx = 0;
    for (rr = 5; rr < 8; rr++) for (cc = 0; cc < 8; cc++) if ((rr + cc) % 2 === 1) board[rr][cc] = makePawn(1, idx++);
  }
  var g = {
    board: board, rngState: null,
    deployMode: !!opts.deploy,
    reserve: reserve,            // pions encore à poser (placement libre)
    phase: opts.deploy ? "deploy1" : "select1", // [deploy1 ->] select1 -> handover -> [deploy2 ->] select2 -> move -> card -> over
    current: 1,
    turnCount: { 1: 0, 2: 0 },   // nombre de tours commencés par joueur
    round: 1,
    hands: { 1: [], 2: [] }, decks: { 1: buildDeckFor(1, rng), 2: buildDeckFor(2, rng) },
    discards: { 1: [], 2: [] }, banned: { 1: [], 2: [] },
    graveyard: { 1: [], 2: [] }, // pions éliminés ressuscitables
    banished: { 1: [], 2: [] },  // éliminés définitivement (Sacrifice)
    traps: [],                   // {r,c,owner,roundsLeft}
    guards: [],                  // {r,c,owner,roundsLeft}
    decoys: [],                  // {r,c,owner,shape}
    suspicion: { 1: null, 2: null }, // id de pion portant la marque de soupçon de chaque joueur
    sondeUsed: { 1: false, 2: false },
    sondeInfo: { 1: null, 2: null }, // {half:'supérieure'|'inférieure', expiresTurn}
    captured: { 1: 0, 2: 0 },
    cardPlayedThisTurn: false,
    movedThisTurn: false,
    noDrawNext: { 1: false, 2: false },
    lastEvent: null,             // {type, ...} pour sons/FX côté UI
    winner: null, winReason: null,
    log: []
  };
  g.hands[1] = drawCards(g, 1, HAND_START);
  g.hands[2] = drawCards(g, 2, HAND_START);
  g._rng = rng;
  return g;
}

function drawCards(g, player, n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    if (g.decks[player].length === 0) {
      if (g.discards[player].length === 0) break;
      g.decks[player] = shuffle(g.discards[player], g._rng || Math.random);
      g.discards[player] = [];
    }
    out.push(g.decks[player].pop());
  }
  return out;
}

function findPawn(g, id) {
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = g.board[r][c];
    if (p && p.id === id) return { pawn: p, r: r, c: c };
  }
  return null;
}
function pawnAt(g, r, c) { return inB(r, c) ? g.board[r][c] : null; }
function countPawns(g, player) {
  var n = 0;
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++)
    if (g.board[r][c] && g.board[r][c].player === player) n++;
  return n;
}
function isImmobilised(g, pawn) {
  return pawn.frozenForTurn === g.turnCount[pawn.player];
}
function fxOf(pawn, kind) {
  for (var i = 0; i < pawn.fx.length; i++) if (pawn.fx[i].kind === kind) return pawn.fx[i];
  return null;
}
function addFx(pawn, kind, remaining, tick, data) {
  var old = fxOf(pawn, kind);
  if (old) { old.remaining = Math.max(old.remaining, remaining); if (data) old.data = data; return old; }
  var fx = { kind: kind, remaining: remaining, tick: tick || "ownerEnd", data: data || null };
  pawn.fx.push(fx);
  return fx;
}
function removeFx(pawn, kind) {
  pawn.fx = pawn.fx.filter(function (f) { return f.kind !== kind; });
}
/* Un pion est protégé contre la capture si : bouclier runique actif OU Égide non réduite au silence. */
function captureProtection(g, pawn) {
  if (fxOf(pawn, "shield")) return "shield";
  if (fxOf(pawn, "rempart")) return "rempart";
  if (hasProp(pawn, "aegis")) return "aegis";
  if (fxOf(pawn, "pariProtect")) return "pariProtect";
  return null;
}
function snapshotProps(pawn) { pawn.history.push(clone(pawn.props)); }

/* ---- Légalité des déplacements ---- */

/* Les liens actifs contraignant CE pion : retourne la liste des partenaires liés. */
function linkPartners(g, pawn) {
  var out = [];
  [1, 2].forEach(function (pl) {
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var q = g.board[r][c];
      if (q && q !== pawn) {
        var lf = fxOf(q, "link");
        if (lf && lf.data && lf.data.partnerId === pawn.id && fxOf(pawn, "link")) out.push(q);
      }
    }
  });
  var my = fxOf(pawn, "link");
  if (my && my.data) { var f = findPawn(g, my.data.partnerId); if (f) out.push(f.pawn); }
  return out;
}
function linkOkAfterMove(g, pawn, toR, toC) {
  var partners = linkPartners(g, pawn);
  for (var i = 0; i < partners.length; i++) {
    var f = findPawn(g, partners[i].id);
    if (f && Math.abs(toR - f.r) + Math.abs(toC - f.c) > 3) return false;
  }
  return true;
}
function canSlide2(g, pawn) {
  return fxOf(pawn, "spectral") || fxOf(pawn, "eveille") || hasProp(pawn, "ailes") || fxOf(pawn, "passage");
}
function slide2ThroughOk(g, pawn, midPawn) {
  if (!midPawn) return true;
  return !!fxOf(pawn, "passage"); // Marque de passage : traverser sans capturer
}

/*
 * Coups légaux du pion en (r,c) dans l'état g.
 * [{toR,toC,capture:[r,c]|null,slide2:bool}]
 * - 8 directions, 1 case, case vide.
 * - Capture par saut (8 directions), une seule. Cible protégée : la tentative est
 *   légale — la protection annule la capture et se consume (§4.3, correction
 *   orchestrateur 2026-10-23 : avant, l'exclusion rendait les protections
 *   permanentes, la branche de consommation d'applyMove était inatteignable).
 * - Glissement de 2 cases si effet/propriété l'autorise (jamais une capture).
 * - Entrave : pas de diagonale. Gel : aucun coup. Lien : distance de Manhattan ≤ 3 après le coup.
 */
function pawnMoves(g, r, c) {
  var pawn = pawnAt(g, r, c);
  if (!pawn || isImmobilised(g, pawn)) return [];
  var moves = [];
  var entrave = hasProp(pawn, "entrave");
  for (var i = 0; i < DIRS8.length; i++) {
    var dr = DIRS8[i][0], dc = DIRS8[i][1];
    var diag = dr !== 0 && dc !== 0;
    if (entrave && diag) continue;
    var r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (inB(r1, c1) && !g.board[r1][c1]) {
      if (linkOkAfterMove(g, pawn, r1, c1)) moves.push({ toR: r1, toC: c1, capture: null, slide2: false });
    }
    // Capture par saut
    if (inB(r2, c2) && !g.board[r2][c2] && inB(r1, c1) && g.board[r1][c1]) {
      var jumped = g.board[r1][c1];
      if (jumped.player !== pawn.player) {
        if (linkOkAfterMove(g, pawn, r2, c2)) moves.push({ toR: r2, toC: c2, capture: [r1, c1], slide2: false });
      }
    }
    // Glissement de 2 cases (Pas spectral / Éveil / Ailes / Marque de passage)
    // Correction orchestrateur 2026-10-23 : si une capture mène déjà à cette case,
    // ne pas émettre aussi le glissement (applyMove gardait le dernier = le
    // glissement, la capture devenait silencieusement inaccessible).
    var captureToSame = moves.some(function (m) { return m.capture && m.toR === r2 && m.toC === c2; });
    if (!captureToSame && canSlide2(g, pawn) && inB(r2, c2) && !g.board[r2][c2] && inB(r1, c1)) {
      var mid = g.board[r1][c1];
      if (slide2ThroughOk(g, pawn, mid)) {
        if (linkOkAfterMove(g, pawn, r2, c2)) moves.push({ toR: r2, toC: c2, capture: null, slide2: true });
      }
    }
  }
  return moves;
}
function playerHasAnyMove(g, player) {
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = g.board[r][c];
    if (p && p.player === player && pawnMoves(g, r, c).length > 0) return true;
  }
  return false;
}

/* ---- Sélection secrète de la pièce essentielle ---- */

/* ---- Placement libre et secret ---- */

function deployPawn(g, player, r, c, reserveIndex) {
  if (g.phase !== "deploy" + player) return { ok: false, error: "Ce n'est pas le moment de placer tes pions." };
  if (!inB(r, c) || deployRows(player).indexOf(r) < 0) return { ok: false, error: "Place tes pions dans TES 3 rangées de départ." };
  if (g.board[r][c]) return { ok: false, error: "Cette case est déjà occupée." };
  var res = g.reserve[player];
  if (!res.length) return { ok: false, error: "Tous tes pions sont déjà placés." };
  var i = reserveIndex == null ? 0 : reserveIndex;
  if (i < 0 || i >= res.length) return { ok: false, error: "Pion de réserve introuvable." };
  g.board[r][c] = res.splice(i, 1)[0];
  return { ok: true, pawn: g.board[r][c] };
}

function undeployPawn(g, player, r, c) {
  if (g.phase !== "deploy" + player) return { ok: false, error: "Ce n'est pas le moment de placer tes pions." };
  var p = pawnAt(g, r, c);
  if (!p || p.player !== player) return { ok: false, error: "Aucun de tes pions sur cette case." };
  g.board[r][c] = null;
  g.reserve[player].push(p);
  return { ok: true };
}

/* Pose les pions restants au hasard (graine de la partie) dans les cases libres. */
function autoDeploy(g, player) {
  if (g.phase !== "deploy" + player) return { ok: false, error: "Ce n'est pas le moment de placer tes pions." };
  var free = [];
  deployRows(player).forEach(function (r) { for (var c = 0; c < 8; c++) if (!g.board[r][c]) free.push([r, c]); });
  shuffle(free, g._rng);
  while (g.reserve[player].length && free.length) { var cell = free.pop(); g.board[cell[0]][cell[1]] = g.reserve[player].shift(); }
  return { ok: true };
}

function finishDeploy(g, player) {
  if (g.phase !== "deploy" + player) return { ok: false, error: "Ce n'est pas le moment de placer tes pions." };
  if (g.reserve[player].length) return { ok: false, error: "Il te reste " + g.reserve[player].length + " pion(s) à placer." };
  g.phase = "select" + player;
  return { ok: true };
}

/* Passation de l'appareil au Joueur 2 (écran de l'interface). */
function passDevice(g) {
  if (g.phase !== "handover") return { ok: false, error: "Pas de passation en cours." };
  g.current = 2;
  g.phase = g.deployMode ? "deploy2" : "select2";
  return { ok: true };
}

function chooseEssential(g, player, pawnId) {
  if (g.phase !== "select" + player) return { ok: false, error: "Ce n'est pas le moment de choisir." };
  var f = findPawn(g, pawnId);
  if (!f || f.pawn.player !== player) return { ok: false, error: "Choisis un de TES pions de départ." };
  f.pawn.essential = true;
  g.phase = player === 1 ? "handover" : "move";
  if (player === 2) { g.current = 1; startTurn(g, true); } // le Joueur 1 commence toujours
  return { ok: true };
}

/* ---- Tour ---- */

function startTurn(g, first) {
  g.current = g.current; // (déjà positionné par endTurn / chooseEssential)
  g.turnCount[g.current] += 1;
  g.movedThisTurn = false;
  g.cardPlayedThisTurn = false;
  g.phase = "move";
  // Expiration de la Sonde
  var si = g.sondeInfo[g.current];
  if (si && g.turnCount[g.current] > si.expiresTurn) g.sondeInfo[g.current] = null;
  // Pioche (§5.1) : début de tour, si main < 4, sauf tour suivant un Dernier pari.
  if (!first) {
    if (g.noDrawNext[g.current]) { g.noDrawNext[g.current] = false; }
    else if (g.hands[g.current].length < HAND_MAX) {
      var drawn = drawCards(g, g.current, 1);
      if (drawn.length) { g.hands[g.current].push(drawn[0]); g.lastEvent = { type: "draw", player: g.current }; }
    }
  }
  // Victoire : aucun coup légal au début du tour (hypothèse de cohérence, voir README).
  // Correction orchestrateur 2026-10-23 : exception immobilisation — si TOUS les
  // pions du joueur sont immobilisés pour ce tour (gel, piège, retombée d'Éveil),
  // il PASSE son tour au lieu de perdre (le gel ne dure qu'un tour du propriétaire).
  if (countPawns(g, g.current) > 0 && !playerHasAnyMove(g, g.current)) {
    var allImmobilised = true;
    for (var fr = 0; fr < 8; fr++) for (var fc = 0; fc < 8; fc++) {
      var fp = g.board[fr][fc];
      if (fp && fp.player === g.current && !isImmobilised(g, fp)) allImmobilised = false;
    }
    if (allImmobilised) {
      g.log.push("Joueur " + g.current + " : tous ses pions sont immobilisés — il passe son tour.");
      g.movedThisTurn = true; // le tour compte comme joué, sans déplacement
      return endTurn(g);
    }
    return winGame(g, other(g.current), "aucun coup légal au début du tour");
  }
  return { ok: true };
}
function other(p) { return p === 1 ? 2 : 1; }

function winGame(g, winner, reason) {
  g.winner = winner; g.winReason = reason; g.phase = "over";
  g.lastEvent = { type: "victory", player: winner };
  g.log.push("Victoire du Joueur " + winner + " — " + reason + ".");
  return { ok: true, winner: winner };
}

/* Après tout changement de position : pièges, gardes, leurres. */
function onPawnLands(g, pawn, r, c) {
  var events = [];
  // Piège adverse ?
  for (var i = g.traps.length - 1; i >= 0; i--) {
    var t = g.traps[i];
    if (t.r === r && t.c === c && t.owner !== pawn.player) {
      g.traps.splice(i, 1);
      pawn.frozenForTurn = g.turnCount[pawn.player] + 1; // immobilisé pendant SON prochain tour
      pawn.frozenLastTurn = pawn.frozenForTurn;
      events.push({ type: "trapTriggered", r: r, c: c, pawnId: pawn.id });
      g.log.push("Un piège runique se déclenche ! Un pion " + pieceName(pawn.shape) + " est immobilisé pour son prochain tour.");
    }
  }
  // Garde de case alliée ?
  for (var j = g.guards.length - 1; j >= 0; j--) {
    var gd = g.guards[j];
    if (gd.r === r && gd.c === c && gd.owner === pawn.player) {
      g.guards.splice(j, 1);
      addFx(pawn, "shield", 99, "untilCapture");
      events.push({ type: "guardTriggered", r: r, c: c, pawnId: pawn.id });
      g.log.push("La garde de case protège un pion " + pieceName(pawn.shape) + " (Bouclier runique).");
    }
  }
  // Leurres : disparition si un pion adverse s'approche à 1 case (distance de Tchebychev).
  for (var k = g.decoys.length - 1; k >= 0; k--) {
    var d = g.decoys[k];
    if (d.owner !== pawn.player && Math.max(Math.abs(d.r - r), Math.abs(d.c - c)) <= 1) {
      events.push({ type: "decoyVanish", r: d.r, c: d.c });
      g.decoys.splice(k, 1);
      g.log.push("Un leurre disparaît à l'approche d'un pion adverse.");
    }
  }
  return events;
}

/* Coordonnées « humaines » d'une case : colonne A–H (gauche → droite) et rang
   1–8 (rang 1 = rangée du bas, côté Joueur 1), comme aux échecs. */
function cellName(r, c) { return "ABCDEFGH"[c] + (8 - r); }

/* Déplacement principal. move = un élément de pawnMoves(g, r, c). */
function applyMove(g, r, c, move) {
  if (g.phase !== "move") return { ok: false, error: "Le déplacement principal doit avoir lieu maintenant (phase actuelle : " + g.phase + ")." };
  var pawn = pawnAt(g, r, c);
  if (!pawn || pawn.player !== g.current) return { ok: false, error: "Ce pion n'est pas à toi." };
  var legal = pawnMoves(g, r, c);
  var found = null;
  legal.forEach(function (m) { if (m.toR === move.toR && m.toC === move.toC) found = m; });
  if (!found) return { ok: false, error: "Coup illégal." };
  var events = [];
  g.board[move.toR][move.toC] = pawn;
  g.board[r][c] = null;
  if (found.slide2) {
    if (fxOf(pawn, "spectral")) removeFx(pawn, "spectral");
    events.push({ type: "move", slide2: true });
  }
  g.lastEvent = { type: found.capture ? "capture" : "move", from: [r, c], to: [move.toR, move.toC], player: g.current };
  if (found.capture) {
    var cr = found.capture[0], cc = found.capture[1];
    var victim = g.board[cr][cc];
    // Protection résolue AVANT tout retrait (§4.3) — déjà exclue des coups légaux,
    // mais on revérifie : une Égide se consume si elle bloque ici (défensif).
    var prot = captureProtection(g, victim);
    if (prot) {
      if (prot === "aegis") victim.props = victim.props.filter(function (p) { return p.id !== "aegis"; });
      if (prot === "shield") removeFx(victim, "shield");
      if (prot === "rempart") removeFx(victim, "rempart");
      if (prot === "pariProtect") removeFx(victim, "pariProtect");
      g.log.push("Capture annulée par une protection !");
    } else {
      g.board[cr][cc] = null;
      g.captured[g.current] += 1;
      events.push({ type: "capture", r: cr, c: cc, victimId: victim.id });
      g.log.push("Joueur " + g.current + " capture un pion " + pieceName(victim.shape) + ".");
      // Pièce essentielle d'abord (§5.3 étape 6)
      if (victim.essential) {
        g.phase = "card"; // la résolution continue proprement avant la victoire
        return winGame(g, g.current, "la pièce essentielle adverse a été capturée");
      }
      g.graveyard[victim.player].push(victim);
      if (countPawns(g, victim.player) === 0) return winGame(g, g.current, "tous les pions adverses ont été capturés");
    }
  }
  if (!found.capture) {
    g.log.push("Joueur " + g.current + " déplace un pion " + pieceName(pawn.shape) + " de " + cellName(r, c) + " vers " + cellName(move.toR, move.toC) + ".");
  }
  events = events.concat(onPawnLands(g, pawn, move.toR, move.toC));
  g.movedThisTurn = true;
  g.phase = "card";
  return { ok: true, events: events };
}

/* Expirations de fin de tour (§5 étape 8). tick: ownerEnd = fin d'un tour du
   propriétaire ; oppEnd = fin d'un tour de l'adversaire ; currentEnd = fin du tour en cours. */
function tickFx(g, justPlayed) {
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var p = g.board[r][c];
    if (!p) continue;
    var kept = [];
    p.fx.forEach(function (f) {
      var mine = p.player === justPlayed;
      var tickNow = (f.tick === "ownerEnd" && mine) || (f.tick === "oppEnd" && !mine) || f.tick === "currentEnd";
      if (f.tick === "untilCapture") { kept.push(f); return; }
      if (tickNow) {
        f.remaining -= 1;
        if (f.remaining <= 0) {
          // Conséquences différées
          if (f.kind === "silence") p.props.forEach(function (pr) { pr.silenced = false; });
          if (f.thenFreeze) {
            p.frozenForTurn = g.turnCount[p.player] + 1;
            g.log.push("Effet prolongé par pacte : un pion " + pieceName(p.shape) + " sera immobilisé à son prochain tour.");
          }
          if (f.kind === "eveille") {
            p.frozenForTurn = g.turnCount[p.player] + 1;
            g.log.push("L'éveil retombe : un pion " + pieceName(p.shape) + " sera immobilisé à son prochain tour.");
          }
          if (f.kind === "pacte" && f.data && f.data.thenFreeze) {
            p.frozenForTurn = g.turnCount[p.player] + 1;
            g.log.push("Le pacte instable se paie : un pion " + pieceName(p.shape) + " sera immobilisé à son prochain tour.");
          }
          if (f.kind === "suspendedProp" && f.data && f.data.propId) {
            addProp(p, f.data.propId);
          }
          return; // expiré
        }
      }
      kept.push(f);
    });
    p.fx = kept;
  }
  // Gardes et pièges : durée en tours complets (chaque fin de tour adverse du propriétaire… simplifié : décrément à chaque fin de tour)
  g.guards.forEach(function (gd) { gd.roundsLeft -= 0.5; });
  g.guards = g.guards.filter(function (gd) { return gd.roundsLeft > 0; });
  if (justPlayed === 2) { // fin d'un tour complet
    g.round += 1;
    g.traps.forEach(function (t) { t.roundsLeft -= 1; });
    g.traps = g.traps.filter(function (t) { return t.roundsLeft > 0; });
  }
}

function endTurn(g) {
  if (g.phase !== "card" && g.phase !== "move") return { ok: false, error: "Le tour ne peut pas se terminer maintenant." };
  if (g.phase === "move" && !g.movedThisTurn) return { ok: false, error: "Tu dois d'abord effectuer ton déplacement principal." };
  var justPlayed = g.current;
  // Dernier pari : à la fin du tour, défausse de TOUTE la main + pas de pioche au prochain tour.
  if (g.discardHandAtEnd && g.discardHandAtEnd[justPlayed]) {
    while (g.hands[justPlayed].length) g.discards[justPlayed].push(g.hands[justPlayed].pop());
    g.noDrawNext[justPlayed] = true;
    g.discardHandAtEnd[justPlayed] = false;
    g.log.push("Dernier pari : le Joueur " + justPlayed + " défausse toute sa main et ne piochera pas au prochain tour.");
  }
  tickFx(g, justPlayed);
  g.current = other(g.current);
  g.lastEvent = { type: "turn", player: g.current };
  g.log.push("Au tour du Joueur " + g.current + ".");
  var res = startTurn(g, false);
  return res && res.winner ? res : { ok: true };
}
function skipCard(g) { return endTurn(g); } // jouer zéro carte = terminer le tour

/* ================= Cartes : validation et résolution ================= */

function cellPawn(g, t) { return t ? pawnAt(g, t.r, t.c) : null; }
function cardError(msg) { return { ok: false, error: msg }; }

/* Conditions indépendantes de la cible (pour griser les cartes injouables, §5.2). */
function cardPrecheck(g, id) {
  var me = g.current, opp = other(me);
  switch (id) {
    case "sonde": if (g.sondeUsed[me]) return "Sonde déjà utilisée dans cette partie."; break;
    case "dernier_pari": if (countPawns(g, me) > 2) return "Dernier pari exige au plus 2 pions en jeu."; break;
    case "resurrection": if (!g.graveyard[me].length) return "Aucun pion éliminé à ressusciter."; break;
    case "interference": if (!g.hands[opp].length) return "L'adversaire n'a aucune carte en main."; break;
    case "sacrifice": {
      var okS = false;
      for (var r = 0; r < 8 && !okS; r++) for (var c = 0; c < 8; c++) {
        var p = g.board[r][c]; if (p && p.player === me && !p.essential) okS = true;
      }
      if (!okS) return "Aucun pion non essentiel à sacrifier."; break;
    }
  }
  return null;
}

function playCard(g, handIndex, targets, choices) {
  targets = targets || []; choices = choices || {};
  if (g.phase !== "card") return cardError("Une carte se joue APRÈS le déplacement principal (phase actuelle : " + g.phase + ").");
  if (g.cardPlayedThisTurn) return cardError("Une seule carte par tour.");
  var me = g.current, opp = other(me);
  var id = g.hands[me][handIndex];
  if (!id) return cardError("Carte introuvable dans ta main.");
  var def = CARDS[id];
  var pre = cardPrecheck(g, id);
  if (pre) return cardError(pre);
  var events = [{ type: "cardFx", card: id, cells: [] }];
  function fxCells() { targets.forEach(function (t) { if (t) events[0].cells.push([t.r, t.c]); }); }
  function ownPawnAt(t) { var p = cellPawn(g, t); return p && p.player === me ? p : null; }
  function enemyPawnAt(t) { var p = cellPawn(g, t); return p && p.player === opp ? p : null; }

  switch (id) {
    case "pas_spectral": case "marque_passage": case "ancrage": case "voile": case "eveil": {
      var tp = ownPawnAt(targets[0]); if (!tp) return cardError("Cible invalide : choisis un de tes pions.");
      if (id === "pas_spectral") addFx(tp, "spectral", 2, "ownerEnd");
      if (id === "marque_passage") addFx(tp, "passage", 2, "ownerEnd");
      if (id === "ancrage") addFx(tp, "anchored", 1, "oppEnd");
      if (id === "voile") addFx(tp, "veil", 1, "oppEnd");
      if (id === "eveil") { snapshotProps(tp); addFx(tp, "eveille", 2, "ownerEnd"); }
      break;
    }
    case "bouclier_runique": {
      var bp = ownPawnAt(targets[0]); if (!bp) return cardError("Cible invalide : choisis un de tes pions.");
      addFx(bp, "shield", 99, "untilCapture"); break;
    }
    case "dernier_rempart": {
      var rp = ownPawnAt(targets[0]); if (!rp) return cardError("Cible invalide : choisis un de tes pions.");
      if (rp.essential) {
        var di = choices.discardHandIndex;
        if (di == null || di === handIndex || !g.hands[me][di])
          return cardError("Pièce essentielle : choisis aussi une autre carte de ta main à sacrifier.");
      }
      addFx(rp, "rempart", 1, "currentEnd");
      break;
    }
    case "echange": {
      var a = ownPawnAt(targets[0]), b = ownPawnAt(targets[1]);
      if (!a || !b || a === b) return cardError("Échange : choisis deux de tes pions distincts.");
      if (fxOf(a, "anchored") || fxOf(b, "anchored")) return cardError("Un pion ancré ne peut pas être échangé.");
      var fa = findPawn(g, a.id), fb = findPawn(g, b.id);
      g.board[fa.r][fa.c] = b; g.board[fb.r][fb.c] = a;
      events = events.concat(onPawnLands(g, a, fb.r, fb.c), onPawnLands(g, b, fa.r, fa.c));
      break;
    }
    case "fusion": {
      var f1 = ownPawnAt(targets[0]), f2 = ownPawnAt(targets[1]);
      if (!f1 || !f2 || f1 === f2) return cardError("Fusion : choisis deux de tes pions distincts.");
      if (f1.essential || f2.essential) return cardError("La pièce essentielle ne peut pas être fusionnée (règle provisoire).");
      var pos1 = findPawn(g, f1.id), pos2 = findPawn(g, f2.id);
      var merged = makePawn(me, SHAPES.indexOf(f1.shape));
      var seen = {}, pos = [], neg = [];
      [f1, f2].forEach(function (src) { src.props.forEach(function (pr) {
        if (seen[pr.id]) return; seen[pr.id] = true;
        if (PROPERTY_CATALOG[pr.id].positive) { if (pos.length < 2) pos.push({ id: pr.id, silenced: false }); }
        else if (neg.length < 1) neg.push({ id: pr.id, silenced: false });
      }); });
      merged.props = pos.concat(neg);
      g.board[pos2.r][pos2.c] = null;
      g.board[pos1.r][pos1.c] = merged;
      g.log.push("Fusion ! Un nouveau pion " + pieceName(merged.shape) + " naît (propriétés provisoires : " +
        (merged.props.map(function (p) { return PROPERTY_CATALOG[p.id].nom; }).join(", ") || "aucune") + ").");
      break;
    }
    case "repoussement": {
      var ep = enemyPawnAt(targets[0]); if (!ep) return cardError("Cible invalide : choisis un pion adverse.");
      if (fxOf(ep, "anchored")) return cardError("Ce pion est ancré : il ne peut pas être repoussé.");
      var epos = findPawn(g, ep.id), pusher = null;
      for (var i = 0; i < DIRS8.length; i++) {
        var q = pawnAt(g, epos.r + DIRS8[i][0], epos.c + DIRS8[i][1]);
        if (q && q.player === me) { pusher = { dr: -DIRS8[i][0], dc: -DIRS8[i][1] }; break; }
      }
      if (!pusher) return cardError("Ce pion n'est adjacent à aucun de tes pions.");
      var dr2 = epos.r + pusher.dr, dc2 = epos.c + pusher.dc;
      if (!inB(dr2, dc2) || g.board[dr2][dc2]) return cardError("La case derrière ce pion n'est pas libre.");
      g.board[dr2][dc2] = ep; g.board[epos.r][epos.c] = null;
      events = events.concat(onPawnLands(g, ep, dr2, dc2));
      targets[0] = { r: dr2, c: dc2 };
      break;
    }
    case "pas_de_cote": case "duplication": {
      var sp = ownPawnAt(targets[0]); if (!sp) return cardError("Cible invalide : choisis un de tes pions.");
      if (id === "pas_de_cote" && isImmobilised(g, sp)) return cardError("Ce pion est immobilisé.");
      var dest = targets[1];
      if (!dest || !inB(dest.r, dest.c) || g.board[dest.r][dest.c]) return cardError("Choisis une case libre adjacente.");
      var spos = findPawn(g, sp.id);
      var dist = Math.max(Math.abs(dest.r - spos.r), Math.abs(dest.c - spos.c));
      if (dist !== 1) return cardError("La case doit être adjacente au pion.");
      if (id === "pas_de_cote") {
        if (dest.r === spos.r || dest.c === spos.c) return cardError("Pas de côté : diagonale uniquement.");
        g.board[dest.r][dest.c] = sp; g.board[spos.r][spos.c] = null;
        events = events.concat(onPawnLands(g, sp, dest.r, dest.c));
      } else {
        var dbl = makePawn(me, SHAPES.indexOf(sp.shape));
        dbl.double = true; dbl.props = [];
        g.board[dest.r][dest.c] = dbl;
        // L'original perd une propriété positive jusqu'à la fin de son prochain tour
        for (var pi = 0; pi < sp.props.length; pi++) {
          if (PROPERTY_CATALOG[sp.props[pi].id].positive) {
            var lost = sp.props.splice(pi, 1)[0];
            addFx(sp, "suspendedProp", 2, "ownerEnd", { propId: lost.id });
            break;
          }
        }
        events = events.concat(onPawnLands(g, dbl, dest.r, dest.c));
      }
      break;
    }
    case "garde_case": case "piege_runique": case "leurre": {
      var cell = targets[0];
      if (!cell || !inB(cell.r, cell.c) || g.board[cell.r][cell.c]) return cardError("Choisis une case vide du plateau.");
      var busy = g.traps.some(function (t) { return t.r === cell.r && t.c === cell.c; }) ||
                 g.guards.some(function (x) { return x.r === cell.r && x.c === cell.c; }) ||
                 g.decoys.some(function (x) { return x.r === cell.r && x.c === cell.c; });
      if (busy) return cardError("Cette case porte déjà un effet.");
      // Correction orchestrateur 2026-10-23 : roundsLeft 1.5 (décrément 0,5/fin de
      // tour) pour que la garde survive jusqu'à la fin du PROCHAIN tour de son
      // propriétaire — avec 1, elle expirait avant qu'un allié puisse y entrer
      // (carte morte, test T5 du Juge Gameplay). Interprétation signalée au README.
      if (id === "garde_case") g.guards.push({ r: cell.r, c: cell.c, owner: me, roundsLeft: 1.5 });
      if (id === "piege_runique") g.traps.push({ r: cell.r, c: cell.c, owner: me, roundsLeft: 3 });
      if (id === "leurre") g.decoys.push({ r: cell.r, c: cell.c, owner: me, shape: SHAPES[(cell.r + cell.c) % SHAPES.length] });
      break;
    }
    case "dissipation": {
      var dp = ownPawnAt(targets[0]); if (!dp) return cardError("Cible invalide : choisis un de tes pions.");
      var doneD = false;
      if (dp.frozenForTurn > g.turnCount[me]) { dp.frozenForTurn = -1; doneD = true; }
      if (!doneD) {
        var negFx = ["silence", "link"];
        for (var nf = 0; nf < negFx.length && !doneD; nf++) {
          if (fxOf(dp, negFx[nf])) {
            if (negFx[nf] === "silence") dp.props.forEach(function (pr) { pr.silenced = false; });
            if (negFx[nf] === "link") { var lp = findPawn(g, fxOf(dp, "link").data.partnerId); if (lp) removeFx(lp.pawn, "link"); }
            removeFx(dp, negFx[nf]); doneD = true;
          }
        }
      }
      if (!doneD) return cardError("Ce pion ne porte aucun effet temporaire négatif à dissiper.");
      break;
    }
    case "mutation": {
      var mp = ownPawnAt(targets[0]); if (!mp) return cardError("Cible invalide : choisis un de tes pions.");
      var choice = choices.propId;
      if (MUTATION_POOL.indexOf(choice) < 0) return cardError("Choisis la propriété parmi les deux proposées.");
      if (propIndex(mp, choice) >= 0) return cardError("Ce pion a déjà cette propriété.");
      snapshotProps(mp); addProp(mp, choice);
      break;
    }
    case "purification": {
      var pp = ownPawnAt(targets[0]); if (!pp) return cardError("Cible invalide : choisis un de tes pions.");
      var iNeg = -1, iPos = -1;
      pp.props.forEach(function (pr, ix) {
        if (!PROPERTY_CATALOG[pr.id].positive && iNeg < 0) iNeg = ix;
        if (PROPERTY_CATALOG[pr.id].positive && iPos < 0) iPos = ix;
      });
      if (iNeg < 0 || iPos < 0) return cardError("Purification exige une propriété négative ET une positive sur le pion.");
      snapshotProps(pp);
      pp.props = pp.props.filter(function (_, ix) { return ix !== iNeg && ix !== iPos; });
      break;
    }
    case "reversion": {
      var vp = ownPawnAt(targets[0]); if (!vp) return cardError("Cible invalide : choisis un de tes pions.");
      if (!vp.history.length) return cardError("Ce pion n'a subi aucune transformation réversible.");
      vp.props = vp.history.pop();
      removeFx(vp, "eveille"); removeFx(vp, "spectral");
      break;
    }
    case "sonde": {
      var ess = null;
      for (var sr = 0; sr < 8; sr++) for (var sc = 0; sc < 8; sc++) {
        var sp2 = g.board[sr][sc];
        if (sp2 && sp2.player === opp && sp2.essential) ess = { r: sr };
      }
      if (!ess) return cardError("Pièce essentielle adverse introuvable.");
      g.sondeUsed[me] = true;
      g.sondeInfo[me] = { half: ess.r < 4 ? "supérieure" : "inférieure", expiresTurn: g.turnCount[me] + 2 };
      break;
    }
    case "fausse_piste": {
      var fp = ownPawnAt(targets[0]); if (!fp) return cardError("Cible invalide : choisis un de tes pions.");
      if (fp.essential) return cardError("Fausse piste : la cible ne doit PAS être ta pièce essentielle.");
      g.suspicion[me] = fp.id;
      break;
    }
    case "gel": {
      var gp = enemyPawnAt(targets[0]); if (!gp) return cardError("Cible invalide : choisis un pion adverse.");
      if (gp.frozenLastTurn >= g.turnCount[gp.player] && gp.frozenLastTurn > 0)
        return cardError("Ce pion a déjà été gelé au tour précédent : re-gel interdit.");
      gp.frozenForTurn = g.turnCount[gp.player] + 1;
      gp.frozenLastTurn = gp.frozenForTurn;
      break;
    }
    case "silence": {
      var xp = cellPawn(g, targets[0]);
      if (!xp || !xp.props.length) return cardError("Cible invalide : choisis un pion portant des propriétés.");
      xp.props.forEach(function (pr) { pr.silenced = true; });
      addFx(xp, "silence", 2, "ownerEnd");
      break;
    }
    case "contresort": {
      var cp = cellPawn(g, targets[0]);
      var handled = false;
      if (cp) {
        var tempKinds = ["shield", "rempart", "spectral", "passage", "anchored", "veil", "eveille", "pariProtect", "link", "silence"];
        for (var tk = 0; tk < tempKinds.length && !handled; tk++) {
          if (fxOf(cp, tempKinds[tk])) {
            if (tempKinds[tk] === "silence") cp.props.forEach(function (pr) { pr.silenced = false; });
            if (tempKinds[tk] === "link") { var lp2 = fxOf(cp, "link").data; if (lp2) { var lf = findPawn(g, lp2.partnerId); if (lf) removeFx(lf.pawn, "link"); } }
            removeFx(cp, tempKinds[tk]); handled = true;
          }
        }
      } else if (targets[0]) {
        var before = g.traps.length + g.guards.length;
        g.traps = g.traps.filter(function (t) { return !(t.r === targets[0].r && t.c === targets[0].c); });
        g.guards = g.guards.filter(function (x) { return !(x.r === targets[0].r && x.c === targets[0].c); });
        handled = (g.traps.length + g.guards.length) < before;
      }
      if (!handled) return cardError("Aucun effet temporaire ni piège actif sur cette cible.");
      break;
    }
    case "interference": {
      var ri = choices.revealIndex;
      if (ri == null || !g.hands[me][ri]) return cardError("Choisis la carte de ta main à révéler.");
      var oi = choices.oppDiscardIndex;
      if (oi == null || !g.hands[opp][oi]) return cardError("L'adversaire doit choisir une de ses cartes à défausser.");
      var discardedOpp = g.hands[opp].splice(oi, 1)[0];
      g.discards[opp].push(discardedOpp);
      g.log.push("Interférence : le Joueur " + me + " révèle « " + CARDS[g.hands[me][ri]].nom +
        " » ; l'adversaire défausse « " + CARDS[discardedOpp].nom + " ».");
      break;
    }
    case "lien": {
      var l1 = enemyPawnAt(targets[0]), l2 = enemyPawnAt(targets[1]);
      if (!l1 || !l2 || l1 === l2) return cardError("Lien : choisis deux pions adverses distincts.");
      addFx(l1, "link", 2, "ownerEnd", { partnerId: l2.id });
      addFx(l2, "link", 2, "ownerEnd", { partnerId: l1.id });
      break;
    }
    case "resurrection": {
      var gi = choices.graveyardIndex;
      var dead = g.graveyard[me][gi];
      if (!dead) return cardError("Choisis le pion éliminé à ressusciter.");
      var rc = targets[0];
      var startRows = me === 1 ? [5, 6, 7] : [0, 1, 2];
      if (!rc || startRows.indexOf(rc.r) < 0 || g.board[rc.r][rc.c]) return cardError("Choisis une case libre d'une de tes rangées de départ.");
      g.graveyard[me].splice(gi, 1);
      dead.fx = []; dead.frozenForTurn = -1; dead.essential = false;
      dead.props = dead.props.filter(function (pr) { return PROPERTY_CATALOG[pr.id].positive; }).slice(0, 1);
      g.board[rc.r][rc.c] = dead;
      g.log.push("Résurrection ! Un pion " + pieceName(dead.shape) + " revient en jeu.");
      break;
    }
    case "sacrifice": {
      var sap = ownPawnAt(targets[0]); if (!sap) return cardError("Cible invalide : choisis un de tes pions.");
      if (sap.essential) return cardError("La pièce essentielle ne peut pas être sacrifiée.");
      var sapPos = findPawn(g, sap.id);
      g.board[sapPos.r][sapPos.c] = null;
      g.banished[me].push(sap);
      var drawnSac = drawCards(g, me, 2);
      drawnSac.forEach(function (cd) { g.hands[me].push(cd); });
      // La carte Sacrifice elle-même est encore en main à ce stade : on la retire d'abord.
      g.hands[me].splice(handIndex, 1);
      if (def.bannie) g.banned[me].push(id); else g.discards[me].push(id);
      while (g.hands[me].length > HAND_MAX) g.discards[me].push(g.hands[me].pop());
      g.cardPlayedThisTurn = true;
      g.lastEvent = { type: "card", card: id, player: me };
      g.log.push("Sacrifice : un pion " + pieceName(sap.shape) + " est perdu définitivement ; le Joueur " + me + " pioche 2 cartes.");
      fxCells();
      return { ok: true, events: events };
    }
    case "pacte_instable": {
      var up = ownPawnAt(targets[0]); if (!up) return cardError("Cible invalide : choisis un de tes pions.");
      var timed = null;
      up.fx.forEach(function (f) { if (!timed && f.tick !== "untilCapture" && f.remaining > 0 &&
        ["spectral", "passage", "eveille", "veil"].indexOf(f.kind) >= 0) timed = f; });
      if (!timed) return cardError("Ce pion ne porte aucun effet positif temporaire à durée comptée.");
      timed.remaining *= 2; timed.thenFreeze = true;
      break;
    }
    case "dernier_pari": {
      var qp = ownPawnAt(targets[0]); if (!qp) return cardError("Cible invalide : choisis un de tes pions.");
      if (choices.pariMode === "protect") {
        addFx(qp, "pariProtect", 1, "oppEnd");
      } else if (choices.pariMode === "move2") {
        var qdest = targets[1], qpos = findPawn(g, qp.id);
        if (!qdest || !inB(qdest.r, qdest.c) || g.board[qdest.r][qdest.c]) return cardError("Choisis la case d'arrivée (2 cases en ligne, chemin libre).");
        var qr = qdest.r - qpos.r, qc = qdest.c - qpos.c;
        if (!((Math.abs(qr) === 2 && qc === 0) || (Math.abs(qc) === 2 && qr === 0) || (Math.abs(qr) === 2 && Math.abs(qc) === 2)))
          return cardError("Dernier pari : exactement 2 cases en ligne droite ou en diagonale.");
        var mid = pawnAt(g, qpos.r + qr / 2, qpos.c + qc / 2);
        if (mid) return cardError("Le chemin n'est pas libre.");
        g.board[qdest.r][qdest.c] = qp; g.board[qpos.r][qpos.c] = null;
        events = events.concat(onPawnLands(g, qp, qdest.r, qdest.c));
      } else return cardError("Choisis le mode du pari : déplacement de 2 cases, ou protection.");
      g.discardHandAtEnd = g.discardHandAtEnd || {};
      g.discardHandAtEnd[me] = true;
      break;
    }
    default:
      return cardError("Carte non implémentée : " + id);
  }

  // Coût supplémentaire du Dernier rempart (sacrifice d'une autre carte)
  if (id === "dernier_rempart") {
    var tgt = cellPawn(g, targets[0]);
    if (tgt && tgt.essential) {
      var sac = g.hands[me].splice(choices.discardHandIndex, 1)[0];
      g.discards[me].push(sac);
      if (choices.discardHandIndex < handIndex) handIndex -= 1;
      g.log.push("Dernier rempart sur la pièce essentielle : « " + CARDS[sac].nom + " » est sacrifiée.");
    }
  }

  // La carte jouée quitte la main
  g.hands[me].splice(handIndex, 1);
  if (def.bannie) g.banned[me].push(id); else g.discards[me].push(id);
  g.cardPlayedThisTurn = true;
  g.lastEvent = { type: "card", card: id, player: me };
  if (id !== "interference") g.log.push("Joueur " + me + " joue « " + def.nom + " ».");
  fxCells();
  return { ok: true, events: events };
}


/* ================= Art de scène des cartes (grandes illustrations) ================= */
/*
 * Référence visuelle d'Ekoue : vraie carte à collectionner — le sujet est GRAND,
 * dans une SCÈNE (décor derrière, ombrage en tramage à tons durs), avec une AURA
 * magique et des RUNES flottantes autour du sujet qui visualisent son pouvoir.
 * Scène procédurale 48x36 pixels, dessinée pixel par pixel, par famille :
 *   mouvement = montagnes et chemin ; defense = pierres runiques/temple ;
 *   fusion = cristaux ; piege = forêt sombre ; perturbation = ciel d'orage ;
 *   retour = arche et lune. Aucune ressource externe.
 */
var SCENE_PALETTES = {
  mouvement: { sky: ["#1d3a24", "#2c5a34", "#3f7a44"], ground: "#20301c", decor: "#15251a", accent: "#8fce6e" },
  defense:   { sky: ["#1c2440", "#2b3a66", "#42548c"], ground: "#232032", decor: "#12101f", accent: "#9db4d8" },
  fusion:    { sky: ["#33123d", "#4d1a5c", "#6d2780"], ground: "#2a0e33", decor: "#1c0824", accent: "#e879f9" },
  piege:     { sky: ["#14231a", "#1f3a28", "#2c5238"], ground: "#101c13", decor: "#0a120c", accent: "#facc15" },
  perturbation:{ sky: ["#101d33", "#1a3050", "#274a73"], ground: "#131a26", decor: "#0a0f18", accent: "#7dd3fc" },
  retour:    { sky: ["#241226", "#3a1c40", "#552a5c"], ground: "#1e1020", decor: "#120814", accent: "#fda4af" }
};
var RUNE_MINI = [ // glyphes 3x5
  ["#.#", "#.#", "###", ".#.", "#.#"], ["##.", ".#.", ".#.", ".#.", ".##"],
  ["#.#", "#.#", "#.#", ".#.", ".#."], ["###", "..#", ".##", "..#", "###"]
];
function hash2(x, y, seed) { var h = (x * 374761393 + y * 668265263 + seed * 974634211) >>> 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

function cardNumber(id) { return CARD_IDS.indexOf(id) + 1; }

/* ================= Exports Node (tests) ================= */

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SHAPES: SHAPES, PIECE_NAMES: PIECE_NAMES, pieceName: pieceName, PLAYER_PALETTES: PLAYER_PALETTES,
    deployRows: deployRows, deployPawn: deployPawn, undeployPawn: undeployPawn, autoDeploy: autoDeploy,
    finishDeploy: finishDeploy, passDevice: passDevice, PIECES_PER_PLAYER: PIECES_PER_PLAYER,
    FAMILY_GLYPHS: FAMILY_GLYPHS, FAMILY_COLORS: FAMILY_COLORS, SCENE_PALETTES: SCENE_PALETTES,
    CARDS: CARDS, CARD_IDS: CARD_IDS, CARD_FX: CARD_FX, DECK_RECIPES: DECK_RECIPES,
    PROPERTY_CATALOG: PROPERTY_CATALOG, MUTATION_POOL: MUTATION_POOL,
    HAND_MAX: HAND_MAX, HAND_START: HAND_START,
    createGame: createGame, chooseEssential: chooseEssential, pawnMoves: pawnMoves,
    playerHasAnyMove: playerHasAnyMove, countPawns: countPawns, findPawn: findPawn,
    pawnAt: pawnAt, applyMove: applyMove, playCard: playCard, cardPrecheck: cardPrecheck,
    endTurn: endTurn, skipCard: skipCard, captureProtection: captureProtection,
    addFx: addFx, fxOf: fxOf, addProp: addProp, hasProp: hasProp, isImmobilised: isImmobilised,
    buildDeckFor: buildDeckFor, makeRng: makeRng
  };
}
