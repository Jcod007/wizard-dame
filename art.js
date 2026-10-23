"use strict";
/*
 * Wizard Dame — art.js : RESSOURCES PIXEL ART (section 12 du document d'Ekoue).
 * Données pures + fonctions pures qui renvoient des grilles de couleurs :
 * aucune référence DOM ni Phaser, chargeable sous Node (tests/art-check.js).
 * Le rendu les pose ensuite pixel par pixel : phaser-main.js (plateau) et
 * ui-dom.js (cartes, interface). Aucune image externe.
 *
 * Contenu :
 *   - ART_COLORS / CARD_SUBJECTS : 30 sujets originaux 16x16, un par carte (G1) ;
 *   - PAWN_PALETTES : rampes à 5 tons par camp (contour, ombre, base, lumière, gemme) ;
 *   - boardTile() / boardFrame() : textures rétro du plateau et du cadre ;
 *   - PIXEL_FONT : police 3x5 pour les coordonnées et les puces d'état ;
 *   - UI_SPRITES : chapeau de sorcier, couronne, icônes de compteurs, dos de carte…
 *   - outlinedPixels() : contour sombre automatique d'un sprite.
 */

var ART_INK = "#10101c";

/* Clés de couleur des sujets de cartes. 1/2/3 = teinte propre à la carte
   (base / ombre / lumière), calculées à partir de CARDS[id].teinte. */
var ART_COLORS = {
  w: "#f3efff", y: "#f5c542", Y: "#b7791f", r: "#ef4444", R: "#991b1b",
  b: "#7dd3fc", B: "#2563eb", s: "#cbd5e1", S: "#64748b", k: "#2a2340",
  n: "#8a5a2b", N: "#5a3618", g: "#4ade80", G: "#166534", p: "#a78bfa",
  c: "#e8dcc0", C: "#b9a57c"
};

/* Rampes de teinte en tons durs (aucun dégradé) : assombrir / éclaircir. */
function shadeHex(hex, f) {
  var n = parseInt(hex.slice(1), 16);
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  function ch(v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }
  return "#" + [ch(r), ch(g), ch(b)].map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("");
}

/* 30 sujets 16x16 dessinés à la main (une case = un pixel). Le contour
   sombre est ajouté automatiquement (outlinedPixels), d'où la marge d'1 px. */
