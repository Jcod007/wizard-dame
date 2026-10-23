#!/usr/bin/env python3
"""Construit ui-dom.js depuis game.js : sons Web Audio inchangés, rendu DOM des
cartes (cardSceneURL / cardSpriteURL) avec corrections Designer C1-C12, et le
bloc interface dont le plateau DOM est remplacé par un pont vers Phaser
(window.WDBoard). La logique de jeu vient d'engine.js (globaux partagés)."""
import re

SRC = open("game.js", encoding="utf-8").read()

def between(text, start, end):
    i = text.index(start)
    j = text.index(end, i)
    return text[i:j], text[:i], text[j:]

out = []
out.append('"use strict";')
out.append("""/*
 * Wizard Dame — ui-dom.js : couche DOM hybride (migration Phaser, 2026-10-23).
 * Main de cartes, panneau de détail §5.2, journal, indicateur de tour, menus,
 * écran de victoire, passation et bouton Son restent en DOM/CSS (recommandation
 * hybride de l'orchestrateur, synthèse §5) ; le plateau vit dans Phaser
 * (phaser-main.js) via le pont window.WDBoard / window.WDCellClick.
 * Le synthétiseur de sons 8-bit Web Audio est repris tel quel de game.js.
 * Corrections du Designer Cartes (rapport 05) appliquées ici : C1, C2 (data-fam),
 * C3, C4, C6, C7, C9, C11, C12 (C5, C8, C10 sont dans style.css).
 */
""")

# --- pixelArtURL + cardSpriteURL (rendu DOM des icônes de cartes) ---
seg, _, _ = between(SRC, "function pixelArtURL", "/* ================= Effets visuels par carte")
seg = seg[:seg.index("var _spriteCache")]  # pawnSpriteURL exclu : Phaser génère ses textures
out.append(seg.rstrip())
out.append("")
seg2, _, _ = between(SRC, "var _cardCache = {};", "/* ================= Effets visuels par carte")
out.append(seg2.rstrip())
out.append("")

# --- cardSceneURL avec C3 (sujet couleur pleine + contour), C4 (teinte dominante), C7 (résolution x2) ---
seg3, _, _ = between(SRC, "var _sceneCache = {};", "function cardNumber")
old_head = """  var def = CARDS[id], fam = def.famille, pal = SCENE_PALETTES[fam];
  var seed = CARD_IDS.indexOf(id) + 7;
  var W = 48, H = 36;
  var canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }"""
new_head = """  var def = CARDS[id], fam = def.famille, pal = SCENE_PALETTES[fam];
  var seed = CARD_IDS.indexOf(id) + 7;
  var W = 48, H = 36;
  // C7 (Designer) : résolution interne doublée (96x72), px() dessine des blocs
  // 2x2 — coordonnées logiques inchangées, affichages courants en multiples entiers.
  var canvas = document.createElement("canvas"); canvas.width = W * 2; canvas.height = H * 2;
  var ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x * 2, y * 2, 2, 2); }"""
assert old_head in seg3
seg3 = seg3.replace(old_head, new_head)
old_subject = """  // Sujet : glyphe de famille agrandi x2, centré, contour sombre
  var map = FAMILY_GLYPHS[fam], main = FAMILY_COLORS[fam];
  for (var sr = 0; sr < 12; sr++) for (var sc = 0; sc < 12; sc++) {
    var ch = map[sr][sc]; if (ch === ".") continue;
    var col = ch === "X" ? "#10101c" : ((sr === 5 || sr === 6) && (sc === 5 || sc === 6) ? def.teinte : main);
    for (var dy2 = 0; dy2 < 2; dy2++) for (var dx2 = 0; dx2 < 2; dx2++) px(12 + sc * 2 + dx2, 5 + sr * 2 + dy2, col);
  }"""
