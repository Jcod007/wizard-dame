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
 *   - PAWN_PALETTES : couleurs des camps ; CARD_RARITY / RARITY_STYLES : cadres des cartes ;
 *   - terrainAt() / terrainTile() : terrain fantastique du plateau (pas de damier) ;
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

/* ================= Pièces : couleurs des camps =================
   Les personnages eux-mêmes sont des planches PNG animées (assets/characters/,
   générées par tools/build-characters.py depuis Mana Seed et le Basic Asset
   Pack). Ici ne restent que les couleurs de camp : cercles au sol, éclats de
   capture, interface. */
var PAWN_PALETTES = {
  1: { main: "#7c3aed", light: "#a78bfa", dark: "#5b21b6", outline: "#1a0b38", gem: "#f5c542" },
  2: { main: "#f97316", light: "#fdba74", dark: "#c2410c", outline: "#3b1104", gem: "#7dd3fc" }
};

/* Rareté des cartes (cosmétique : cadre de métal et reflet holographique).
   Légendaire = cartes bannies après usage. */
var CARD_RARITY = {
  fusion: "legendaire", resurrection: "legendaire", dernier_pari: "legendaire",
  piege_runique: "epique", sonde: "epique", duplication: "epique", pacte_instable: "epique", interference: "epique", contresort: "epique",
  bouclier_runique: "rare", gel: "rare", lien: "rare", eveil: "rare", mutation: "rare", reversion: "rare", silence: "rare", dernier_rempart: "rare", sacrifice: "rare"
};
var RARITY_STYLES = {
  commune:    { label: "Commune",    frame: "#8b93a8", hi: "#c3cddc", lo: "#4f5869", gem: "#e2e8f0" },
  rare:       { label: "Rare",       frame: "#3b6fd1", hi: "#7aa2f0", lo: "#1e3a8a", gem: "#7dd3fc" },
  epique:     { label: "Épique",     frame: "#8b4fd8", hi: "#c4a1f5", lo: "#4c1d95", gem: "#e879f9" },
  legendaire: { label: "Légendaire", frame: "#c9a34a", hi: "#f5e09a", lo: "#7a4d0c", gem: "#f5c542" }
};
function cardRarity(id) { return CARD_RARITY[id] || "commune"; }