var CARD_SUBJECTS = {
  pas_spectral: [ // fantôme filant, traînées de vitesse
    "................", "......1111......", "....13333111....", "...1333311112...",
    "...1331111112...", ".w.13kk11kk12...", "...13kk11kk12...", ".ww1311111112...",
    "...1311kkk112...", ".w.1311111112...", "...1111111122...", ".ww1111111122...",
    "...1111111122...", "...112.112.12...", "...12...12..2...", "................"],
  echange: [ // deux flèches qui se croisent
    "................", "..........1.....", "..........11....", "..33333333111...",
    "..111111111111..", "..22222222111...", "..........11....", "..........1.....",
    ".....s..........", "....ss..........", "...sssssssssss..", "..swwwwwwwwwww..",
    "...sssSSSSSSSS..", "....ss..........", ".....s..........", "................"],
  repoussement: [ // flèche qui frappe un pion
    "................", "................", "................", ".....1.....sss..",
    ".....11...swwss.", ".3333111.wswsss.", ".11111111wsssSs.", ".2222111.wssSSs.",
    ".....11...sSSSs.", ".....1.....SSS..", "................", "...w.w.w..nnnnn.",
    "..........NNNNN.", "................", "................", "................"],
  pas_de_cote: [ // botte et pas en diagonale
    "................", ".........11111..", "...........111..", "..........11.1..",
    ".........11..1..", "........11...1..", ".......11.......", "..nnnn..........",
    "..nNnn..........", "..nnnn..........", "..nynn..........", "..nnnn..........",
    "..nnnnnnn.......", "..nnnnnnnn......", "..NNNNNNNN......", "................"],
  marque_passage: [ // deux empreintes lumineuses
    "................", ".........1.11...", "....w...........", ".........3311...",
    ".........3111...", "..........111...", "..........111...", "..1.11...1112...",
    "..........22....", "..3311..........", "..3111..........", "...111..........",
    "...111......w...", "..1112..........", "...22...........", "................"],
  bouclier_runique: [ // bouclier frappé d'une rune
    "................", "..333333333331..", "..3pppppppppp2..", "..3pppppppppp2..",
    "..3ppwppppwpp2..", "..3pppwwwwppp2..", "..3ppppwwpppp2..", "..3ppppwwpppp2..",
    "..3ppppwwpppp2..", "..3ppppwwpppp2..", "...3pppwwppp2...", "....3pppppp2....",
    ".....3pppp2.....", "......2222......", ".......22.......", "................"],
  ancrage: [ // ancre
    "................", ".......33.......", "......3..1......", ".......11.......",
    "....33111111....", ".......11.......", ".......12.......", ".......12.......",
    ".......12.......", ".......12.......", ".1.....12.....1.", ".11....12....11.",
    "..111..12..111..", "...2211112222...", ".....222222.....", "................"],
  garde_case: [ // bannière plantée sur une dalle
    "................", "....y...........", "....n11111111...", "....n1111w111...",
    "....n111www11...", "....n1111w111...", "....n22222222...", "....n...........",
    "....n...........", "....n...........", "....n...........", "...nnn..........",
    ".ssssssssssssss.", ".sssSsssSsssSss.", ".SSSSSSSSSSSSSS.", "................"],
  dissipation: [ // fiole de remède
    "................", ".......nn.......", ".......nn...w...", "......ssss......",
    ".......ss.......", ".......ss.......", "......ssss......", "....ssswssss....",
    "...sswsssssss...", "..s31111111111s.", "..s31111311111s.", "..s11131111111s.",
    "..s11111111112s.", "...s1111111122s.", "....ssssssssss..", "................"],
  dernier_rempart: [ // tour crénelée
    "................", "........y.......", "........yy......", "........n.......",
    "...33..33..33...", "...3333333333...", "...1111111112...", "...11k1111k12...",
    "...11k1111k12...", "...1111111112...", "...1111kk1112...", "...111kkkk112...",
    "...111kkkk112...", "...111kkkk112...", ".22222222222222.", "................"],
  fusion: [ // deux orbes qui n'en font qu'un
    "................", "......w.w.......", "................", "..ppp.....111...",
    ".pwppp...13111..", ".ppppp.w.11111..", ".pppppwww111112.", ".ppppp.w.11112..",
    "..ppp.....122...", "....1......1....", ".....1....1.....", "......3311......",
    ".....311112.....", ".....111122.....", "......2222......", "................"],
  mutation: [ // double hélice
    "................", "...1........y...", "....1wwwwwwy....", ".....1....y.....",
    "......1wwy......", ".......1y.......", "......y..1......", ".....ywwww1.....",
    "....y......1....", "...ywwwwwwww1...", "....y......1....", ".....ywwww1.....",
    "......y..1......", ".......y1.......", "......1wwy......", "................"],
  purification: [ // goutte purifiante
    "................", ".......b........", ".......b....w...", "......bbb.......",
    "..w...bbb.......", ".....bbbbb......", "....bwbbbbb.....", "...bwwbbbbbb....",
    "...bwbbbbbbB....", "..bbbbbbbbbbB...", "..bbbbbbbbbbB...", "..bbbbbbbbbBB...",
    "...bbbbbbbBB....", "....BBBBBBB.....", "................", "................"],
  eveil: [ // œil qui s'ouvre, rayons
    "................", ".......y........", "..y....y....y...", "...y.......y....",
    "................", ".....111111.....", "...11wwwwww11...", "..1wwwBBBBwww1..",
    ".1wwwBBkkBBwww1.", ".1wwwBwkkBBwww1.", "..1wwwBBBBwww1..", "...11wwwwww11...",
    ".....111111.....", "...y.......y....", "..y....y....y...", "................"],
  reversion: [ // sablier
    "................", "..nnnnnnnnnnnn..", "...s11111111s...", "...s11111111s...",
    "....s111111s....", ".....s1111s.....", "......s11s......", ".......11.......",
    "......sk1s......", ".....skk1ks.....", "....skkk1kks....", "...skkkk11kks...",
    "...skk1111kks...", "...s11111111s...", "..nnnnnnnnnnnn..", "................"],
  piege_runique: [ // mâchoires de piège
    "................", ".s............s.", ".sw..........ws.", ".ss..........ss.",
    ".sw..........ws.", "..ss........ss..", "..sw........ws..", "...ss......ss...",
    "...ssssssssss...", "....ss1111ss....", "...nn131131nn...", ".nnnnnnnnnnnnnn.",
    ".NNNNNNNNNNNNNN.", "......kk........", "......k.k.......", "................"],
  leurre: [ // masque de théâtre
    "................", "................", "...1111111111...", "..133333333311..",
    ".r131111111111r.", "..11kk1111kk11..", "..11kk1111kk12..", "..111111111112..",
    "...11111111112..", "...11k1111k12...", "....11kkkk12....", ".....111112.....",
    "......1122......", "................", "................", "................"],
  sonde: [ // boule de cristal
    "................", "......pppp......", "....pppppppp....", "...ppwwpppppp...",
    "..ppwppp1ppppp..", "..pwpp111ppppp..", "..ppp11y11pppp..", "..pppp111ppppp..",
    "..ppppp1pppppk..", "...pppppppppk...", "....ppppppkk....", ".....nnnnnn.....",
    "....nyyyyyyn....", "...nnnnnnnnnn...", "...NNNNNNNNNN...", "................"],
  voile: [ // capuche vide, deux yeux
    "................", "......1111......", ".....133311.....", "....13311111....",
    "...1331kkkk11...", "...131kkkkkk1...", "...11kbkkbk11...", "...11kkkkkk12...",
    "...111kkkk112...", "..11111111112...", "..111111111122..", ".1111111111122..",
    ".11111111111222.", ".11111111111222.", "................", "................"],
  fausse_piste: [ // panneau « ? »
    "................", "..nnnnnnnnnnnn..", "..nnnnwwwnnnnn..", "..nnnnnnwnnnnn..",
    "..nnnnnwnnnnnn..", "..nnnnnnnnnnnN..", "..NNNNNwNNNNNN..", ".......nN.......",
    ".......nN.......", ".......nN.......", ".......nN.......", ".......nN.......",
    ".......nN.......", ".....GGGGGG.....", "...GgGgGgGgGg...", "................"],
  gel: [ // flocon
    "................", ".......1........", "......111.......", "...1...1...1....",
    "....1..1..1.....", ".....1.1.1......", "..1...111...1...", ".111111w111111..",
    "..1...111...1...", ".....1.1.1......", "....1..1..1.....", "...1...1...1....",
    "......111.......", ".......1........", "................", "................"],
  silence: [ // cloche barrée
    "................", ".......y....rr..", "......yyy..rr...", ".....yyyyyrr....",
    "....yywyyrr.....", "....ywyyrry.....", "....yyyrryy.....", "...yyyrryyyy....",
    "..yyyrryyyyyY...", ".YYYrrYYYYYYYY..", "...rr..Y........", "..rr............",
    ".rr.............", "................", "................", "................"],
  contresort: [ // baguette brisée
    "................", "............y...", "...........yyy..", "............y...",
    "...........nn...", "..........nn....", ".........nn.....", ".......w.1......",
    "......1...w.....", ".....nn.........", "....nn..........", "...NN...........",
    "..NN............", ".NN.............", "................", "................"],
  interference: [ // carte fendue par un éclair
    "................", "......ssssssss..", "......sSSSSSSs..", "..11111111SSSs..",
    "..13333331SSSs..", "..1333y331SSSs..", "..133yy331SSSs..", "..13yy3331SSSs..",
    "..133yy331sss...", "..1333yy31......", "..13333y31......", "..1333y331......",
    "..1333y331......", "..11111112......", "................", "................"],
  lien: [ // chaîne
    "................", "................", "..1111..........", ".1....1.........",
    ".1....1.........", ".1....1333......", "..1111....3.....", ".....3....3.....",
    ".....3....3.....", "......33331111..", ".........1....1.", ".........1....1.",
    ".........1....1.", "..........1111..", "................", "................"],
  resurrection: [ // ankh
    "................", "..w...3311...w..", ".....3....1.....", ".....3....1.....",
    ".....1....2.....", "......1..2......", "...3333111122...", "...1111111122...",
    ".......12.......", ".......12.......", ".......12.......", ".......12.......",
    ".......12.......", ".......12.......", "......1122......", "................"],
  duplication: [ // pion et son double
    "................", "................", "...111..........", "..13311.........",
    "..13111.........", "...111....sss...", "....1....swwss..", "...111...swsss..",
    "..11111...sss...", ".1111112...s....", "..........sss...", ".........sssss..",
    "........ssssssS.", "................", "................", "................"],
  sacrifice: [ // dague cérémonielle
    "................", ".......yy.......", "......yrry......", ".......yy.......",
    ".......nn.......", ".......Nn.......", ".......nN.......", "...yyyyyyyyyy...",
    "....YYyrryYY....", ".......ss.......", "......swsS......", "......swsS......",
    "......swsS......", ".......wS.......", ".......s........", "................"],
  pacte_instable: [ // parchemin au sceau fêlé
    "................", "..nnnnnnnnnnnn..", "...cccccccccc...", "...cCCCCCCCCc...",
    "...cccccccccc...", "...cCCCCCcccc...", "...cccccccccc...", "...cCCCCccccc...",
    "...cccccc11cc...", "...ccccc1331c...", "...ccccc1k11c...", "...cccccc11cc...",
    "..nnnnnnnnnnnn..", "........1.1.....", "................", "................"],
  dernier_pari: [ // deux dés
    "................", "................", ".wwwwwww........", ".wkwwwwS........",
    ".wwwwwwS........", ".wwwkwwS........", ".wwwwwwS........", ".wwwwwkS1111111.",
    ".SSSSSSS1k111k2.", "........1111112.", "........111k112.", "........1111112.",
    "........1k111k2.", "........2222222.", "................", "................"]
};