new_subject = """  // Sujet : glyphe de famille agrandi x2, centré.
  // C3 (Designer) : pré-passage silhouette #10101c décalé d'1 px (contour), puis
  // sujet en COULEUR PLEINE — fini le sujet quasi-noir illisible sur ciel sombre.
  // C4 (Designer) : la teinte propre à la carte domine le sujet ; la couleur de
  // famille reste pour l'aura, le décor et le secondaire du glyphe.
  var map = FAMILY_GLYPHS[fam], main = FAMILY_COLORS[fam];
  function glyphPass(offX, offY, colFor) {
    for (var sr = 0; sr < 12; sr++) for (var sc = 0; sc < 12; sc++) {
      var ch = map[sr][sc]; if (ch === ".") continue;
      var col = colFor(ch, sr, sc);
      for (var dy2 = 0; dy2 < 2; dy2++) for (var dx2 = 0; dx2 < 2; dx2++)
        px(12 + sc * 2 + dx2 + offX, 5 + sr * 2 + dy2 + offY, col);
    }
  }
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (off) {
    glyphPass(off[0], off[1], function () { return "#10101c"; });
  });
  glyphPass(0, 0, function (ch, sr, sc) {
    if ((sr === 5 || sr === 6) && (sc === 5 || sc === 6)) return def.teinte;
    return ch === "X" ? def.teinte : main;
  });"""
assert old_subject in seg3
seg3 = seg3.replace(old_subject, new_subject)
out.append(seg3.rstrip())
out.append("")

# --- Sound (inchangé) ---
seg4, _, _ = between(SRC, "var Sound = {", "/* ================= Exports Node")
out.append("/* ================= Sons rétro 8-bit (Web Audio, aucun fichier) ================= */\n")
out.append(seg4.rstrip())
out.append("")

# --- Bloc interface ---
ui, _, _ = between(SRC, "/* ================= Interface navigateur ================= */",
                   "\n/* FIN game.js */") if "/* FIN game.js */" in SRC else (SRC[SRC.index("/* ================= Interface navigateur ================= */"):], "", "")
ui = ui.rstrip()
if ui.endswith("}"):
    pass

def rep(old, new, cnt=1):
    global ui
    assert ui.count(old) >= 1, "INTROUVABLE: " + old[:70]
    ui = ui.replace(old, new, cnt)

# Le plateau DOM disparaît : le conteneur devient celui de Phaser.
rep('    var boardEl = document.getElementById("board");\n', '')

# spawnFx : pont vers Phaser (particules + flash vivent dans le canvas).
spawn, _, _ = between(ui, "    /* ---- Effets visuels par carte (CARD_FX) ---- */", "    function badges(pawn)")
new_spawn = """    /* ---- Effets visuels par carte (CARD_FX) : délégués à Phaser ---- */
    function spawnFx(r, c, fx, big) {
      if (window.WDBoard) { WDBoard.spawnFx(r, c, fx, big); WDBoard.flashCell(r, c); }
    }

"""
ui = ui.replace(spawn, new_spawn)

# badges -> données structurées pour Phaser.
bad, _, _ = between(ui, "    function badges(pawn) {", "    function render() {")
new_badges = """    /* Puces d'état d'un pion, en DONNÉES (Phaser les dessine sur le plateau).
       Mêmes conditions que l'ancien badges() DOM de game.js. */
    function badgesData(pawn) {
      var chips = [];
      function push(t, cls, title) { chips.push({ t: t, cls: cls, title: title }); }
      if (fxOf(pawn, "shield")) push("B", "gold", "Bouclier runique");
      if (fxOf(pawn, "rempart")) push("R", "gold", "Dernier rempart");
      if (fxOf(pawn, "pariProtect")) push("P", "gold", "Protégé (Dernier pari)");
      if (captureProtection(g, pawn) === "aegis") push("É", "gold", "Égide");
      if (hasProp(pawn, "ailes")) push("A", "", "Ailes");
      if (hasProp(pawn, "entrave")) push("E", "red", "Entrave");
      if (fxOf(pawn, "anchored")) push("⚓", "", "Ancré");
      if (fxOf(pawn, "veil")) push("V", "gray", "Voilé");
      if (fxOf(pawn, "silence")) push("S", "gray", "Silence");
      if (fxOf(pawn, "link")) push("L", "blue", "Lié");
      if (fxOf(pawn, "eveille")) push("Év", "gold", "Éveillé");
      if (fxOf(pawn, "spectral")) push("~", "", "Pas spectral prêt");
      if (fxOf(pawn, "passage")) push("M", "", "Marque de passage");
      if (isImmobilised(g, pawn)) push("G", "blue", "Immobilisé ce tour");
      if (pawn.double) push("D", "gray", "Double affaibli");
      return chips;
    }

"""
ui = ui.replace(bad, new_badges)

