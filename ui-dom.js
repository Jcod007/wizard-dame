"use strict";
/*
 * Wizard Dame — ui-dom.js : couche DOM hybride (migration Phaser, 2026-10-23).
 * Main de cartes, panneau de détail §5.2, journal, indicateur de tour, menus,
 * écran de victoire, passation et bouton Son restent en DOM/CSS (recommandation
 * hybride de l'orchestrateur, synthèse §5) ; le plateau vit dans Phaser
 * (phaser-main.js) via le pont window.WDBoard / window.WDCellClick.
 * Le synthétiseur de sons 8-bit Web Audio est repris tel quel de game.js.
 * Corrections du Designer Cartes (rapport 05) appliquées ici : C1, C2 (data-fam),
 * C3, C4, C6, C7, C9, C11, C12 (C5, C8, C10 sont dans style.css).
 */

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

var _sceneCache = {};
function cardSceneURL(id) {
  if (_sceneCache[id]) return _sceneCache[id];
  if (typeof document === "undefined") return "";
  var def = CARDS[id], fam = def.famille, pal = SCENE_PALETTES[fam];
  var seed = CARD_IDS.indexOf(id) + 7;
  var W = 48, H = 36;
  // C7 (Designer) : résolution interne doublée (96x72), px() dessine des blocs
  // 2x2 — coordonnées logiques inchangées, affichages courants en multiples entiers.
  var canvas = document.createElement("canvas"); canvas.width = W * 2; canvas.height = H * 2;
  var ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x * 2, y * 2, 2, 2); }
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
  // Sujet : glyphe de famille agrandi x2, centré.
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
  });
  var url = canvas.toDataURL();
  _sceneCache[id] = url;
  return url;
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

    /* ---- Effets visuels par carte (CARD_FX) : délégués à Phaser ---- */
    function spawnFx(r, c, fx, big) {
      if (window.WDBoard) { WDBoard.spawnFx(r, c, fx, big); WDBoard.flashCell(r, c); }
    }

    /* Puces d'état d'un pion, en DONNÉES (Phaser les dessine sur le plateau).
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

    function render() {
      renderBoard(); renderStatus(); renderHands(); renderDetail(); renderOverlay(); renderLog();
    }

    /* Le plateau est dessiné par Phaser : on lui envoie un view-model complet
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

    /* C6 (Designer) : libellés de famille accentués, affichés tels quels. */
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
        card.setAttribute("data-fam", def.famille);
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
      var h = '<div class="tc tc-big" data-fam="' + def.famille + '">' + cardHTML(id) + "</div><div class='detail-fields'>" +
        "<p><strong>Cible :</strong> " + esc(TARGET_SHORT[def.cible] || "—") + "</p>" +
        "<p><strong>Conditions :</strong> " + esc(def.conditions.replace(/^Cible : /, "")) + "</p>" +
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

    function onCellClick(r, c) {
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

    window.WDCellClick = onCellClick;
    render();
  });
}