/* Grille de couleurs d'une carte ; contour auto (4-voisinage) en ART_INK. */
function subjectPixels(id, tint) {
  var map = CARD_SUBJECTS[id];
  var cols = { "1": tint, "2": shadeHex(tint, -0.38), "3": shadeHex(tint, 0.45) };
  return outlinedPixels(map, function (ch) { return cols[ch] || ART_COLORS[ch] || null; });
}

function outlinedPixels(map, colorFor) {
  var H = map.length, W = map[0].length, out = [], r, c;
  for (r = 0; r < H; r++) { out.push([]); for (c = 0; c < W; c++) out[r].push(map[r][c] === "." ? null : colorFor(map[r][c])); }
  var res = out.map(function (row) { return row.slice(); });
  for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
    if (out[r][c]) continue;
    if ((out[r - 1] && out[r - 1][c]) || (out[r + 1] && out[r + 1][c]) || out[r][c - 1] || out[r][c + 1]) res[r][c] = ART_INK;
  }
  return res;
}

/* ================= Pions ================= */
/* Rampes à 5 tons par camp : palette limitée, lisible, distincte (violet / orange). */
var PAWN_PALETTES = {
  1: { outline: "#1a0b38", shade: "#4c1d95", main: "#7c3aed", light: "#b79cff", spec: "#efe7ff", gem: "#f5c542", gemShade: "#b7791f" },
  2: { outline: "#3b1104", shade: "#9a3412", main: "#ea580c", light: "#ffb37a", spec: "#fff1e0", gem: "#7dd3fc", gemShade: "#2563eb" }
};