# renderBoard -> view-model pour Phaser.
rb, _, _ = between(ui, "    function renderBoard() {", "    function renderStatus() {")
new_rb = """    /* Le plateau est dessiné par Phaser : on lui envoie un view-model complet
       (pions + puces, leurres, gardes, pièges visibles du propriétaire, marque
       de soupçon, sélection, arrivées légales, cibles de carte). */
    function renderBoard() {
      var view = {
        pawns: [], decoys: [], guards: [], traps: [],
        selected: ui.selected, targets: [], cardTargets: ui.pendingTargets.slice(),
        phase: g.phase, current: g.current
      };
      ui.moves.forEach(function (m) { view.targets.push({ r: m.toR, c: m.toC, capture: !!m.capture }); });
      var showTrapsFor = g.current; // les pièges ne sont visibles que pour leur propriétaire, pendant SON tour
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var pawn = g.board[r][c];
        if (pawn) {
          var suspicion = false;
          Object.keys(g.suspicion).forEach(function (pl) { if (g.suspicion[pl] === pawn.id) suspicion = true; });
          view.pawns.push({ id: pawn.id, player: pawn.player, shape: pawn.shape, r: r, c: c, chips: badgesData(pawn), suspicion: suspicion });
        }
      }
      g.guards.forEach(function (gd) { view.guards.push({ r: gd.r, c: gd.c }); });
      g.traps.forEach(function (t) { if (t.owner === showTrapsFor && g.phase !== "over") view.traps.push({ r: t.r, c: t.c }); });
      g.decoys.forEach(function (d) { view.decoys.push({ r: d.r, c: d.c, owner: d.owner, shape: d.shape }); });
      var hop = null;
      if (ui.lastFromTo) {
        var destPawn = g.board[ui.lastFromTo.to[0]][ui.lastFromTo.to[1]];
        hop = { from: ui.lastFromTo.from, to: ui.lastFromTo.to, pawnId: destPawn ? destPawn.id : null };
        ui.lastFromTo = null;
      }
      if (window.WDBoard) WDBoard.sync(view, hop);
    }

"""
ui = ui.replace(rb, new_rb)