/* ================= Plateau ================= */
/* Hachage déterministe (même résultat sous Node et dans le navigateur). */
function artHash(x, y, seed) {
  var h = (x * 374761393 + y * 668265263 + seed * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ================= Plateau : terrain fantastique =================
   Décision d'Ekoue (2026-10-23) : PLUS DE DAMIER. Le plateau est une carte de
   terrain continue (régions par bruit lissé), symétrique par rotation de 180°
   pour que les deux camps aient le même décor. Les biomes sont PUREMENT
   décoratifs : toutes les cases restent des cases normales. Un liseré sombre
   d'1 px sépare les cases pour garder la grille lisible. */
var TERRAIN = {
  herbe:   { base: "#3f6b37", hi: "#548a46", lo: "#2e5229", dot: "#6aa856" },
  prairie: { base: "#4a7a3c", hi: "#5f9a4c", lo: "#365c2c", flowers: ["#f5c542", "#f3efff", "#7dd3fc"] },
  dalle:   { base: "#6f6a7d", hi: "#8d879c", lo: "#57526a", joint: "#3f3b4f", moss: "#4f7a3e" },
  sable:   { base: "#bfa66e", hi: "#d6c28e", lo: "#9c8656", dot: "#a8915c" },
  cristal: { base: "#2e5257", hi: "#3f6a6f", lo: "#1d3639", shard: "#7de0d6", shardHi: "#d8fff9" },
  place:   { base: "#6b6478", hi: "#8a8298", lo: "#4b4558", rune: "#e9c46a", runeLo: "#9a6b1f" }
};

function smoothNoise(x, y, seed) { // bruit de valeur lissé (bilinéaire), déterministe
  var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  function v(a, b) { return artHash(a, b, seed); }
  var top = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx;
  var bot = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bot * fy;
}

/* Carte des biomes : symétrique (r,c) ~ (7-r,7-c), place runique au centre.
   Répartition par RANG du bruit (et non par seuils) : chaque partie a toujours
   un terrain varié — ~30 % herbe, 22 % prairie, 20 % dalles, 14 % sable,
   14 % cristaux — dont seule la disposition change avec la graine. */
var TERRAIN_SHARES = [["herbe", 0.30], ["prairie", 0.22], ["dalle", 0.20], ["sable", 0.14], ["cristal", 0.14]];
var _terrainCache = {};
function terrainMap(seed) {
  seed = seed || 1;
  if (_terrainCache[seed]) return _terrainCache[seed];
  var cells = [], r, c, map = [];
  for (r = 0; r < 8; r++) { map.push([]); for (c = 0; c < 8; c++) map[r].push(null); }
  for (r = 0; r < 8; r++) for (c = 0; c < 8; c++) {
    if (r >= 3 && r <= 4 && c >= 3 && c <= 4) { map[r][c] = "place"; continue; }
    if (r * 8 + c > (7 - r) * 8 + (7 - c)) continue; // case canonique de la paire symétrique
    cells.push({ r: r, c: c, n: smoothNoise(c / 2.4, r / 2.4, seed) + artHash(r, c, seed + 3) * 0.08 });
  }
  cells.sort(function (x, y) { return x.n - y.n; });
  var k = 0, acc = 0;
  cells.forEach(function (cell, i) {
    while (k < TERRAIN_SHARES.length - 1 && i >= Math.round((acc + TERRAIN_SHARES[k][1]) * cells.length)) { acc += TERRAIN_SHARES[k][1]; k++; }
    map[cell.r][cell.c] = map[7 - cell.r][7 - cell.c] = TERRAIN_SHARES[k][0];
  });
  _terrainCache[seed] = map;
  return map;
}
function terrainAt(r, c, seed) { return terrainMap(seed)[r][c]; }

/* Dalle 16x16 du biome ; (r, c) servent de graine pour varier les détails.
   Les deux dernières lignes/colonnes forment le liseré de grille. */
function terrainTile(kind, r, c) {
  var P = TERRAIN[kind], seed = r * 8 + c + 17, px = [], x, y;
  for (y = 0; y < 16; y++) { px.push([]); for (x = 0; x < 16; x++) px[y].push(P.base); }
  function set(xx, yy, col) { if (xx >= 0 && yy >= 0 && xx < 15 && yy < 15) px[yy][xx] = col; }
  for (y = 0; y < 15; y++) for (x = 0; x < 15; x++) if ((x + y) % 2 === 0 && artHash(x, y, seed) < 0.18) px[y][x] = P.lo;
  if (kind === "herbe" || kind === "prairie") {
    for (var i = 0; i < 9; i++) { // brins d'herbe
      x = Math.floor(artHash(i, 1, seed) * 14); y = 2 + Math.floor(artHash(1, i, seed) * 12);
      set(x, y, P.hi); set(x, y - 1, P.hi); set(x + 1, y + 1, P.lo);
    }
    if (kind === "prairie") for (i = 0; i < 4; i++) {
      x = 1 + Math.floor(artHash(i, 7, seed) * 12); y = 1 + Math.floor(artHash(7, i, seed) * 12);
      var fc = P.flowers[i % P.flowers.length];
      set(x, y, fc); set(x - 1, y, fc); set(x + 1, y, fc); set(x, y - 1, fc); set(x, y + 1, "#2e5229");
    }
  } else if (kind === "dalle") { // dalles appareillées + mousse
    for (x = 0; x < 15; x++) { set(x, 7, P.joint); }
    for (y = 0; y < 7; y++) set(7 + (seed % 3) - 1, y, P.joint);
    for (y = 8; y < 15; y++) set(3 + (seed % 4), y, P.joint);
    for (x = 0; x < 15; x++) { set(x, 0, P.hi); set(x, 8, P.hi); }
    for (i = 0; i < 6; i++) if (artHash(i, 3, seed) < 0.6) set(Math.floor(artHash(3, i, seed) * 14), 6 + (i % 3) * 3, P.moss);
  } else if (kind === "sable") { // ondulations et cailloux
    for (y = 3; y < 15; y += 4) for (x = 0; x < 15; x++) if ((x + y + seed) % 6 < 3) set(x, y + ((x >> 2) % 2), P.hi);
    for (i = 0; i < 3; i++) set(Math.floor(artHash(i, 5, seed) * 14), Math.floor(artHash(5, i, seed) * 14), P.dot);
  } else if (kind === "cristal") { // éclats de cristal lumineux
    [[3, 11, 4], [10, 9, 5], [7, 13, 3]].forEach(function (cp, j) {
      var cx = (cp[0] + seed + j) % 12 + 1;
      for (var h = 0; h < cp[2]; h++) { set(cx, cp[1] - h, P.shard); set(cx + 1, cp[1] - h, h === cp[2] - 1 ? P.shardHi : P.lo); }
      set(cx, cp[1] - cp[2], P.shardHi);
    });
  } else if (kind === "place") { // pavés de la place runique
    for (y = 0; y < 15; y++) for (x = 0; x < 15; x++) if (x % 5 === 4 || y % 5 === 4) px[y][x] = P.lo;
    for (y = 0; y < 15; y += 5) for (x = 0; x < 15; x += 5) set(x, y, P.hi);
  }
  // Liseré de grille : 1 px sombre à droite et en bas de chaque case
  for (i = 0; i < 16; i++) { px[15][i] = "#141a14"; px[i][15] = "#141a14"; }
  return px;
}

/* Grand cercle runique sur la place centrale (2x2 cases) : liste de pixels
   relatifs au coin haut-gauche de la place (32x32). */
function runeCirclePixels() {
  var out = [], a, r;
  for (a = 0; a < 120; a++) {
    var ang = a / 120 * Math.PI * 2;
    [[13, TERRAIN.place.rune], [11, TERRAIN.place.runeLo]].forEach(function (ring, i) {
      if (i === 1 && a % 3 === 0) return;
      out.push([Math.round(15.5 + Math.cos(ang) * ring[0]), Math.round(15.5 + Math.sin(ang) * ring[0]), ring[1]]);
    });
  }
  for (r = 0; r < 6; r++) { // 6 rayons courts
    var an = r / 6 * Math.PI * 2;
    for (var d = 5; d < 10; d++) out.push([Math.round(15.5 + Math.cos(an) * d), Math.round(15.5 + Math.sin(an) * d), TERRAIN.place.rune]);
  }
  return out;
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
    CARD_RARITY: CARD_RARITY, RARITY_STYLES: RARITY_STYLES, cardRarity: cardRarity,
    artHash: artHash, TERRAIN: TERRAIN, terrainAt: terrainAt, terrainMap: terrainMap, terrainTile: terrainTile, runeCirclePixels: runeCirclePixels,
    PIXEL_FONT: PIXEL_FONT, UI_SPRITES: UI_SPRITES, BOARD_MARKERS: BOARD_MARKERS, CHIP_COLORS: CHIP_COLORS
  };
}