/* Sprite d'un pion : silhouette SPRITE_MAPS, contour, lumière en haut à gauche,
   ombre en bas à droite (tons durs), reflet, gemme facettée au centre. */
function pawnPixels(shapeMap, player) {
  var pal = PAWN_PALETTES[player], out = [];
  function on(r, c) { return shapeMap[r] && shapeMap[r][c] === "#"; }
  for (var r = 0; r < 16; r++) {
    out.push([]);
    for (var c = 0; c < 16; c++) {
      if (!on(r, c)) { out[r].push(null); continue; }
      var col;
      if (!on(r - 1, c) || !on(r + 1, c) || !on(r, c - 1) || !on(r, c + 1)) col = pal.outline;
      else if ((r === 7 || r === 8) && (c === 7 || c === 8)) col = (r === 7 && c === 7) ? pal.spec : (r === 8 && c === 8 ? pal.gemShade : pal.gem);
      else if ((r === 6 && (c === 7 || c === 8)) || (r === 9 && (c === 7 || c === 8)) || (c === 6 && (r === 7 || r === 8)) || (c === 9 && (r === 7 || r === 8))) col = pal.outline;
      else if (!on(r - 2, c) || !on(r, c - 2)) col = (r + c) % 4 === 0 && !on(r - 2, c) && !on(r, c - 2) ? pal.spec : pal.light;
      else if (!on(r + 2, c) || !on(r, c + 2)) col = pal.shade;
      else if (r + c >= 19 && (r + c) % 2 === 0) col = pal.shade; // tramage damier dans l'ombre
      else col = pal.main;
      out[r].push(col);
    }
  }
  return out;
}

