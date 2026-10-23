"use strict";
/*
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

/* ================= Sprites pixel art (hérités de la v1) ================= */

var SHAPES = ["cercle", "carre", "triangle", "losange", "hexagone", "etoile"];

var SPRITE_MAPS = {
  cercle: [
    "................", ".....######.....", "...##########...", "..############..",
    ".##############.", ".##############.", ".##############.", ".##############.",
    ".##############.", ".##############.", ".##############.", ".##############.",
    "..############..", "..############..", "...##########...", ".....######....."
  ],
  carre: [
    "................", ".##############.", ".##############.", ".##############.",
    ".##############.", ".##############.", ".##############.", ".##############.",
    ".##############.", ".##############.", ".##############.", ".##############.",
    ".##############.", ".##############.", ".##############.", "................"
  ],
  triangle: [
    "................", ".......##.......", ".......##.......", "......####......",
    "......####......", ".....######.....", ".....######.....", "....########....",
    "....########....", "...##########...", "...##########...", "..############..",
    "..############..", ".##############.", ".##############.", "................"
  ],
  losange: [
    ".......##.......", "......####......", ".....######.....", "....########....",
    "...##########...", "..############..", ".##############.", ".##############.",
    ".##############.", ".##############.", "..############..", "...##########...",
    "....########....", ".....######.....", "......####......", ".......##......."
  ],
  hexagone: [
    "................", "....########....", "..############..", ".##############.",
    ".##############.", ".##############.", ".##############.", ".##############.",
    ".##############.", ".##############.", ".##############.", ".##############.",
    ".##############.", ".##############.", "..############..", "....########...."
  ],
  etoile: [
    ".......##.......", ".......##.......", "......####......", "......####......",
    ".....######.....", ".##############.", "..############..", "...##########...",
    "....########....", "....########....", "...##########...", "...###....###...",
    "..###......###..", "..##........##..", ".###........###.", "................"
  ]
};

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

function pixelArtURL(map, colorFor, width, height) {
  if (typeof document === "undefined") return "";
  var canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (var r = 0; r < map.length; r++)
    for (var c = 0; c < map[r].length; c++) {
      var color = colorFor(map[r][c], r, c, map);
      if (color) { ctx.fillStyle = color; ctx.fillRect(c, r, 1, 1); }
    }
  return canvas.toDataURL();
}

var _spriteCache = {};
function pawnSpriteURL(pawn) {
  var key = pawn.player + "_" + pawn.shape;
  if (_spriteCache[key]) return _spriteCache[key];
  var pal = PLAYER_PALETTES[pawn.player];
  var map = SPRITE_MAPS[pawn.shape];
  var url = pixelArtURL(map, function (ch, r, c, m) {
    if (ch !== "#") return null;
    var edge = !m[r - 1] || m[r - 1][c] !== "#" || !m[r + 1] || m[r + 1][c] !== "#" ||
               m[r][c - 1] !== "#" || m[r][c + 1] !== "#";
    if (edge) return pal.outline;
    if ((r === 7 || r === 8) && (c === 7 || c === 8)) return pal.gem;
    if (r + c <= 9) return pal.light;
    return pal.main;
  }, 16, 16);
  _spriteCache[key] = url;
  return url;
}

var _cardCache = {};
function cardSpriteURL(id) {
  if (_cardCache[id]) return _cardCache[id];
  var def = CARDS[id];
  var map = FAMILY_GLYPHS[def.famille];
  var main = FAMILY_COLORS[def.famille];
  var url = pixelArtURL(map, function (ch, r, c) {
    if (ch === "X") return "#10101c";
    if (ch === ".") return null;
    // variation par carte : la gemme centrale prend la teinte propre à la carte
    if ((r === 5 || r === 6) && (c === 5 || c === 6)) return def.teinte || main;
    return main;
  }, 12, 12);
  _cardCache[id] = url;
  return url;
}

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