# cardHTML : C1 (mini réel), C2 (data-fam posé par les appelants), C6 (libellés
# accentués), C9 (noms longs), C11 (bandeau méta cible • durée).
ch, _, _ = between(ui, "    function cardHTML(id, mini) {", "    function renderHands() {")
new_ch = """    /* C6 (Designer) : libellés de famille accentués, affichés tels quels. */
    var FAMILY_LABELS = { mouvement: "Mouvement", defense: "Défense", fusion: "Fusion", piege: "Piège", perturbation: "Perturbation", retour: "Retour" };
    /* C11 (Designer) : libellés courts de cible dérivés du champ cible existant. */
    var TARGET_SHORT = {
      ownPawn: "Ton pion", enemyPawn: "Pion adverse", anyPawn: "Un pion",
      ownPair: "2 de tes pions", enemyPair: "2 pions adverses", emptyCell: "Case vide",
      ownPawnOrCell: "Pion ou case", ownPawnCell: "Pion + case", graveyardCell: "Case de retour",
      ownPawnChoice: "Ton pion", graveyard: "Case de retour",
      none: "—", noneChoice: "—"
    };

    function cardHTML(id, mini) {
      var def = CARDS[id];
      var txt = def.description;
      if (mini) {
        // C1 (Designer) : vraie version compacte — première phrase, ~110 caractères.
        var dot = txt.indexOf(". ");
        if (dot > 0) txt = txt.slice(0, dot + 1);
        if (txt.length > 110) txt = txt.slice(0, 110).trim() + "…";
      }
      var duree = def.duree.length > 22 ? def.duree.slice(0, 22).trim() + "…" : def.duree;
      return '<span class="tc-head"><span class="tc-badge">' + cardNumber(id) + '</span><span class="' +
        (def.nom.length > 14 ? "tc-name tc-name-long" : "tc-name") + '">' + esc(def.nom) + "</span></span>" +
        '<img class="tc-scene" src="' + cardSceneURL(id) + '" alt="">' +
        '<span class="tc-meta">' + esc(TARGET_SHORT[def.cible] || "—") + " • " + esc(duree) + "</span>" +
        '<span class="tc-text">' + esc(txt) + "</span>" +
        '<span class="tc-foot"><img class="tc-fam-icon" src="' + cardSpriteURL(id) + '" alt=""> ' +
        esc(FAMILY_LABELS[def.famille] || def.famille) + (def.bannie ? " · BANNIE après usage" : "") + (def.unique ? " · UNIQUE" : "") + "</span>";
    }

"""
ui = ui.replace(ch, new_ch)

# C2 : data-fam sur les éléments .tc créés par les appelants.
rep('        card.innerHTML = cardHTML(id, true);',
    '        card.setAttribute("data-fam", def.famille);\n        card.innerHTML = cardHTML(id, true);')
rep("""      var h = '<div class="tc tc-big">' + cardHTML(id) + "</div><div class='detail-fields'>" +""",
    """      var h = '<div class="tc tc-big" data-fam="' + def.famille + '">' + cardHTML(id) + "</div><div class='detail-fields'>" +""")

# C12 : étiquette du détail.
rep('"<p><strong>Cible :</strong> " + esc(def.conditions) + "</p>"',
    '"<p><strong>Cible et conditions :</strong> " + esc(def.conditions) + "</p>"')

# Détail §5.2 (2026-10-23) : « Cible » et « Conditions » redeviennent deux
# lignes distinctes — les définitions portent les deux champs séparés
# (cible = code traduit par TARGET_SHORT, conditions = texte propre).
# Le préfixe redondant « Cible : » en tête de certaines conditions est retiré
# à l'affichage seulement ; aucun texte de condition n'est inventé ni modifié.
rep('"<p><strong>Cible et conditions :</strong> " + esc(def.conditions) + "</p>"',
    '"<p><strong>Cible :</strong> " + esc(TARGET_SHORT[def.cible] || "—") + "</p>" +\n        "<p><strong>Conditions :</strong> " + esc(def.conditions.replace(/^Cible : /, "")) + "</p>"')

# onCellClick(r, c) : les clics viennent de Phaser.
rep("""    function onCellClick(ev) {
      var r = parseInt(ev.currentTarget.dataset.r, 10);
      var c = parseInt(ev.currentTarget.dataset.c, 10);
      var pawn = g.board[r][c];""",
    """    function onCellClick(r, c) {
      var pawn = g.board[r][c];""")

# Exposer le handler à Phaser + premier rendu.
idx = ui.rfind("    render();")
assert idx > 0
ui = ui[:idx] + "    window.WDCellClick = onCellClick;\n" + ui[idx:]

out.append(ui)
out.append("")
open("ui-dom.js", "w", encoding="utf-8").write("\n".join(out))
print("ui-dom.js écrit")