/* ================= Plateau ================= */
/* Hachage déterministe (même résultat sous Node et dans le navigateur). */
function artHash(x, y, seed) {
  var h = (x * 374761393 + y * 668265263 + seed * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

var BOARD_COLORS = {
  /* Grès clair / pierre de lune sombre : contraste fort avec les DEUX camps
     (violet et orange), sans reprendre leurs teintes. */
  light: { base: "#d8ccaa", hi: "#eee5c6", lo: "#b3a47c", grit: "#c8ba95", line: "#8f7f58" },
  dark:  { base: "#2e5257", hi: "#3f6a6f", lo: "#1d3639", grit: "#284a4f", line: "#16292c", rune: "#5fb3a8" }
};
var RUNE_ENGRAVINGS = [ // gravures 5x5 sur certaines cases foncées
  [".#.#.", ".#.#.", "..#..", "..#..", "..#.."],
  ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  ["..#..", ".###.", "..#..", "..#..", ".#.#."],
  ["###..", "#....", "###..", "..#..", "###.."]
];

/* Dalle 16x16 : biseau 1 px (lumière haut-gauche, ombre bas-droite), grain
   tramé, fissure ou gravure runique selon la variante. Tons durs uniquement. */
function boardTile(kind, r, c) {
  var P = BOARD_COLORS[kind], seed = r * 8 + c + (kind === "dark" ? 101 : 7), px = [];
  for (var y = 0; y < 16; y++) {
    px.push([]);
    for (var x = 0; x < 16; x++) {
      var col = P.base;
      if ((x + y) % 2 === 0 && artHash(x, y, seed) < 0.22) col = P.grit;
      if (y === 0 || x === 0) col = P.hi;
      if (y === 15 || x === 15) col = P.lo;
      if ((y === 1 && x > 0 && x < 15) || (x === 1 && y > 0 && y < 15)) col = (x + y) % 2 ? P.hi : col;
      px[y].push(col);
    }
  }
  var variant = Math.floor(artHash(r, c, kind === "dark" ? 3 : 5) * 10);
  if (variant < 3) { // fissure
    var fx = 3 + Math.floor(artHash(c, r, 11) * 9), fy = 3 + Math.floor(artHash(r, c, 13) * 6);
    for (var i = 0; i < 6; i++) {
      var yy = fy + i, xx = fx + (i % 3 === 2 ? 1 : 0) + Math.floor(i / 3);
      if (yy > 1 && yy < 15 && xx > 1 && xx < 15) px[yy][xx] = P.line;
    }
  } else if (kind === "dark" && variant > 7) { // gravure runique
    var g = RUNE_ENGRAVINGS[(r * 3 + c) % RUNE_ENGRAVINGS.length];
    for (var gy = 0; gy < 5; gy++) for (var gx = 0; gx < 5; gx++)
      if (g[gy][gx] === "#") { px[5 + gy][5 + gx] = P.line; if (gx < 4 && g[gy][gx + 1] !== "#") px[5 + gy][6 + gx] = P.rune; }
  }
  return px;
}

/* ================= Police 3x5 (coordonnées, puces d'état) ================= */
var PIXEL_FONT = {
  A: ["###", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
  C: ["###", "#..", "#..", "#..", "###"], D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: ["###", "#..", "#.#", "#.#", "###"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"], M: ["#.#", "###", "###", "#.#", "#.#"],
  P: ["##.", "#.#", "##.", "#..", "#.."], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: ["###", "#..", "###", "..#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."], "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."], "6": [".##", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
  "?": ["##.", "..#", ".#.", "...", ".#."], "+": ["...", ".#.", "###", ".#.", "..."],
  "~": ["...", "#..", "###", "..#", "..."], // Pas spectral prêt
  "⚓": [".#.", "###", ".#.", "#.#", "###"], // Ancré
  "Év": ["###", "#.#", "#.#", "#.#", "###"] // Éveillé (œil)
};

/* ================= Sprites d'interface ================= */
var UI_SPRITES = {
  hat: { // chapeau de sorcier (logo)
    colors: { p: "#7c3aed", P: "#4c1d95", l: "#b79cff", y: "#f5c542", Y: "#b7791f", w: "#fff7d6" },
    map: [
      "..........w.....", ".........ll.....", "........lpp.....", ".......lppP.....",
      "......lpppP.....", "......lppwP.....", ".....lpppPP.....", ".....lppppP.....",
      "....lpppppPP....", "....yyyyyyyy....", "...lppppppppP...", ".lppppppppppppP.",
      "lpppppppppppppPP", ".PPPPPPPPPPPPPP.", "................", "................"]
  },
  crown: {
    colors: { y: "#f5c542", Y: "#b7791f", w: "#fff7d6", r: "#ef4444", b: "#7dd3fc" },
    map: [
      "................", "................", ".w.....w.....w..", ".y.....y.....y..",
      ".yy...yyy...yy..", ".yyy.yywyy.yyy..", ".yyyyyyyyyyyyy..", ".yyryyybyyyryy..",
      ".yyyyyyyyyyyyy..", ".YYYYYYYYYYYYY..", "................", "................"]
  },
  swords: { // compteur de captures
    colors: { s: "#e2e8f0", S: "#94a3b8", n: "#8a5a2b", y: "#f5c542" },
    map: [
      "s.........s", ".s.......s.", "..s.....s..", "...s...s...", "....s.s....",
      ".....S.....", "....S.S....", "...y...y...", "..n.....n..", ".n.......n."]
  },
  deck: { // pioche
    colors: { v: "#4c1d95", V: "#7c3aed", y: "#f5c542" },
    map: ["..vvvvvv", ".vVVVVVv", "vVVVVVvv", "vVyVVVv.", "vVVyVVv.", "vVyVVVv.", "vVVVVVv.", "vvvvvvv."]
  },
  discard: { // défausse
    colors: { s: "#94a3b8", S: "#475569", r: "#ef4444" },
    map: ["ssssss..", "sSSSSs..", "sSrSrs..", "sSSrSs..", "sSrSrs..", "sSSSSs..", "ssssss..", "........"]
  },
  speakerOn: {
    colors: { s: "#f3efff", y: "#f5c542" },
    map: ["...s.....", "..ss..y..", "ssss...y.", "ssss.y.y.", "ssss.y.y.", "ssss...y.", "..ss..y..", "...s....."]
  },
  speakerOff: {
    colors: { s: "#f3efff", r: "#ef4444" },
    map: ["...s.....", "..ss.....", "ssss.r.r.", "ssss..r..", "ssss..r..", "ssss.r.r.", "..ss.....", "...s....."]
  },
  cardBack: { // dos de carte (main adverse)
    colors: { o: "#10101c", v: "#3b0f73", V: "#6d28d9", y: "#f5c542", Y: "#b7791f" },
    map: [
      "oooooooooooo", "oyyyyyyyyyyo", "oyvvvvvvvvyo", "oyvVvvvvVvyo", "oyvvvyyvvvyo",
      "oyvvyVVyvvyo", "oyvyVyyVyvyo", "oyvyVyyVyvyo", "oyvvyVVyvvyo", "oyvvvyyvvvyo",
      "oyvVvvvvVvyo", "oyvvvvvvvvyo", "oyvvvvvvvvyo", "oyyyyyyyyyyo", "oYYYYYYYYYYo", "oooooooooooo"]
  },
  star: { colors: { w: "#fff7d6", y: "#f5c542" }, map: ["..w..", "..y..", "wyyyw", "..y..", "..w.."] }
};

/* Marqueurs de plateau en sprites (ancien ✦ / ✷ / « ? » unicode). */
var BOARD_MARKERS = {
  guard: { colors: { y: "#f5c542", Y: "#b7791f", w: "#fff7d6" }, map: ["...y...", "..yYy..", ".yYwYy.", "yYwwwYy", ".yYwYy.", "..yYy..", "...y..."] },
  trap: { colors: { y: "#facc15", r: "#ef4444", k: "#78350f" }, map: ["y..k..y", ".y.k.y.", "..yry..", "kkrrrkk", "..yry..", ".y.k.y.", "y..k..y"] },
  suspicion: { colors: { r: "#b91c1c", w: "#ffffff" }, map: ["rrrrr", "rwwrr", "rrrwr", "rrwrr", "rrrrr", "rrwrr", "rrrrr"] }
};

/* Puces d'état : fond coloré, contour, glyphe 3x5. */
var CHIP_COLORS = { "": "#cfc3ee", gold: "#f5c542", red: "#fca5a5", blue: "#7dd3fc", gray: "#94a3b8" };

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ART_INK: ART_INK, ART_COLORS: ART_COLORS, CARD_SUBJECTS: CARD_SUBJECTS, shadeHex: shadeHex,
    subjectPixels: subjectPixels, outlinedPixels: outlinedPixels, PAWN_PALETTES: PAWN_PALETTES,
    pawnPixels: pawnPixels, artHash: artHash, BOARD_COLORS: BOARD_COLORS, boardTile: boardTile,
    PIXEL_FONT: PIXEL_FONT, UI_SPRITES: UI_SPRITES, BOARD_MARKERS: BOARD_MARKERS, CHIP_COLORS: CHIP_COLORS
  };
}