function createGame(seed) {
  _pawnSeq = 0;
  var rng = makeRng(seed == null ? 987654321 : seed);
  var board = [];
  for (var r = 0; r < 8; r++) { board.push([]); for (var c = 0; c < 8; c++) board[r].push(null); }
  var idx = 0, rr, cc;
  for (rr = 0; rr < 3; rr++) for (cc = 0; cc < 8; cc++) if ((rr + cc) % 2 === 1) board[rr][cc] = makePawn(2, idx++);
  idx = 0;
  for (rr = 5; rr < 8; rr++) for (cc = 0; cc < 8; cc++) if ((rr + cc) % 2 === 1) board[rr][cc] = makePawn(1, idx++);
  var g = {
    board: board, rngState: null,
    phase: "select1",            // select1 -> handover -> select2 -> move -> card -> over
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
      g.log.push("Un piège runique se déclenche ! Un pion " + pawn.shape + " est immobilisé pour son prochain tour.");
    }
  }
  // Garde de case alliée ?
  for (var j = g.guards.length - 1; j >= 0; j--) {
    var gd = g.guards[j];
    if (gd.r === r && gd.c === c && gd.owner === pawn.player) {
      g.guards.splice(j, 1);
      addFx(pawn, "shield", 99, "untilCapture");
      events.push({ type: "guardTriggered", r: r, c: c, pawnId: pawn.id });
      g.log.push("La garde de case protège un pion " + pawn.shape + " (Bouclier runique).");
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
      g.log.push("Joueur " + g.current + " capture un pion " + victim.shape + ".");
      // Pièce essentielle d'abord (§5.3 étape 6)
      if (victim.essential) {
        g.phase = "card"; // la résolution continue proprement avant la victoire
        return winGame(g, g.current, "la pièce essentielle adverse a été capturée");
      }
      g.graveyard[victim.player].push(victim);
      if (countPawns(g, victim.player) === 0) return winGame(g, g.current, "tous les pions adverses ont été capturés");
    }
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
            g.log.push("Effet prolongé par pacte : un pion " + p.shape + " sera immobilisé à son prochain tour.");
          }
          if (f.kind === "eveille") {
            p.frozenForTurn = g.turnCount[p.player] + 1;
            g.log.push("L'éveil retombe : un pion " + p.shape + " sera immobilisé à son prochain tour.");
          }
          if (f.kind === "pacte" && f.data && f.data.thenFreeze) {
            p.frozenForTurn = g.turnCount[p.player] + 1;
            g.log.push("Le pacte instable se paie : un pion " + p.shape + " sera immobilisé à son prochain tour.");
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
      g.log.push("Fusion ! Un nouveau pion " + merged.shape + " naît (propriétés provisoires : " +
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
      g.log.push("Résurrection ! Un pion " + dead.shape + " revient en jeu.");
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
      g.log.push("Sacrifice : un pion " + sap.shape + " est perdu définitivement ; le Joueur " + me + " pioche 2 cartes.");
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

var _sceneCache = {};
function cardSceneURL(id) {
  if (_sceneCache[id]) return _sceneCache[id];
  if (typeof document === "undefined") return "";
  var def = CARDS[id], fam = def.famille, pal = SCENE_PALETTES[fam];
  var seed = CARD_IDS.indexOf(id) + 7;
  var W = 48, H = 36;
  var canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
  var x, y;
  // Ciel en bandes dures + tramage (damier de bruit, aucun dégradé lissé)
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var band = y < 10 ? pal.sky[0] : (y < 20 ? pal.sky[1] : pal.sky[2]);
    if (y >= 27) band = pal.ground;
    if ((x + y) % 2 === 0 && hash2(x, y, seed) < 0.16) band = pal.decor;
    px(x, y, band);
  }
  // Décor par famille
  if (fam === "defense") { // pierres runiques / piliers de temple
    [4, 40].forEach(function (px0) { for (y = 8; y < 28; y++) for (x = px0; x < px0 + 5; x++) px(x, y, (x + y) % 3 ? "#3c4666" : "#2a3350"); });
  } else if (fam === "mouvement") { // montagnes + chemin
    for (x = 0; x < W; x++) { var mh = 8 + Math.round(5 * Math.abs(Math.sin(x / 6 + seed))); for (y = 0; y < mh; y++) px(x, 26 - y, y > mh - 2 ? "#d8e6c8" : "#33502f"); }
    for (y = 28; y < H; y++) for (x = 20; x < 28; x++) if (Math.abs(x - 24) < (y - 26) / 2) px(x, y, "#8a7a52");
  } else if (fam === "fusion") { // cristaux
    [[6, 26], [38, 24], [12, 28]].forEach(function (cp) { for (var i = 0; i < 8; i++) { px(cp[0] + (i % 2), cp[1] - i, "#e879f9"); px(cp[0] + 1, cp[1] - i, "#a21caf"); } });
  } else if (fam === "piege") { // forêt sombre : troncs
    [3, 20, 44].forEach(function (tx) { for (y = 4; y < 28; y++) { px(tx, y, "#0d1a10"); px(tx + 1, y, "#12240f"); } });
  } else if (fam === "perturbation") { // éclairs
    var lx = 6 + (seed % 8); for (y = 2; y < 14; y++) { px(lx + Math.floor(y / 3), y, "#fef08a"); px(lx + Math.floor(y / 3) + 1, y, "#facc15"); }
  } else if (fam === "retour") { // lune + arche
    for (y = 3; y < 10; y++) for (x = 38; x < 45; x++) if ((x - 41) * (x - 41) + (y - 6) * (y - 6) < 12) px(x, y, "#f5f0dc");
    for (x = 14; x < 34; x++) px(x, 10, "#4a2c50"); for (y = 10; y < 28; y++) { px(14, y, "#4a2c50"); px(33, y, "#4a2c50"); }
  }
  // Aura magique : deux anneaux pixel en escalier autour du sujet, teinte de la carte
  var cx = 24, cy = 17;
  for (var a = 0; a < 64; a++) {
    var ang = a / 64 * Math.PI * 2;
    [11, 14].forEach(function (rad, ri) {
      if ((a + ri * 3) % 3 === 0) return; // anneau pointillé, rétro
      var ax = Math.round(cx + Math.cos(ang) * rad), ay = Math.round(cy + Math.sin(ang) * rad * 0.78);
      if (ax >= 0 && ax < W && ay >= 0 && ay < H) px(ax, ay, ri === 0 ? def.teinte : pal.accent);
    });
  }
  // Runes flottantes autour du sujet
  var runeSpots = [[7, 7], [38, 6], [8, 24], [37, 25]];
  runeSpots.forEach(function (sp, ri) {
    var glyph = RUNE_MINI[(seed + ri) % RUNE_MINI.length];
    for (var ry = 0; ry < 5; ry++) for (var rx = 0; rx < 3; rx++)
      if (glyph[ry][rx] === "#") px(sp[0] + rx, sp[1] + ry, ri % 2 ? def.teinte : "#f5c542");
  });
  // Sujet : glyphe de famille agrandi x2, centré, contour sombre
  var map = FAMILY_GLYPHS[fam], main = FAMILY_COLORS[fam];
  for (var sr = 0; sr < 12; sr++) for (var sc = 0; sc < 12; sc++) {
    var ch = map[sr][sc]; if (ch === ".") continue;
    var col = ch === "X" ? "#10101c" : ((sr === 5 || sr === 6) && (sc === 5 || sc === 6) ? def.teinte : main);
    for (var dy2 = 0; dy2 < 2; dy2++) for (var dx2 = 0; dx2 < 2; dx2++) px(12 + sc * 2 + dx2, 5 + sr * 2 + dy2, col);
  }
  var url = canvas.toDataURL();
  _sceneCache[id] = url;
  return url;
}
function cardNumber(id) { return CARD_IDS.indexOf(id) + 1; }

/* ================= Sons rétro 8-bit (Web Audio, aucun fichier) ================= */

var Sound = {
  ctx: null, enabled: true,
  ensure: function () {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  tone: function (freq, dur, delay, type, vol) {
    if (!this.enabled) return;
    var ctx = this.ensure(); if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || "square"; osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },
  play: function (name) {
    if (!this.enabled) return;
    switch (name) {
      case "move": this.tone(392, 0.07, 0); this.tone(523, 0.07, 0.07); break;
      case "capture": [660, 550, 440, 880].forEach(function (f, i) { Sound.tone(f, 0.07, i * 0.06); }); break;
      case "draw": this.tone(784, 0.05, 0, "square", 0.04); this.tone(988, 0.06, 0.06, "square", 0.04); break;
      case "card": [523, 659, 784].forEach(function (f, i) { Sound.tone(f, 0.06, i * 0.05, "triangle", 0.06); }); break;
      case "shield": this.tone(262, 0.1, 0, "square", 0.05); this.tone(392, 0.14, 0.09, "square", 0.05); break;
      case "freeze": [1200, 900, 650].forEach(function (f, i) { Sound.tone(f, 0.08, i * 0.07, "triangle", 0.05); }); break;
      case "fusion": [330, 415, 494, 659, 830].forEach(function (f, i) { Sound.tone(f, 0.08, i * 0.06, "square", 0.05); }); break;
      case "resurrect": [392, 523, 659, 784, 1046].forEach(function (f, i) { Sound.tone(f, 0.1, i * 0.08, "triangle", 0.06); }); break;
      case "trap": this.tone(196, 0.12, 0, "sawtooth", 0.05); this.tone(147, 0.16, 0.1, "sawtooth", 0.05); break;
      case "victory": [523, 659, 784, 1046, 784, 1046].forEach(function (f, i) { Sound.tone(f, 0.13, i * 0.11, "square", 0.06); }); break;
      case "defeat": [392, 370, 349, 311].forEach(function (f, i) { Sound.tone(f, 0.16, i * 0.13, "square", 0.05); }); break;
      case "invalid": this.tone(140, 0.14, 0, "sawtooth", 0.06); break;
      case "turn": this.tone(587, 0.06, 0, "square", 0.04); break;
      case "select": this.tone(880, 0.04, 0, "square", 0.035); break;
    }
  },
  forEvent: function (ev) {
    if (!ev) return;
    if (ev.type === "capture") this.play("capture");
    else if (ev.type === "move") this.play("move");
    else if (ev.type === "draw") this.play("draw");
    else if (ev.type === "turn") this.play("turn");
    else if (ev.type === "victory") this.play("victory");
  },
  forCard: function (id) {
    if (id === "bouclier_runique" || id === "dernier_rempart" || id === "ancrage") this.play("shield");
    else if (id === "gel") this.play("freeze");
    else if (id === "fusion") this.play("fusion");
    else if (id === "resurrection") this.play("resurrect");
    else if (id === "piege_runique") this.play("trap");
    else this.play("card");
  }
};

/* ================= Exports Node (tests) ================= */

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SHAPES: SHAPES, SPRITE_MAPS: SPRITE_MAPS, PLAYER_PALETTES: PLAYER_PALETTES,
    FAMILY_GLYPHS: FAMILY_GLYPHS, FAMILY_COLORS: FAMILY_COLORS, SCENE_PALETTES: SCENE_PALETTES,
    CARDS: CARDS, CARD_IDS: CARD_IDS, CARD_FX: CARD_FX, DECK_RECIPES: DECK_RECIPES,
    PROPERTY_CATALOG: PROPERTY_CATALOG, MUTATION_POOL: MUTATION_POOL,
    HAND_MAX: HAND_MAX, HAND_START: HAND_START,
    createGame: createGame, chooseEssential: chooseEssential, pawnMoves: pawnMoves,
    playerHasAnyMove: playerHasAnyMove, countPawns: countPawns, findPawn: findPawn,
    pawnAt: pawnAt, applyMove: applyMove, playCard: playCard, cardPrecheck: cardPrecheck,
    endTurn: endTurn, skipCard: skipCard, captureProtection: captureProtection,
    addFx: addFx, fxOf: fxOf, addProp: addProp, hasProp: hasProp, isImmobilised: isImmobilised,
    buildDeckFor: buildDeckFor, makeRng: makeRng, Sound: Sound
  };
}

