"use strict";
/*
 * Wizard Dame — ui-dom.js : couche DOM hybride (migration Phaser, 2026-10-23).
 * Main de cartes, panneau de détail §5.2, journal, indicateur de tour, écrans
 * (menu principal, règles, passation, fin de partie) et bouton Son en DOM/CSS ;
 * le plateau vit dans Phaser (phaser-main.js) via window.WDBoard / WDCellClick.
 *
 * Section 12 (pixel art intégral) : toutes les images d'interface — scènes de
 * cartes, sujets uniques par carte, icônes de compteurs, dos de carte, logo,
 * couronne, fond de page — sont dessinées pixel par pixel depuis art.js et
 * engine.js, puis affichées en image-rendering: pixelated. Polices pixel
 * vendorisées (vendor/fonts). Le synthétiseur 8-bit Web Audio est inchangé.
 */

/* ================= Ressources pixel art → images DOM =================
   Toutes les images de l'interface sont dessinées pixel par pixel dans un
   canvas (données d'art.js / engine.js), puis affichées avec
   image-rendering: pixelated — aucun fichier image, aucun lissage. */

function gridURL(grid, scale) {
  if (typeof document === "undefined") return "";
  scale = scale || 1;
  var canvas = document.createElement("canvas");
  canvas.width = grid[0].length * scale; canvas.height = grid.length * scale;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  grid.forEach(function (row, y) { row.forEach(function (col, x) {
    if (col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
  }); });
  return canvas.toDataURL();
}
function mapGrid(sprite) {
  return sprite.map.map(function (row) { return row.split("").map(function (ch) { return sprite.colors[ch] || null; }); });
}

var _urlCache = {};
function cached(key, make) { if (!_urlCache[key]) _urlCache[key] = make(); return _urlCache[key]; }

function spriteURL(name) { return cached("ui-" + name, function () { return gridURL(mapGrid(UI_SPRITES[name])); }); }
function pawnURL(player, shape) { return cached("pawn-" + player + shape, function () { return gridURL(pieceSprite(shape, player)); }); }

/* Icône de famille (pied de carte) : glyphe 12x12 de la famille, contouré. */
function cardSpriteURL(id) {
  var def = CARDS[id];
  return cached("fam-" + def.famille, function () {
    var main = FAMILY_COLORS[def.famille];
    var map = FAMILY_GLYPHS[def.famille].map(function (r) { return "." + r + "."; });
    map.unshift(".............."); map.push("..............");
    return gridURL(outlinedPixels(map, function (ch) { return ch === "X" ? main : null; }));
  });
}

/* Illustration de carte (G1) : SCÈNE 32x24 sur UNE seule grille de pixels —
   décor de la famille, tramage à tons durs, aura magique pointillée, runes
   flottantes et le SUJET ORIGINAL 16x16 propre à la carte (art.js), grand et
   centré. Résolution interne x3 (96x72) pour un affichage net. */
function cardSceneURL(id) {
  return cached("scene-" + id, function () {
    if (typeof document === "undefined") return "";
    var def = CARDS[id], fam = def.famille, pal = SCENE_PALETTES[fam];
    var seed = CARD_IDS.indexOf(id) + 7, W = 32, H = 24, S = 3;
    var canvas = document.createElement("canvas"); canvas.width = W * S; canvas.height = H * S;
    var ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
    function px(x, y, col) { if (x < 0 || y < 0 || x >= W || y >= H || !col) return; ctx.fillStyle = col; ctx.fillRect(x * S, y * S, S, S); }
    var x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) { // ciel en bandes dures + tramage
      var band = y < 7 ? pal.sky[0] : (y < 13 ? pal.sky[1] : pal.sky[2]);
      if (y >= 19) band = (x + y) % 2 && artHash(x, y, seed) < 0.3 ? pal.decor : pal.ground;
      else if ((x + y) % 2 === 0 && artHash(x, y, seed) < 0.14) band = pal.decor;
      px(x, y, band);
    }
    if (fam === "piege" || fam === "perturbation" || fam === "retour") // étoiles
      for (var st = 0; st < 6; st++) px(Math.floor(artHash(st, 1, seed) * W), Math.floor(artHash(1, st, seed) * 9), "#fff7d6");
    if (fam === "defense") { // piliers de temple
      [1, 27].forEach(function (x0) {
        for (y = 4; y < 19; y++) for (x = x0; x < x0 + 4; x++) px(x, y, x === x0 ? "#5a6890" : (x === x0 + 3 ? "#232b47" : "#3c4666"));
        for (x = x0 - 1; x < x0 + 5; x++) { px(x, 3, "#5a6890"); px(x, 19, "#232b47"); }
      });
    } else if (fam === "mouvement") { // montagnes enneigées + chemin
      for (x = 0; x < W; x++) {
        var mh = 5 + Math.round(4 * Math.abs(Math.sin(x / 4 + seed)));
        for (y = 0; y < mh; y++) px(x, 18 - y, y === mh - 1 ? "#d8e6c8" : ((x + y) % 2 ? "#33502f" : "#2a4428"));
      }
      for (y = 19; y < H; y++) for (x = 12; x < 20; x++) if (Math.abs(x - 15.5) < (y - 17)) px(x, y, (x + y) % 2 ? "#8a7a52" : "#7a6a44");
    } else if (fam === "fusion") { // cristaux
      [[2, 19, 6], [28, 19, 5], [5, 19, 3], [25, 19, 3]].forEach(function (cp) {
        for (var i = 0; i < cp[2]; i++) { px(cp[0], cp[1] - i, "#e879f9"); px(cp[0] + 1, cp[1] - i, i === cp[2] - 1 ? "#f5d0fe" : "#a21caf"); }
      });
    } else if (fam === "piege") { // forêt sombre
      [[1, 3], [28, 2]].forEach(function (t) {
        for (y = 8; y < 20; y++) { px(t[0], y, "#0d1a10"); px(t[0] + 1, y, "#16301a"); }
        for (y = 2; y < 10; y++) for (x = t[0] - t[1]; x <= t[0] + t[1] + 1; x++) if (Math.abs(x - t[0] - 0.5) + Math.abs(y - 6) < 5) px(x, y, (x + y) % 2 ? "#14301c" : "#0f2416");
      });
    } else if (fam === "perturbation") { // nuages d'orage + éclair
      for (x = 0; x < W; x++) for (y = 0; y < 3; y++) if (artHash(x, y, 9) < 0.7 - y * 0.2) px(x, y, "#3a4a63");
      var lx = 2 + (seed % 3);
      [[0, 0], [0, 1], [1, 2], [1, 3], [2, 4], [1, 5], [2, 6], [3, 7], [3, 8]].forEach(function (p) { px(lx + p[0], 3 + p[1], "#fef08a"); px(lx + p[0] + 1, 3 + p[1], "#facc15"); });
    } else if (fam === "retour") { // lune + arche
      for (y = 1; y < 7; y++) for (x = 24; x < 31; x++) if ((x - 27) * (x - 27) + (y - 3.5) * (y - 3.5) < 7) px(x, y, (x === 25 || y === 2) ? "#fffbea" : "#f5f0dc");
      for (y = 6; y < 19; y++) { px(4, y, "#4a2c50"); px(5, y, "#5e3a66"); px(26, y, "#4a2c50"); px(27, y, "#5e3a66"); }
      for (x = 4; x < 28; x++) px(x, 5, "#5e3a66");
    }
    // Aura magique : deux ellipses pointillées (teinte de la carte, accent de famille)
    [[12, 10, def.teinte], [14, 11, pal.accent]].forEach(function (ring, ri) {
      for (var a = 0; a < 72; a++) {
        if ((a + ri * 2) % 4 === 0) continue;
        var ang = a / 72 * Math.PI * 2;
        px(Math.round(15.5 + Math.cos(ang) * ring[0]), Math.round(11 + Math.sin(ang) * ring[1]), ring[2]);
      }
    });
    // Runes flottantes
    [[1, 1], [28, 1], [1, 12], [28, 12]].forEach(function (sp, ri) {
      var glyphR = RUNE_MINI[(seed + ri) % RUNE_MINI.length];
      for (var ry = 0; ry < 5; ry++) for (var rx = 0; rx < 3; rx++)
        if (glyphR[ry][rx] === "#") px(sp[0] + rx, sp[1] + ry, ri % 2 ? def.teinte : "#f5c542");
    });
    // Ombre portée puis sujet original 16x16
    for (x = 10; x < 22; x++) px(x, 19, "#0b0714");
    for (x = 12; x < 20; x++) px(x, 20, "#0b0714");
    subjectPixels(id, def.teinte).forEach(function (row, sy) { row.forEach(function (col, sx) { px(8 + sx, 3 + sy, col); }); });
    return canvas.toDataURL();
  });
}

