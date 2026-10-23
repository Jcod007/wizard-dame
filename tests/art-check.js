"use strict";
/* Vérifie les ressources pixel art d'art.js : dimensions des grilles,
   couleurs connues, un sujet unique par carte, aucun pixel sur la marge
   réservée au contour. Usage : node tests/art-check.js [--dump fichier.json] */
var path = require("path");
var art = require(path.join(__dirname, "..", "art.js"));
var eng = require(path.join(__dirname, "..", "engine.js"));
var fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log("FAIL " + msg); } }

eng.CARD_IDS.forEach(function (id) {
  var m = art.CARD_SUBJECTS[id];
  check(!!m, "sujet manquant pour " + id);
  if (!m) return;
  check(m.length === 16, id + " : " + m.length + " lignes au lieu de 16");
  m.forEach(function (row, i) {
    check(row.length === 16, id + " ligne " + i + " : " + row.length + " colonnes");
    for (var c = 0; c < row.length; c++) {
      var ch = row[c];
      check(ch === "." || "123".indexOf(ch) >= 0 || art.ART_COLORS[ch], id + " : couleur inconnue '" + ch + "'");
      if (i === 0 || i === 15 || c === 0 || c === 15) check(ch === ".", id + " : pixel sur la marge (" + i + "," + c + ")");
    }
  });
});
var sigs = {};
Object.keys(art.CARD_SUBJECTS).forEach(function (id) {
  var s = art.CARD_SUBJECTS[id].join("");
  check(!sigs[s], "sujets identiques : " + id + " / " + sigs[s]);
  sigs[s] = id;
  check(eng.CARD_IDS.indexOf(id) >= 0, "sujet sans carte : " + id);
});
Object.keys(art.UI_SPRITES).concat(Object.keys(art.BOARD_MARKERS)).forEach(function (k) {
  var sp = art.UI_SPRITES[k] || art.BOARD_MARKERS[k];
  var w = sp.map[0].length;
  sp.map.forEach(function (row, i) {
    check(row.length === w, "sprite " + k + " ligne " + i + " : largeur " + row.length + " ≠ " + w);
    for (var c = 0; c < row.length; c++) check(row[c] === "." || sp.colors[row[c]], "sprite " + k + " : couleur inconnue '" + row[c] + "'");
  });
});
Object.keys(art.PIXEL_FONT).forEach(function (k) {
  var g = art.PIXEL_FONT[k];
  check(g.length === 5 && g.every(function (r) { return r.length === 3; }), "glyphe " + k + " pas en 3x5");
});
Object.keys(art.TERRAIN).forEach(function (kind) {
  var t = art.terrainTile(kind, 3, 4);
  check(t.length === 16 && t.every(function (r) { return r.length === 16 && r.every(Boolean); }), "dalle " + kind + " incomplète");
});
var biomes = {};
for (var tr = 0; tr < 8; tr++) for (var tc = 0; tc < 8; tc++) {
  var k = art.terrainAt(tr, tc);
  biomes[k] = (biomes[k] || 0) + 1;
  check(k === art.terrainAt(7 - tr, 7 - tc), "terrain non symétrique en " + tr + "," + tc);
}
check(Object.keys(biomes).length >= 4, "terrain trop uniforme : " + JSON.stringify(biomes));
// Personnages : planches PNG générées (assets/characters/), décrites par characters.json.
var fs = require("fs");
var charDir = path.join(__dirname, "..", "assets", "characters");
var manifest = JSON.parse(fs.readFileSync(path.join(charDir, "characters.json"), "utf8"));
function pngSize(file) { var b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
check(eng.SHAPES.length === 6 && new Set(eng.SHAPES).size === 6, "6 personnages distincts attendus");
eng.SHAPES.forEach(function (sh) {
  check(!!manifest.characters[sh], "personnage absent de characters.json : " + sh);
  check(!!eng.PIECE_NAMES[sh], "nom d'affichage manquant : " + sh);
  [1, 2].forEach(function (pl) {
    var sheet = path.join(charDir, sh + "-" + pl + ".png"), por = path.join(charDir, "portrait-" + sh + "-" + pl + ".png");
    check(fs.existsSync(sheet), "planche manquante : " + sh + "-" + pl);
    check(fs.existsSync(por), "portrait manquant : " + sh + "-" + pl);
    if (fs.existsSync(sheet)) { var s = pngSize(sheet); check(s[0] === 4 * manifest.frame && s[1] === 3 * manifest.frame, "planche " + sh + "-" + pl + " : " + s.join("x")); }
  });
});
check(fs.existsSync(path.join(charDir, "CREDITS.md")), "crédits des personnages manquants");
eng.CARD_IDS.forEach(function (id) { check(!!art.RARITY_STYLES[art.cardRarity(id)], "rareté inconnue pour " + id); });

var di = process.argv.indexOf("--dump");
if (di > 0) {
  var dump = { subjects: {}, pawns: {}, tiles: [], ui: {} };
  eng.CARD_IDS.forEach(function (id) { dump.subjects[id] = art.subjectPixels(id, eng.CARDS[id].teinte); });
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) dump.tiles.push(art.terrainTile(art.terrainAt(r, c), r, c));
  require("fs").writeFileSync(process.argv[di + 1], JSON.stringify(dump));
}
console.log(fails ? fails + " échec(s)" : "art-check : OK (" + eng.CARD_IDS.length + " sujets, " + Object.keys(art.UI_SPRITES).length + " sprites d'interface)");
process.exit(fails ? 1 : 0);