/* ================= Interface navigateur ================= */

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var boardEl = document.getElementById("board");
    var turnEl = document.getElementById("turn");
    var scoreEl = document.getElementById("score");
    var phaseEl = document.getElementById("phase-hint");
    var handEl = document.getElementById("hand");
    var oppHandEl = document.getElementById("opp-hand");
    var logEl = document.getElementById("log");
    var detailEl = document.getElementById("card-detail");
    var overlayEl = document.getElementById("overlay");
    var vicEl = document.getElementById("victory");

    var g = createGame(Date.now() % 100000);
    var ui = {
      selected: null, moves: [],
      pendingCard: null,      // index de main en cours de visée
      pendingTargets: [],
      pendingChoices: {},
      lastFromTo: null,       // pour l'animation de déplacement
      inspectId: null
    };

    function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstChild; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

    /* ---- Sons : initialisation paresseuse au premier geste ---- */
    document.addEventListener("pointerdown", function () { Sound.ensure(); }, { once: true });
    var soundBtn = document.getElementById("sound-toggle");
    function refreshSoundBtn() { soundBtn.textContent = Sound.enabled ? "Son : OUI" : "Son : NON"; }
    soundBtn.addEventListener("click", function () {
      Sound.enabled = !Sound.enabled; Sound.ensure(); refreshSoundBtn();
      if (Sound.enabled) Sound.play("select");
    });
    refreshSoundBtn();

    /* ---- Effets visuels par carte (CARD_FX) ---- */
    function spawnFx(r, c, fx, big) {
      var layer = document.getElementById("fx");
      if (!layer || !fx) return;
      var n = big ? 18 : 12, i, sq, ang;
      for (i = 0; i < n; i++) {
        sq = document.createElement("span");
        sq.className = "particle pat-" + fx.pattern;
        sq.style.left = ((c + 0.5) * 12.5) + "%";
        sq.style.top = ((r + 0.5) * 12.5) + "%";
        sq.style.background = fx.colors[i % fx.colors.length];
        ang = (i / n) * Math.PI * 2;
        var dx = 0, dy = 0;
        if (fx.pattern === "ring" || fx.pattern === "rune") { dx = Math.round(Math.cos(ang) * 26); dy = Math.round(Math.sin(ang) * 26); }
        else if (fx.pattern === "snow") { dx = ((i % 5) - 2) * 9; dy = 20 + (i % 4) * 8; }
        else if (fx.pattern === "rise") { dx = ((i % 5) - 2) * 8; dy = -18 - (i % 4) * 9; }
        else if (fx.pattern === "converge") { dx = -Math.round(Math.cos(ang) * 30); dy = -Math.round(Math.sin(ang) * 30); sq.style.transform = "translate(" + (-dx) + "px," + (-dy) + "px)"; }
        else { dx = ((i % 5) - 2) * 13; dy = ((Math.floor(i / 5) % 3) - 1) * 15 - 6; }
        sq.style.setProperty("--dx", dx + "px");
        sq.style.setProperty("--dy", dy + "px");
        layer.appendChild(sq);
        (function (node) { setTimeout(function () { node.remove(); }, 750); })(sq);
      }
      var cell = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
      if (cell) { cell.classList.add("card-flash"); setTimeout(function () { cell.classList.remove("card-flash"); }, 500); }
    }

    function badges(pawn) {
      var chips = [];
      if (fxOf(pawn, "shield")) chips.push('<span class="chip gold" title="Bouclier runique">B</span>');
      if (fxOf(pawn, "rempart")) chips.push('<span class="chip gold" title="Dernier rempart">R</span>');
      if (fxOf(pawn, "pariProtect")) chips.push('<span class="chip gold" title="Protégé (Dernier pari)">P</span>');
      if (captureProtection(g, pawn) === "aegis") chips.push('<span class="chip gold" title="Égide">É</span>');
      if (hasProp(pawn, "ailes")) chips.push('<span class="chip" title="Ailes">A</span>');
      if (hasProp(pawn, "entrave")) chips.push('<span class="chip red" title="Entrave">E</span>');
      if (fxOf(pawn, "anchored")) chips.push('<span class="chip" title="Ancré">⚓</span>');
      if (fxOf(pawn, "veil")) chips.push('<span class="chip gray" title="Voilé">V</span>');
      if (fxOf(pawn, "silence")) chips.push('<span class="chip gray" title="Silence">S</span>');
      if (fxOf(pawn, "link")) chips.push('<span class="chip blue" title="Lié">L</span>');
      if (fxOf(pawn, "eveille")) chips.push('<span class="chip gold" title="Éveillé">Év</span>');
      if (fxOf(pawn, "spectral")) chips.push('<span class="chip" title="Pas spectral prêt">~</span>');
      if (fxOf(pawn, "passage")) chips.push('<span class="chip" title="Marque de passage">M</span>');
      if (isImmobilised(g, pawn)) chips.push('<span class="chip blue" title="Immobilisé ce tour">G</span>');
      if (pawn.double) chips.push('<span class="chip gray" title="Double affaibli">D</span>');
      return chips.length ? '<span class="badges">' + chips.join("") + "</span>" : "";
    }

    function render() {
      renderBoard(); renderStatus(); renderHands(); renderDetail(); renderOverlay(); renderLog();
    }

    function renderBoard() {
      boardEl.innerHTML = "";
      var targets = {};
      ui.moves.forEach(function (m) { targets[m.toR + "," + m.toC] = m; });
      var showTrapsFor = g.current; // les pièges ne sont visibles que pour leur propriétaire… pendant SON tour
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell " + ((r + c) % 2 === 1 ? "dark" : "light");
        cell.dataset.r = r; cell.dataset.c = c;
        var pawn = g.board[r][c];
        var html = "";
        g.guards.forEach(function (gd) { if (gd.r === r && gd.c === c) html += '<span class="marker guard" title="Garde de case">✦</span>'; });
        g.traps.forEach(function (t) { if (t.r === r && t.c === c && t.owner === showTrapsFor && g.phase !== "over") html += '<span class="marker trap" title="Ton piège runique">✷</span>'; });
        g.decoys.forEach(function (d) { if (d.r === r && d.c === c) html += '<img class="pawn-img decoy" src="' + pawnSpriteURL({ player: d.owner, shape: d.shape }) + '" alt="">'; });
        if (pawn) {
          html += '<span class="pawn-wrap"><img class="pawn-img" src="' + pawnSpriteURL(pawn) + '" alt=""></span>' + badges(pawn);
          Object.keys(g.suspicion).forEach(function (pl) {
            if (g.suspicion[pl] === pawn.id) html += '<span class="marker suspicion" title="Marque de soupçon">?</span>';
          });
          cell.setAttribute("aria-label", "Pion joueur " + pawn.player + " " + pawn.shape);
        }
        cell.innerHTML = html;
        if (ui.selected && ui.selected.r === r && ui.selected.c === c) cell.classList.add("selected");
        if (targets[r + "," + c]) cell.classList.add(targets[r + "," + c].capture ? "target-capture" : "target");
        if (ui.pendingTargets.some(function (t) { return t.r === r && t.c === c; })) cell.classList.add("card-target");
        cell.addEventListener("click", onCellClick);
        boardEl.appendChild(cell);
      }
      // Animation de déplacement : saut en escalier (steps) depuis la case d'origine
      if (ui.lastFromTo) {
        var dest = boardEl.querySelector('[data-r="' + ui.lastFromTo.to[0] + '"][data-c="' + ui.lastFromTo.to[1] + '"] .pawn-wrap');
        if (dest) {
          dest.style.setProperty("--fx0", (ui.lastFromTo.from[1] - ui.lastFromTo.to[1]) * 100 + "%");
          dest.style.setProperty("--fy0", (ui.lastFromTo.from[0] - ui.lastFromTo.to[0]) * 100 + "%");
          dest.classList.add("hop");
        }
        ui.lastFromTo = null;
      }
    }

    function renderStatus() {
      var who = g.current === 1 ? "Joueur 1 (violet)" : "Joueur 2 (orange)";
      if (g.phase === "over") turnEl.textContent = "Partie terminée — le Joueur " + g.winner + " gagne !";
      else if (g.phase.indexOf("select") === 0) turnEl.textContent = "Choix secret de la pièce essentielle";
      else if (g.phase === "handover") turnEl.textContent = "Passation de l'appareil…";
      else turnEl.textContent = "Tour du " + who;
      turnEl.className = "turn p" + g.current;
      phaseEl.textContent =
        g.phase === "move" ? "Étape 1/2 — effectue ton déplacement principal (8 directions, capture par saut non obligatoire)." :
        g.phase === "card" ? "Étape 2/2 — tu peux jouer 1 carte, ou terminer ton tour." :
        g.phase.indexOf("select") === 0 ? "Clique un de tes pions : ce sera ta pièce essentielle secrète." : "";
      scoreEl.textContent = "Captures — J1 : " + g.captured[1] + " · J2 : " + g.captured[2] +
        " · Pions : " + countPawns(g, 1) + " contre " + countPawns(g, 2) +
        " · Pioche/Défausse J" + g.current + " : " + g.decks[g.current].length + "/" + g.discards[g.current].length;
      vicEl.style.display = g.phase === "over" ? "block" : "none";
      if (g.phase === "over") vicEl.textContent = "VICTOIRE DU JOUEUR " + g.winner + " — " + esc(g.winReason || "") + ".";
      document.getElementById("end-turn").style.display = g.phase === "card" ? "inline-block" : "none";
    }

    function cardHTML(id, mini) {
      var def = CARDS[id];
      return '<span class="tc-head"><span class="tc-badge">' + cardNumber(id) + '</span><span class="tc-name">' + esc(def.nom) + "</span></span>" +
        '<img class="tc-scene" src="' + cardSceneURL(id) + '" alt="">' +
        '<span class="tc-text">' + esc(def.description) + "</span>" +
        '<span class="tc-foot"><img class="tc-fam-icon" src="' + cardSpriteURL(id) + '" alt=""> ' +
        esc(def.famille) + (def.bannie ? " · BANNIE après usage" : "") + (def.unique ? " · UNIQUE" : "") + "</span>";
    }

    function renderHands() {
      // Main adverse : dos de cartes + nombre seulement (secret, §6.1)
      var opp = g.current === 1 ? 2 : 1;
      oppHandEl.innerHTML = "<span>Main du Joueur " + opp + " (cachée) :</span> " +
        g.hands[opp].map(function () { return '<span class="card-back"></span>'; }).join("");
      handEl.innerHTML = "";
      if (g.phase !== "move" && g.phase !== "card") { handEl.innerHTML = '<p class="note">Les mains apparaîtront quand la partie commencera.</p>'; return; }
      g.hands[g.current].forEach(function (id, i) {
        var def = CARDS[id];
        var card = document.createElement("button");
        card.type = "button";
        var unplayable = g.phase !== "card" || g.cardPlayedThisTurn || cardPrecheck(g, id);
        card.className = "tc" + (ui.pendingCard === i ? " tc-selected" : "") + (unplayable ? " tc-off" : "");
        card.innerHTML = cardHTML(id, true);
        card.title = def.nom + " — " + def.description;
        card.addEventListener("click", function () { onCardClick(i); });
        handEl.appendChild(card);
      });
      if (!g.hands[g.current].length) handEl.innerHTML = '<p class="note">Main vide.</p>';
    }

    function targetsNeeded(id) {
      // Correction orchestrateur 2026-10-23 : Dernier pari, mode « déplacement de
      // 2 cases », exige 2 cibles (le pion PUIS la case d'arrivée, moteur L1066+) —
      // avec 1 seule cible ce mode était injouable dans l'interface.
      if (id === "dernier_pari") return ui.pendingChoices.pariMode === "move2" ? 2 : 1;
      var t = CARDS[id].cible;
      if (t === "ownPair" || t === "enemyPair" || t === "ownPawnCell" || t === "graveyardCell") return t === "graveyardCell" ? 1 : 2;
      if (t === "none" || t === "noneChoice") return 0;
      return 1;
    }

    function onCardClick(i) {
      if (g.phase !== "card") { Sound.play("invalid"); logUi("Les cartes se jouent APRÈS le déplacement principal."); return; }
      if (g.cardPlayedThisTurn) { Sound.play("invalid"); logUi("Une seule carte par tour."); return; }
      var id = g.hands[g.current][i];
      var pre = cardPrecheck(g, id);
      if (pre) { Sound.play("invalid"); logUi(pre); return; }
      ui.pendingCard = ui.pendingCard === i ? null : i;
      ui.pendingTargets = []; ui.pendingChoices = {};
      Sound.play("select");
      render();
    }

    function renderDetail() {
      if (ui.pendingCard === null || g.phase !== "card") {
        detailEl.innerHTML = g.phase === "card" && !g.cardPlayedThisTurn
          ? '<p class="note">Clique une carte de ta main pour voir ses détails (cible, conditions, coût, risque, durée) avant de la jouer.</p>' : "";
        return;
      }
      var id = g.hands[g.current][ui.pendingCard];
      var def = CARDS[id];
      var h = '<div class="tc tc-big">' + cardHTML(id) + "</div><div class='detail-fields'>" +
        "<p><strong>Cible :</strong> " + esc(def.conditions) + "</p>" +
        "<p><strong>Effet :</strong> " + esc(def.description) + "</p>" +
        "<p><strong>Coût :</strong> " + esc(def.cout) + "</p>" +
        "<p><strong>Risque :</strong> " + esc(def.risque) + "</p>" +
        "<p><strong>Durée :</strong> " + esc(def.duree) + "</p>";
      // Choix spéciaux
      if (id === "mutation") {
        h += "<p><strong>Propriété (choisis) :</strong> " + MUTATION_POOL.map(function (pid) {
          return '<button type="button" class="choice' + (ui.pendingChoices.propId === pid ? " choice-on" : "") + '" data-choice="prop:' + pid + '">' +
            PROPERTY_CATALOG[pid].nom + " — " + esc(PROPERTY_CATALOG[pid].description) + "</button>";
        }).join(" ") + "</p>";
      }
      if (id === "dernier_pari") {
        h += "<p><strong>Mode :</strong> " +
          '<button type="button" class="choice' + (ui.pendingChoices.pariMode === "move2" ? " choice-on" : "") + '" data-choice="pari:move2">Déplacer de 2 cases</button> ' +
          '<button type="button" class="choice' + (ui.pendingChoices.pariMode === "protect" ? " choice-on" : "") + '" data-choice="pari:protect">Protéger 1 tour</button></p>';
      }
      if (id === "interference") {
        h += "<p><strong>Carte à révéler :</strong> " + g.hands[g.current].map(function (cid, ix) {
          return '<button type="button" class="choice' + (ui.pendingChoices.revealIndex === ix ? " choice-on" : "") + '" data-choice="reveal:' + ix + '">' + esc(CARDS[cid].nom) + "</button>";
        }).join(" ") + "</p>" +
          "<p><strong>Adversaire — passe-lui l'appareil : quelle carte défausses-tu ?</strong> " + g.hands[g.current === 1 ? 2 : 1].map(function (_, ix) {
          return '<button type="button" class="choice' + (ui.pendingChoices.oppDiscardIndex === ix ? " choice-on" : "") + '" data-choice="oppdisc:' + ix + '">Carte n°' + (ix + 1) + " de ta main</button>";
        }).join(" ") + "</p>";
      }
      if (id === "resurrection") {
        h += "<p><strong>Pion à ressusciter :</strong> " + g.graveyard[g.current].map(function (dp, ix) {
          return '<button type="button" class="choice' + (ui.pendingChoices.graveyardIndex === ix ? " choice-on" : "") + '" data-choice="grave:' + ix + '">Pion ' + esc(dp.shape) + "</button>";
        }).join(" ") + "</p>";
      }
      if (id === "dernier_rempart") {
        h += "<p class='note'>Si ta cible est ta pièce essentielle, choisis aussi la carte à sacrifier :</p><p>" +
          g.hands[g.current].map(function (cid, ix) {
            if (ix === ui.pendingCard) return "";
            return '<button type="button" class="choice' + (ui.pendingChoices.discardHandIndex === ix ? " choice-on" : "") + '" data-choice="sac:' + ix + '">' + esc(CARDS[cid].nom) + "</button>";
          }).join(" ") + "</p>";
      }
      var need = targetsNeeded(id);
      h += "<p><strong>Cibles choisies :</strong> " + ui.pendingTargets.length + " / " + need +
        (need ? " — clique les cases/pions sur le plateau." : " — aucun clic de cible requis.") + "</p>" +
        '<p><button type="button" id="confirm-card">CONFIRMER LA CARTE</button> ' +
        '<button type="button" id="cancel-card">Annuler</button></p></div>';
      detailEl.innerHTML = h;
      detailEl.querySelectorAll(".choice").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var parts = btn.dataset.choice.split(":");
          var k = parts[0], v = parts[1];
          if (k === "prop") ui.pendingChoices.propId = v;
          if (k === "pari") ui.pendingChoices.pariMode = v;
          if (k === "reveal") ui.pendingChoices.revealIndex = parseInt(v, 10);
          if (k === "oppdisc") ui.pendingChoices.oppDiscardIndex = parseInt(v, 10);
          if (k === "grave") ui.pendingChoices.graveyardIndex = parseInt(v, 10);
          if (k === "sac") ui.pendingChoices.discardHandIndex = parseInt(v, 10);
          Sound.play("select");
          render();
        });
      });
      document.getElementById("confirm-card").addEventListener("click", confirmCard);
      document.getElementById("cancel-card").addEventListener("click", function () {
        ui.pendingCard = null; ui.pendingTargets = []; render();
      });
    }

    function confirmCard() {
      var id = g.hands[g.current][ui.pendingCard];
      var res = playCard(g, ui.pendingCard, ui.pendingTargets, ui.pendingChoices);
      if (!res.ok) { Sound.play("invalid"); logUi(res.error); render(); return; }
      Sound.forCard(id);
      res.events.forEach(function (ev) {
        if (ev.type === "cardFx" && CARD_FX[ev.card]) ev.cells.forEach(function (cellPos) { spawnFx(cellPos[0], cellPos[1], CARD_FX[ev.card], true); });
        if (ev.type === "trapTriggered") spawnFx(ev.r, ev.c, CARD_FX.piege_runique, true);
        if (ev.type === "guardTriggered") spawnFx(ev.r, ev.c, CARD_FX.garde_case, false);
      });
      if (g.lastEvent && g.lastEvent.type === "victory") Sound.play("victory");
      ui.pendingCard = null; ui.pendingTargets = []; ui.pendingChoices = {};
      render();
    }

    function logUi(msg) { g.log.push(msg); renderLog(); }
    function renderLog() {
      logEl.innerHTML = "";
      g.log.slice(-8).reverse().forEach(function (m) {
        var li = document.createElement("li"); li.textContent = m; logEl.appendChild(li);
      });
    }

    function renderOverlay() {
      if (g.phase === "handover") {
        overlayEl.style.display = "flex";
        overlayEl.innerHTML = '<div class="overlay-box"><h2>Passe l\'appareil au Joueur 2</h2>' +
          "<p>Le Joueur 1 a choisi sa pièce essentielle en secret. Joueur 2, à toi de choisir la tienne — l'autre joueur ne regarde pas !</p>" +
          '<button type="button" id="handover-ok">Je suis le Joueur 2, je choisis ma pièce</button></div>';
        document.getElementById("handover-ok").addEventListener("click", function () {
          g.phase = "select2"; g.current = 2; Sound.play("turn"); render();
        });
        return;
      }
      overlayEl.style.display = "none";
      overlayEl.innerHTML = "";
    }

    function onCellClick(ev) {
      var r = parseInt(ev.currentTarget.dataset.r, 10);
      var c = parseInt(ev.currentTarget.dataset.c, 10);
      var pawn = g.board[r][c];
      Sound.ensure();

      // Phases de sélection secrète
      if (g.phase === "select1" || g.phase === "select2") {
        var pl = g.phase === "select1" ? 1 : 2;
        if (!pawn || pawn.player !== pl) { Sound.play("invalid"); logUi("Joueur " + pl + " : clique un de TES pions de départ."); return; }
        var res = chooseEssential(g, pl, pawn.id);
        if (!res.ok) { Sound.play("invalid"); logUi(res.error); return; }
        Sound.play("shield");
        logUi("Pièce essentielle du Joueur " + pl + " choisie en secret.");
        if (pl === 2) logUi("La partie commence ! Joueur 1, à toi.");
        render();
        return;
      }
      if (g.phase !== "move" && g.phase !== "card") return;

      // Visée d'une carte
      if (ui.pendingCard !== null) {
        ui.pendingTargets.push({ r: r, c: c });
        var need = targetsNeeded(g.hands[g.current][ui.pendingCard]);
        if (ui.pendingTargets.length > need) ui.pendingTargets.shift();
        Sound.play("select");
        render();
        return;
      }

      // Inspection d'un pion adverse (propriétés, sauf Voile)
      if (pawn && pawn.player !== g.current && g.phase === "move" && !ui.selected) {
        var veiled = !!fxOf(pawn, "veil");
        if (veiled) logUi("Pion " + pawn.shape + " adverse : ses propriétés sont VOILÉES.");
        else if (pawn.props.length) logUi("Pion " + pawn.shape + " adverse — propriétés : " + pawn.props.map(function (p) { return PROPERTY_CATALOG[p.id].nom + (p.silenced ? " (réduite au silence)" : ""); }).join(", ") + ".");
        else logUi("Pion " + pawn.shape + " adverse : aucune propriété.");
        ui.inspectId = pawn.id;
        return;
      }

      if (g.phase !== "move") return;

      // Clic sur une arrivée légale ?
      var move = null;
      ui.moves.forEach(function (m) { if (m.toR === r && m.toC === c) move = m; });
      if (move && ui.selected) {
        var from = [ui.selected.r, ui.selected.c];
        var res2 = applyMove(g, from[0], from[1], move);
        if (!res2.ok) { Sound.play("invalid"); logUi(res2.error); return; }
        ui.lastFromTo = { from: from, to: [move.toR, move.toC] };
        Sound.forEvent(g.lastEvent);
        (res2.events || []).forEach(function (ev2) {
          if (ev2.type === "trapTriggered") { Sound.play("trap"); spawnFx(ev2.r, ev2.c, CARD_FX.piege_runique, true); }
          if (ev2.type === "guardTriggered") spawnFx(ev2.r, ev2.c, CARD_FX.garde_case, false);
          if (ev2.type === "decoyVanish") spawnFx(ev2.r, ev2.c, CARD_FX.leurre, false);
        });
        if (g.phase === "over") Sound.play("victory");
        ui.selected = null; ui.moves = [];
        render();
        return;
      }

      // Sélection d'un pion
      if (pawn && pawn.player === g.current) {
        if (isImmobilised(g, pawn)) { Sound.play("invalid"); logUi("Ce pion est immobilisé pour ce tour."); return; }
        ui.selected = { r: r, c: c };
        ui.moves = pawnMoves(g, r, c);
        if (!ui.moves.length) logUi("Ce pion n'a aucun coup possible.");
        Sound.play("select");
        render();
        return;
      }
      ui.selected = null; ui.moves = [];
      render();
    }

    document.getElementById("end-turn").addEventListener("click", function () {
      var res = endTurn(g);
      if (!res.ok) { Sound.play("invalid"); logUi(res.error); return; }
      if (g.lastEvent) Sound.forEvent(g.lastEvent);
      ui.selected = null; ui.moves = []; ui.pendingCard = null; ui.pendingTargets = [];
      render();
    });
    document.getElementById("new-game").addEventListener("click", function () {
      g = createGame(Date.now() % 100000);
      ui = { selected: null, moves: [], pendingCard: null, pendingTargets: [], pendingChoices: {}, lastFromTo: null, inspectId: null };
      Sound.play("turn");
      render();
    });

    /* Révélation privée : maintenir le bouton pour voir SA pièce essentielle et la Sonde.
       Avertissement affiché : sur écran partagé, l'adversaire ne doit pas regarder. */
    var revealBtn = document.getElementById("reveal");
    function showReveal() {
      var ess = null;
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var p = g.board[r][c];
        if (p && p.player === g.current && p.essential) ess = [r, c];
      }
      var txt = ess ? ("Ta pièce essentielle est en ligne " + (ess[0] + 1) + ", colonne " + (ess[1] + 1) + " (forme " + g.board[ess[0]][ess[1]].shape + ").") : "Aucune pièce essentielle trouvée.";
      if (g.suspicion[g.current]) txt += " Ta marque de soupçon est posée sur un pion non essentiel.";
      var si = g.sondeInfo[g.current];
      if (si) txt += " Sonde : la pièce essentielle adverse est dans la moitié " + si.half + " du plateau.";
      document.getElementById("reveal-text").textContent = txt;
    }
    revealBtn.addEventListener("pointerdown", showReveal);
    revealBtn.addEventListener("pointerup", function () { document.getElementById("reveal-text").textContent = ""; });
    revealBtn.addEventListener("pointerleave", function () { document.getElementById("reveal-text").textContent = ""; });

    render();
  });
}