/* Fond de page : tuile 32x32 de ciel nocturne tramé, étoiles pixel. */
function backgroundURL() {
  return cached("bg", function () {
    var grid = [];
    for (var y = 0; y < 32; y++) { grid.push([]); for (var x = 0; x < 32; x++) {
      var col = "#120d1f";
      if ((x + y) % 2 === 0 && artHash(x, y, 3) < 0.25) col = "#18112b";
      grid[y].push(col);
    } }
    [[4, 6, "#fff7d6"], [21, 3, "#b79cff"], [27, 19, "#fff7d6"], [11, 25, "#7dd3fc"], [16, 14, "#3b2f5c"]].forEach(function (s) { grid[s[1]][s[0]] = s[2]; });
    grid[6][3] = grid[6][5] = grid[5][4] = grid[7][4] = "#5b4a9e";
    return gridURL(grid);
  });
}

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

/* ================= Interface navigateur ================= */

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var turnEl = document.getElementById("turn");
    var turnPawnEl = document.getElementById("turn-pawn");
    var stepsEl = document.getElementById("steps");
    var countersEl = document.getElementById("counters");
    var phaseEl = document.getElementById("phase-hint");
    var handEl = document.getElementById("hand");
    var oppHandEl = document.getElementById("opp-hand");
    var logEl = document.getElementById("log");
    var detailEl = document.getElementById("card-detail");
    var overlayEl = document.getElementById("overlay");
    var vicEl = document.getElementById("victory");
    var bannerEl = document.getElementById("board-banner");
    var deployEl = document.getElementById("deploy-panel");

    var gameSeq = 0;
    var gameSeed = Date.now() % 100000;
    var g = createGame(gameSeed, { deploy: true }); // placement libre et secret
    gameSeq++;
    function freshUi(screen) {
      return { selected: null, moves: [], pendingCard: null, pendingTargets: [], pendingChoices: {},
               lastFromTo: null, inspectId: null, screen: screen, victorySeen: false, started: screen === null, reserveSel: 0 };
    }
    var ui = freshUi("menu");

    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function img(src, cls, alt) { return '<img class="' + cls + '" src="' + src + '" alt="' + esc(alt || "") + '">'; }

    /* Fond de page et icônes fixes, en pixel art généré. */
    document.body.style.backgroundImage = "url(" + backgroundURL() + ")";
    document.querySelectorAll("[data-sprite]").forEach(function (el2) { el2.src = spriteURL(el2.getAttribute("data-sprite")); });
    var favicon = document.createElement("link"); // favicon : le chapeau, en pixel art
    favicon.rel = "icon"; favicon.href = gridURL(mapGrid(UI_SPRITES.hat), 2);
    document.head.appendChild(favicon);

    /* ---- Sons : initialisation paresseuse au premier geste ---- */
    document.addEventListener("pointerdown", function () { Sound.ensure(); }, { once: true });
    function soundLabel() {
      return img(spriteURL(Sound.enabled ? "speakerOn" : "speakerOff"), "btn-icon", "") + (Sound.enabled ? "SON : OUI" : "SON : NON");
    }
    function refreshSoundBtns() { document.querySelectorAll(".sound-toggle").forEach(function (b) { b.innerHTML = soundLabel(); }); }
    function toggleSound() {
      Sound.enabled = !Sound.enabled; Sound.ensure(); refreshSoundBtns();
      if (Sound.enabled) Sound.play("select");
    }
    document.getElementById("sound-toggle").addEventListener("click", toggleSound);
    document.getElementById("menu-btn").addEventListener("click", function () { ui.screen = "menu"; Sound.play("select"); render(); });

    /* ---- Effets visuels par carte (CARD_FX) : délégués à Phaser ---- */
    function spawnFx(r, c, fx, big) {
      if (window.WDBoard) { WDBoard.spawnFx(r, c, fx, big); WDBoard.flashCell(r, c); }
    }

    /* ---- Bannières sur le plateau : changement de tour, carte lancée ----
       Elles glissent en pas discrets (steps) et disparaissent d'un bloc. */
    var bannerTimer = null;
    function showBanner(html, kind) {
      if (!bannerEl) return;
      bannerEl.className = "board-banner";
      void bannerEl.offsetWidth; // relance l'animation
      bannerEl.innerHTML = html;
      bannerEl.className = "board-banner show " + (kind || "");
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(function () { bannerEl.className = "board-banner"; }, 1400);
    }
    function turnBanner() {
      showBanner(img(pawnURL(g.current, "mage"), "banner-pawn", "") + "<span>TOUR DU JOUEUR " + g.current + "</span>", "p" + g.current);
    }
    function castBanner(id) {
      // Posée côté adversaire (J1 joue en bas → bannière en haut) pour ne pas
      // masquer l'effet sur ses propres pions.
      showBanner(img(cardSceneURL(id), "banner-card", "") + "<span><small>Carte jouée</small>" + esc(CARDS[id].nom) + "</span>", "cast " + (g.current === 1 ? "at-top" : "at-bottom"));
    }

    /* Puces d'état d'un pion, en DONNÉES (Phaser les dessine en sprites 5x7). */
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

    /* Joueur qui prépare en secret (placement ou pièce essentielle), sinon 0. */
    function setupPlayer() {
      var m = /^(deploy|select)([12])$/.exec(g.phase);
      return m ? parseInt(m[2], 10) : 0;
    }

    function render() {
      renderBoard(); renderStatus(); renderDeploy(); renderHands(); renderDetail(); renderOverlay(); renderLog();
    }

    /* Panneau de placement : réserve de personnages (clic = prochain à poser),
       placement au hasard, validation quand les 12 sont posés. */
    function renderDeploy() {
      var pl = /^deploy([12])$/.exec(g.phase);
      if (!pl) { deployEl.innerHTML = ""; deployEl.style.display = "none"; return; }
      pl = parseInt(pl[1], 10);
      var res = g.reserve[pl];
      if (ui.reserveSel >= res.length) ui.reserveSel = 0;
      deployEl.style.display = "block";
      deployEl.innerHTML = '<p class="deploy-count">' + (PIECES_PER_PLAYER - res.length) + " / " + PIECES_PER_PLAYER + " pions placés" +
        (res.length ? " — prochain : <b>" + esc(pieceName(res[ui.reserveSel].shape)) + "</b>" : "") + "</p>" +
        '<div class="reserve">' + res.map(function (p, i) {
          return '<button type="button" class="reserve-pawn' + (i === ui.reserveSel ? " on" : "") + '" data-i="' + i + '" title="' + esc(pieceName(p.shape)) + '">' +
            img(pawnURL(pl, p.shape), "reserve-img", pieceName(p.shape)) + "</button>";
        }).join("") + "</div>" +
        '<p class="deploy-actions">' +
        (res.length ? '<button type="button" id="deploy-auto">PLACER LE RESTE AU HASARD</button>' : "") +
        '<button type="button" id="deploy-done" class="' + (res.length ? "" : "btn-gold") + '"' + (res.length ? " disabled" : "") + ">VALIDER LE PLACEMENT</button></p>";
      deployEl.querySelectorAll(".reserve-pawn").forEach(function (b) {
        b.addEventListener("click", function () { ui.reserveSel = parseInt(b.dataset.i, 10); Sound.play("select"); renderDeploy(); });
      });
      bind("deploy-auto", function () { autoDeploy(g, pl); Sound.play("move"); render(); });
      bind("deploy-done", function () {
        var r = finishDeploy(g, pl);
        if (!r.ok) { Sound.play("invalid"); logUi(r.error); return; }
        logUi("Joueur " + pl + " : placement terminé. Choisis maintenant ta pièce essentielle.");
        Sound.play("shield"); render();
      });
    }

    function renderBoard() {
      var view = {
        gameId: gameSeq, terrainSeed: gameSeed, zone: [],
        pawns: [], decoys: [], guards: [], traps: [],
        selected: ui.selected, targets: [], cardTargets: ui.pendingTargets.slice(),
        phase: g.phase, current: g.current
      };
      ui.moves.forEach(function (m) { view.targets.push({ r: m.toR, c: m.toC, capture: !!m.capture }); });
      // Préparation secrète : seul le joueur qui prépare voit SES pions.
      var prep = setupPlayer();
      if (prep && g.phase === "deploy" + prep && g.reserve[prep].length)
        deployRows(prep).forEach(function (zr) { for (var zc = 0; zc < 8; zc++) if (!g.board[zr][zc]) view.zone.push({ r: zr, c: zc }); });
      var showTrapsFor = g.current; // pièges visibles de leur propriétaire seulement, pendant SON tour
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var pawn = g.board[r][c];
        if (pawn && !(g.phase === "handover" || (prep && pawn.player !== prep))) {
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

    /* Indicateur de tour, étapes et compteurs : tout en icônes pixel. */
    function renderStatus() {
      var who = g.current === 1 ? "JOUEUR 1 · VIOLET" : "JOUEUR 2 · ORANGE";
      if (g.phase === "over") turnEl.textContent = "FIN DE PARTIE";
      else if (g.phase.indexOf("deploy") === 0) turnEl.textContent = "PLACEMENT SECRET — J" + setupPlayer();
      else if (g.phase.indexOf("select") === 0) turnEl.textContent = "PIECE ESSENTIELLE — J" + setupPlayer();
      else if (g.phase === "handover") turnEl.textContent = "PASSATION…";
      else turnEl.textContent = "TOUR DU " + who;
      var turnPlayer = g.phase === "over" ? g.winner : (setupPlayer() || g.current);
      turnEl.className = "turn p" + turnPlayer;
      turnPawnEl.src = pawnURL(turnPlayer || 1, "mage");

      var inGame = g.phase === "move" || g.phase === "card";
      var inSetup = g.phase.indexOf("deploy") === 0 || g.phase.indexOf("select") === 0;
      stepsEl.innerHTML = inSetup
        ? '<span class="step' + (g.phase.indexOf("deploy") === 0 ? " on" : " done") + '">1 · PLACER</span>' +
          '<span class="step' + (g.phase.indexOf("select") === 0 ? " on" : "") + '">2 · PIÈCE ESSENTIELLE</span>'
        : inGame
        ? '<span class="step' + (g.phase === "move" ? " on" : " done") + '">1 · DÉPLACER</span>' +
          '<span class="step' + (g.phase === "card" ? " on" : "") + '">2 · CARTE</span>'
        : "";
      phaseEl.textContent =
        g.phase === "move" ? "Déplace un pion : 1 case dans les 8 directions, ou capture par saut (non obligatoire)." :
        g.phase === "card" ? "Tu peux jouer 1 carte de ta main, ou terminer ton tour." :
        g.phase.indexOf("deploy") === 0 ? "Pose tes 12 pions où tu veux dans tes 3 rangées (zone dorée). Clique un pion posé pour le reprendre. L'adversaire ne voit rien." :
        g.phase.indexOf("select") === 0 ? "Clique un de tes pions : ce sera ta pièce essentielle secrète." : "";

      countersEl.innerHTML =
        '<span class="ctr" title="Captures">' + img(spriteURL("swords"), "ctr-icon", "Captures") +
          '<b class="p1">' + g.captured[1] + '</b>·<b class="p2">' + g.captured[2] + "</b></span>" +
        '<span class="ctr" title="Pions en jeu">' + img(pawnURL(1, "chevalier"), "ctr-icon", "") + "<b>" + countPawns(g, 1) + "</b>" +
          img(pawnURL(2, "chevalier"), "ctr-icon", "") + "<b>" + countPawns(g, 2) + "</b></span>" +
        '<span class="ctr" title="Pioche du joueur courant">' + img(spriteURL("deck"), "ctr-icon", "Pioche") + "<b>" + g.decks[g.current].length + "</b></span>" +
        '<span class="ctr" title="Défausse du joueur courant">' + img(spriteURL("discard"), "ctr-icon", "Défausse") + "<b>" + g.discards[g.current].length + "</b></span>";

      vicEl.style.display = g.phase === "over" ? "flex" : "none";
      if (g.phase === "over") vicEl.innerHTML = img(spriteURL("crown"), "vic-crown", "") + "<span>VICTOIRE DU JOUEUR " + g.winner + " — " + esc(g.winReason || "") + "</span>";
      document.getElementById("end-turn").style.display = g.phase === "card" ? "inline-flex" : "none";
      document.querySelector(".reveal-zone").style.display = (g.phase.indexOf("deploy") === 0 || g.phase.indexOf("select") === 0 || g.phase === "handover") ? "none" : "flex";
    }

    var FAMILY_LABELS = { mouvement: "Mouvement", defense: "Défense", fusion: "Fusion", piege: "Piège", perturbation: "Perturbation", retour: "Retour" };
    var TARGET_SHORT = {
      ownPawn: "Ton pion", enemyPawn: "Pion adverse", anyPawn: "Un pion",
      ownPair: "2 de tes pions", enemyPair: "2 pions adverses", emptyCell: "Case vide",
      ownPawnOrCell: "Pion ou case", ownPawnCell: "Pion + case", graveyardCell: "Case de retour",
      ownPawnChoice: "Ton pion", graveyard: "Case de retour",
      anyPawnOrCell: "Pion ou case", ownPawnSacrifice: "Ton pion", pariChoice: "Selon le choix",
      none: "—", noneChoice: "—"
    };

    function cardHTML(id, mini) {
      var def = CARDS[id];
      var txt = def.description;
      if (mini) {
        var dot = txt.indexOf(". ");
        if (dot > 0) txt = txt.slice(0, dot + 1);
        if (txt.length > 110) txt = txt.slice(0, 110).trim() + "…";
      }
      var duree = def.duree.length > 22 ? def.duree.slice(0, 22).trim() + "…" : def.duree;
      return '<span class="tc-head"><span class="tc-badge">' + cardNumber(id) + '</span><span class="' +
        (def.nom.length > 14 ? "tc-name tc-name-long" : "tc-name") + '">' + esc(def.nom) + "</span></span>" +
        '<span class="tc-window"><img class="tc-scene" src="' + cardSceneURL(id) + '" alt=""></span>' +
        '<span class="tc-meta">' + esc(TARGET_SHORT[def.cible] || "—") + " • " + esc(duree) + "</span>" +
        '<span class="tc-text">' + esc(txt) + "</span>" +
        '<span class="tc-foot"><img class="tc-fam-icon" src="' + cardSpriteURL(id) + '" alt=""> ' +
        esc(FAMILY_LABELS[def.famille] || def.famille) + (def.bannie ? " · BANNIE" : "") + (def.unique ? " · UNIQUE" : "") + "</span>";
    }

    function renderHands() {
      var opp = g.current === 1 ? 2 : 1;
      oppHandEl.innerHTML = "<span>Main du Joueur " + opp + " (cachée) :</span> " +
        g.hands[opp].map(function () { return img(spriteURL("cardBack"), "card-back", "carte cachée"); }).join("");
      handEl.innerHTML = "";
      if (g.phase !== "move" && g.phase !== "card") { handEl.innerHTML = '<p class="note">Les mains apparaîtront quand la partie commencera.</p>'; return; }
      g.hands[g.current].forEach(function (id, i) {
        var def = CARDS[id];
        var card = document.createElement("button");
        card.type = "button";
        var unplayable = g.phase !== "card" || g.cardPlayedThisTurn || cardPrecheck(g, id);
        card.className = "tc" + (ui.pendingCard === i ? " tc-selected" : "") + (unplayable ? " tc-off" : "");
        card.setAttribute("data-fam", def.famille);
        card.innerHTML = cardHTML(id, true);
        card.title = def.nom + " — " + def.description;
        card.addEventListener("click", function () { onCardClick(i); });
        handEl.appendChild(card);
      });
      if (!g.hands[g.current].length) handEl.innerHTML = '<p class="note">Main vide.</p>';
    }

    function targetsNeeded(id) {
      // Dernier pari, mode « déplacement de 2 cases » : 2 cibles (le pion PUIS la case).
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

    function choiceBtn(on, data, label) {
      return '<button type="button" class="choice' + (on ? " choice-on" : "") + '" data-choice="' + data + '">' + label + "</button>";
    }

    function renderDetail() {
      if (ui.pendingCard === null || g.phase !== "card") {
        detailEl.innerHTML = g.phase === "card" && !g.cardPlayedThisTurn
          ? '<p class="note">Clique une carte de ta main pour voir ses détails (cible, conditions, coût, risque, durée) avant de la jouer.</p>' : "";
        return;
      }
      var id = g.hands[g.current][ui.pendingCard];
      var def = CARDS[id];
      var h = '<div class="detail-wrap"><div class="tc tc-big" data-fam="' + def.famille + '">' + cardHTML(id) + "</div><div class='detail-fields px-box'>" +
        "<p><strong>Cible :</strong> " + esc(TARGET_SHORT[def.cible] || "—") + "</p>" +
        "<p><strong>Conditions :</strong> " + esc(def.conditions.replace(/^Cible : /, "")) + "</p>" +
        "<p><strong>Effet :</strong> " + esc(def.description) + "</p>" +
        "<p><strong>Coût :</strong> " + esc(def.cout) + "</p>" +
        "<p><strong>Risque :</strong> " + esc(def.risque) + "</p>" +
        "<p><strong>Durée :</strong> " + esc(def.duree) + "</p>";
      if (id === "mutation") {
        h += "<p><strong>Propriété (choisis) :</strong> " + MUTATION_POOL.map(function (pid) {
          return choiceBtn(ui.pendingChoices.propId === pid, "prop:" + pid, PROPERTY_CATALOG[pid].nom + " — " + esc(PROPERTY_CATALOG[pid].description));
        }).join(" ") + "</p>";
      }
      if (id === "dernier_pari") {
        h += "<p><strong>Mode :</strong> " + choiceBtn(ui.pendingChoices.pariMode === "move2", "pari:move2", "Déplacer de 2 cases") + " " +
          choiceBtn(ui.pendingChoices.pariMode === "protect", "pari:protect", "Protéger 1 tour") + "</p>";
      }
      if (id === "interference") {
        h += "<p><strong>Carte à révéler :</strong> " + g.hands[g.current].map(function (cid, ix) {
          return choiceBtn(ui.pendingChoices.revealIndex === ix, "reveal:" + ix, esc(CARDS[cid].nom));
        }).join(" ") + "</p>" +
          "<p><strong>Adversaire — passe-lui l'appareil : quelle carte défausses-tu ?</strong> " + g.hands[g.current === 1 ? 2 : 1].map(function (_, ix) {
          return choiceBtn(ui.pendingChoices.oppDiscardIndex === ix, "oppdisc:" + ix, "Carte n°" + (ix + 1) + " de ta main");
        }).join(" ") + "</p>";
      }
      if (id === "resurrection") {
        h += "<p><strong>Pion à ressusciter :</strong> " + g.graveyard[g.current].map(function (dp, ix) {
          return choiceBtn(ui.pendingChoices.graveyardIndex === ix, "grave:" + ix, img(pawnURL(g.current, dp.shape), "choice-pawn", "") + esc(pieceName(dp.shape)));
        }).join(" ") + "</p>";
      }
      if (id === "dernier_rempart") {
        h += "<p class='note'>Si ta cible est ta pièce essentielle, choisis aussi la carte à sacrifier :</p><p>" +
          g.hands[g.current].map(function (cid, ix) {
            if (ix === ui.pendingCard) return "";
            return choiceBtn(ui.pendingChoices.discardHandIndex === ix, "sac:" + ix, esc(CARDS[cid].nom));
          }).join(" ") + "</p>";
      }
      var need = targetsNeeded(id);
      h += "<p><strong>Cibles choisies :</strong> " + ui.pendingTargets.length + " / " + need +
        (need ? " — clique les cases/pions sur le plateau." : " — aucun clic de cible requis.") + "</p>" +
        '<p class="detail-actions"><button type="button" id="confirm-card" class="btn-gold">CONFIRMER LA CARTE</button> ' +
        '<button type="button" id="cancel-card">ANNULER</button></p></div></div>';
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
      castBanner(id);
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

    function newGame() {
      gameSeed = Date.now() % 100000;
      g = createGame(gameSeed, { deploy: true });
      gameSeq++;
      ui = freshUi(null);
      Sound.play("turn");
      render();
    }

    /* ---- Écrans : menu principal, règles, passation, fin de partie ---- */
    function pawnParade() {
      return SHAPES.map(function (sh, i) { return img(pawnURL(i % 2 ? 2 : 1, sh), "parade-pawn", sh); }).join("");
    }
    function bind(id, fn) { var b = document.getElementById(id); if (b) b.addEventListener("click", fn); }

    function renderOverlay() {
      var html = null;
      if (ui.screen === "menu") {
        html = '<div class="screen menu-screen px-box">' +
          img(spriteURL("hat"), "logo-hat", "") +
          '<h1 class="logo">WIZARD<br>DAME</h1>' +
          '<p class="logo-sub">Dames · Cartes · Bluff · Magie</p>' +
          '<div class="parade">' + pawnParade() + "</div>" +
          '<div class="menu-buttons">' +
          (ui.started && g.phase !== "over" ? '<button type="button" id="menu-continue" class="btn-gold">CONTINUER</button>' : "") +
          '<button type="button" id="menu-play" class="' + (ui.started && g.phase !== "over" ? "" : "btn-gold") + '">NOUVELLE PARTIE</button>' +
          '<button type="button" id="menu-rules">COMMENT JOUER</button>' +
          '<button type="button" class="sound-toggle" id="menu-sound"></button>' +
          "</div>" +
          '<p class="proto">Prototype v0.2 — certaines cartes sont provisoires (voir le README).</p></div>';
      } else if (ui.screen === "rules") {
        html = '<div class="screen rules-screen px-box"><h2 class="screen-title">COMMENT JOUER</h2>' +
          '<div class="rules-body">' + document.getElementById("help-content").innerHTML + "</div>" +
          '<button type="button" id="rules-back" class="btn-gold">RETOUR</button></div>';
      } else if (g.phase === "handover") {
        html = '<div class="screen handover-screen px-box opaque">' + img(spriteURL("hat"), "screen-icon", "") +
          '<h2 class="screen-title">PASSE L\'APPAREIL<br>AU JOUEUR 2</h2>' +
          "<p>Le Joueur 1 a choisi sa pièce essentielle en secret. Joueur 2, à toi de choisir la tienne — l'autre joueur ne regarde pas !</p>" +
          '<div class="parade">' + img(pawnURL(2, "mage"), "parade-pawn", "") + "</div>" +
          '<button type="button" id="handover-ok" class="btn-gold">JE SUIS LE JOUEUR 2</button></div>';
      } else if (g.phase === "over" && !ui.victorySeen) {
        var ess = null;
        for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = g.board[r][c]; if (p && p.player === g.winner && p.essential) ess = p; }
        html = '<div class="screen victory-screen px-box p' + g.winner + '">' +
          img(spriteURL("crown"), "vic-crown-big", "") +
          '<h2 class="victory-title">VICTOIRE !</h2>' +
          '<div class="victory-pawn">' + img(pawnURL(g.winner, ess ? ess.shape : "mage"), "victory-pawn-img", "") + "</div>" +
          '<p class="victory-who">JOUEUR ' + g.winner + (g.winner === 1 ? " · VIOLET" : " · ORANGE") + "</p>" +
          '<p class="victory-reason">' + esc(g.winReason || "") + ".</p>" +
          '<div class="victory-stats">' +
            '<span class="ctr">' + img(spriteURL("swords"), "ctr-icon", "") + "Captures <b class='p1'>" + g.captured[1] + "</b>·<b class='p2'>" + g.captured[2] + "</b></span>" +
            '<span class="ctr">Manches <b>' + g.round + "</b></span></div>" +
          '<div class="menu-buttons">' +
          '<button type="button" id="vic-again" class="btn-gold">REVANCHE</button>' +
          '<button type="button" id="vic-board">VOIR LE PLATEAU</button>' +
          '<button type="button" id="vic-menu">MENU PRINCIPAL</button></div></div>';
      }
      if (html === null) { overlayEl.style.display = "none"; overlayEl.innerHTML = ""; return; }
      overlayEl.style.display = "flex";
      overlayEl.innerHTML = html;
      refreshSoundBtns();
      bind("menu-play", newGame);
      bind("menu-continue", function () { ui.screen = null; Sound.play("select"); render(); });
      bind("menu-rules", function () { ui.screen = "rules"; Sound.play("select"); render(); });
      bind("menu-sound", toggleSound);
      bind("rules-back", function () { ui.screen = ui.started ? null : "menu"; Sound.play("select"); render(); });
      bind("handover-ok", function () { passDevice(g); ui.reserveSel = 0; Sound.play("turn"); render(); });
      bind("vic-again", newGame);
      bind("vic-board", function () { ui.victorySeen = true; render(); });
      bind("vic-menu", function () { ui.victorySeen = true; ui.screen = "menu"; render(); });
    }

    function onCellClick(r, c) {
      if (ui.screen) return;
      var pawn = g.board[r][c];
      Sound.ensure();

      if (g.phase === "deploy1" || g.phase === "deploy2") {
        var dp = g.phase === "deploy1" ? 1 : 2;
        if (pawn && pawn.player === dp) { undeployPawn(g, dp, r, c); Sound.play("select"); render(); return; }
        var dres = deployPawn(g, dp, r, c, ui.reserveSel || 0);
        if (!dres.ok) { Sound.play("invalid"); logUi(dres.error); return; }
        Sound.play("move");
        if (ui.reserveSel >= g.reserve[dp].length) ui.reserveSel = 0;
        render();
        return;
      }
            if (g.phase === "select1" || g.phase === "select2") {
        var pl = g.phase === "select1" ? 1 : 2;
        if (!pawn || pawn.player !== pl) { Sound.play("invalid"); logUi("Joueur " + pl + " : clique un de TES pions de départ."); return; }
        var res = chooseEssential(g, pl, pawn.id);
        if (!res.ok) { Sound.play("invalid"); logUi(res.error); return; }
        Sound.play("shield");
        logUi("Pièce essentielle du Joueur " + pl + " choisie en secret.");
        if (pl === 2) { logUi("La partie commence ! Joueur 1, à toi."); turnBanner(); }
        render();
        return;
      }
      if (g.phase !== "move" && g.phase !== "card") return;

      if (ui.pendingCard !== null) {
        ui.pendingTargets.push({ r: r, c: c });
        var need = targetsNeeded(g.hands[g.current][ui.pendingCard]);
        if (ui.pendingTargets.length > need) ui.pendingTargets.shift();
        Sound.play("select");
        render();
        return;
      }

      if (pawn && pawn.player !== g.current && g.phase === "move" && !ui.selected) {
        var veiled = !!fxOf(pawn, "veil");
        if (veiled) logUi(pieceName(pawn.shape) + " adverse : ses propriétés sont VOILÉES.");
        else if (pawn.props.length) logUi(pieceName(pawn.shape) + " adverse — propriétés : " + pawn.props.map(function (p) { return PROPERTY_CATALOG[p.id].nom + (p.silenced ? " (réduite au silence)" : ""); }).join(", ") + ".");
        else logUi(pieceName(pawn.shape) + " adverse : aucune propriété.");
        ui.inspectId = pawn.id;
        return;
      }

      if (g.phase !== "move") return;

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
      if (g.phase === "move") turnBanner();
      render();
    });
    document.getElementById("new-game").addEventListener("click", newGame);

    /* Révélation privée : maintenir le bouton pour voir SA pièce essentielle et la Sonde. */
    var revealBtn = document.getElementById("reveal");
    function showReveal() {
      var ess = null;
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var p = g.board[r][c];
        if (p && p.player === g.current && p.essential) ess = [r, c];
      }
      var txt = ess ? ("Ta pièce essentielle est en " + "ABCDEFGH"[ess[1]] + (8 - ess[0]) + " (" + pieceName(g.board[ess[0]][ess[1]].shape) + ").") : "Aucune pièce essentielle trouvée.";
      if (g.suspicion[g.current]) txt += " Ta marque de soupçon est posée sur un pion non essentiel.";
      var si = g.sondeInfo[g.current];
      if (si) txt += " Sonde : la pièce essentielle adverse est dans la moitié " + si.half + " du plateau.";
      document.getElementById("reveal-text").textContent = txt;
    }
    revealBtn.addEventListener("pointerdown", showReveal);
    revealBtn.addEventListener("pointerup", function () { document.getElementById("reveal-text").textContent = ""; });
    revealBtn.addEventListener("pointerleave", function () { document.getElementById("reveal-text").textContent = ""; });

    window.WDCellClick = onCellClick;
    window.WDDebug = { game: function () { return g; } }; // lecture seule, pour les tests navigateur
    refreshSoundBtns();
    render();
  });
}
