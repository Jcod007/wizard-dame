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
["light", "dark"].forEach(function (kind) {
  var t = art.boardTile(kind, 3, 4);
  check(t.length === 16 && t.every(function (r) { return r.length === 16 && r.every(Boolean); }), "dalle " + kind + " incomplète");
});
eng.SHAPES.forEach(function (sh) {
  [1, 2].forEach(function (pl) {
    var p = art.pawnPixels(eng.SPRITE_MAPS[sh], pl);
    check(p.length === 16, "pion " + sh);
  });
});

var di = process.argv.indexOf("--dump");
if (di > 0) {
  var dump = { subjects: {}, pawns: {}, tiles: [], ui: {} };
  eng.CARD_IDS.forEach(function (id) { dump.subjects[id] = art.subjectPixels(id, eng.CARDS[id].teinte); });
  eng.SHAPES.forEach(function (sh) { dump.pawns[sh] = [art.pawnPixels(eng.SPRITE_MAPS[sh], 1), art.pawnPixels(eng.SPRITE_MAPS[sh], 2)]; });
  for (var r = 0; r < 2; r++) for (var c = 0; c < 8; c++) dump.tiles.push(art.boardTile((r + c) % 2 ? "dark" : "light", r, c));
  require("fs").writeFileSync(process.argv[di + 1], JSON.stringify(dump));
}
console.log(fails ? fails + " échec(s)" : "art-check : OK (" + eng.CARD_IDS.length + " sujets, " + Object.keys(art.UI_SPRITES).length + " sprites d'interface)");
process.exit(fails ? 1 : 0);
