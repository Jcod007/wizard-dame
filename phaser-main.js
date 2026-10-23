"use strict";
/*
 * Wizard Dame — phaser-main.js : rendu du PLATEAU sous Phaser 3.60.0.
 * Aucune logique de jeu ici : les règles vivent dans engine.js, l'UI cartes /
 * menus dans ui-dom.js, les ressources pixel art dans art.js.
 *
 * Section 12 (direction artistique) — grille de pixels STRICTE :
 *   - le plateau est rendu à sa résolution logique réelle : 144x144 px
 *     (cadre de 8 px + 8 cases de 16 px). Un pixel d'art = un pixel logique ;
 *   - tout est posé sur cette grille : dalles 16x16, pions 16x16, marqueurs,
 *     puces, surbrillances, particules (1 ou 2 px), positions entières ;
 *   - l'agrandissement est un multiple ENTIER de pixels physiques
 *     (zoom = n / devicePixelRatio), recalculé au redimensionnement :
 *     aucun pixel inégal, aucun flou, aucun anticrénelage ;
 *   - toutes les animations avancent image par image (pas discrets).
 *
 * Pont avec ui-dom.js :
 *   - ui-dom appelle WDBoard.sync(view, hop) après chaque rendu ;
 *   - les clics sur les cases remontent par window.WDCellClick(r, c) ;
 *   - ui-dom appelle WDBoard.spawnFx / WDBoard.flashCell pour les effets.
 */

(function () {
  var CELL = 16, FRAME = 8, SIZE = FRAME * 2 + CELL * 8; // 144 px logiques
  var sceneRef = null, gameRef = null;
  var storedView = null, storedHop = null;

  window.WDBoard = {
    sync: function (view, hop) {
      storedView = view; storedHop = hop || null;
      if (sceneRef) sceneRef.applyView();
    },
    spawnFx: function (r, c, fx, big) { if (sceneRef) sceneRef.spawnFx(r, c, fx, big); },
    flashCell: function (r, c) { if (sceneRef) sceneRef.flashCell(r, c); },
    isReady: function () { return !!sceneRef; },
    fitToContainer: fitToContainer
  };

  function cx(c) { return FRAME + c * CELL; }   // coin haut-gauche d'une case
  function cy(r) { return FRAME + r * CELL; }

  /* ---------- Fabrication des textures (canvas, pixel par pixel) ---------- */
  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    var tex = scene.textures.createCanvas(key, w, h);
    var ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    draw(function (x, y, col) { if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } }, ctx);
    tex.refresh();
    return key;
  }
  function gridTex(scene, key, grid) {
    return canvasTex(scene, key, grid[0].length, grid.length, function (put) {
      grid.forEach(function (row, y) { row.forEach(function (col, x) { put(x, y, col); }); });
    });
  }
  function mapTex(scene, key, sprite) {
    return canvasTex(scene, key, sprite.map[0].length, sprite.map.length, function (put) {
      sprite.map.forEach(function (row, y) { for (var x = 0; x < row.length; x++) put(x, y, sprite.colors[row[x]]); });
    });
  }
  function glyph(put, ch, x0, y0, col) {
    var g = PIXEL_FONT[ch]; if (!g) return;
    for (var y = 0; y < 5; y++) for (var x = 0; x < 3; x++) if (g[y][x] === "#") put(x0 + x, y0 + y, col);
  }

  /* Plateau complet : cadre biseauté, rivets dorés, coordonnées en police
     pixel 3x5 (A-H, 8-1 comme cellName()), terrain fantastique, place runique. */
  function drawBoard(put, seed) {
    var F = { base: "#2b1f4a", hi: "#4a3a7a", lo: "#160f2b", gold: "#e9c46a", goldLo: "#9a6b1f", ink: ART_INK };
    for (var y = 0; y < SIZE; y++) for (var x = 0; x < SIZE; x++) {
      var col = F.base;
      if ((x + y) % 2 === 0 && artHash(x, y, 77) < 0.12) col = "#241a3e";
      if (y === 1 || x === 1) col = F.hi;
      if (y === SIZE - 2 || x === SIZE - 2) col = F.lo;
      if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1) col = F.ink;
      if (x === FRAME - 1 || y === FRAME - 1 || x === SIZE - FRAME || y === SIZE - FRAME) {
        if (x >= FRAME - 1 && x <= SIZE - FRAME && y >= FRAME - 1 && y <= SIZE - FRAME) col = F.ink;
      }
      put(x, y, col);
    }
    // Rivets dorés aux coins et au milieu des côtés
    [[2, 2], [SIZE - 6, 2], [2, SIZE - 6], [SIZE - 6, SIZE - 6]].forEach(function (p) {
      var stud = [".yy.", "ywyY", "yyYY", ".YY."];
      stud.forEach(function (row, dy) { for (var dx = 0; dx < 4; dx++) {
        var ch = row[dx]; if (ch === ".") continue;
        put(p[0] + dx, p[1] + dy, ch === "w" ? "#fff7d6" : ch === "y" ? F.gold : F.goldLo);
      } });
    });
    // Coordonnées
    for (var c = 0; c < 8; c++) {
      var L = "ABCDEFGH"[c], gx = cx(c) + 6;
      glyph(put, L, gx + 1, 2, F.ink); glyph(put, L, gx, 1, F.gold);
      glyph(put, L, gx + 1, SIZE - 6, F.ink); glyph(put, L, gx, SIZE - 7, F.gold);
    }
    for (var r = 0; r < 8; r++) {
      var N = String(8 - r), gy = cy(r) + 5;
      glyph(put, N, 3, gy + 1, F.ink); glyph(put, N, 2, gy, F.gold);
      glyph(put, N, SIZE - 5, gy + 1, F.ink); glyph(put, N, SIZE - 6, gy, F.gold);
    }
    // Terrain fantastique (art.js) : plus de damier — biomes continus, symétriques.
    for (var rr = 0; rr < 8; rr++) for (var cc = 0; cc < 8; cc++) {
      var t = terrainTile(terrainAt(rr, cc, seed), rr, cc);
      for (var ty = 0; ty < 16; ty++) for (var tx = 0; tx < 16; tx++) put(cx(cc) + tx, cy(rr) + ty, t[ty][tx]);
    }
    // Grand cercle runique sur la place centrale (cases D4-E5)
    runeCirclePixels().forEach(function (q) { put(cx(3) + q[0], cy(3) + q[1], q[2]); });
  }

  /* Surbrillances 16x16 en deux images (clignotement en pas discrets). */
  function hlDraw(kind, frame) {
    return function (put) {
      var i, G = "#37d67a", Gh = "#b8f5c9", R = "#ff5d5d", Rh = "#ffd0d0", Y = "#f5c542", Yh = "#fff3c4", W = "#f3efff", K = ART_INK;
      if (kind === "move") { // gemme verte au centre de la case
        var s = frame ? 3 : 2, o = 8 - s;
        for (var y = o - 1; y <= 8 + s; y++) for (var x = o - 1; x <= 8 + s; x++) put(x, y, K);
        for (y = o; y < 8 + s; y++) for (x = o; x < 8 + s; x++) put(x, y, G);
        put(o, o, Gh); if (frame) put(o + 1, o, Gh);
      } else if (kind === "capture") { // crochets rouges + croix
        var d = frame ? 0 : 1;
        [[d, d, 1, 1], [15 - d, d, -1, 1], [d, 15 - d, 1, -1], [15 - d, 15 - d, -1, -1]].forEach(function (k) {
          for (i = 0; i < 5; i++) { put(k[0] + i * k[2], k[1], R); put(k[0], k[1] + i * k[3], R); }
          put(k[0] + k[2], k[1] + k[3], Rh);
        });
        for (i = 6; i <= 9; i++) { put(i, i, R); put(15 - i, i, R); }
      } else if (kind === "select") { // double cadre doré
        for (i = 0; i < 16; i++) { put(i, 0, Y); put(i, 15, Y); put(0, i, Y); put(15, i, Y); }
        for (i = 1; i < 15; i++) { if ((i + frame) % 2) { put(i, 1, Yh); put(i, 14, Yh); put(1, i, Yh); put(14, i, Yh); } }
      } else if (kind === "card") { // cible de carte : pointillés dorés + coins
        for (i = 0; i < 16; i++) if ((i + frame) % 2 === 0) { put(i, 0, Y); put(i, 15, Y); put(0, i, Y); put(15, i, Y); }
        [[1, 1], [14, 1], [1, 14], [14, 14]].forEach(function (p) { put(p[0], p[1], Yh); });
      } else if (kind === "zone") { // zone de déploiement : pointillés dorés + losange
        for (i = 1; i < 15; i++) if ((i + frame) % 3 === 0) { put(i, 1, Y); put(i, 14, Y); put(1, i, Y); put(14, i, Y); }
        put(7, 6, Yh); put(6, 7, Y); put(8, 7, Y); put(7, 8, Y);
      } else if (kind === "hover") { // coins blancs du survol
        [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]].forEach(function (k) {
          for (i = 0; i < 3; i++) { put(k[0] + i * k[2], k[1], W); put(k[0], k[1] + i * k[3], W); }
        });
      }
    };
  }

  function chipKey(t, cls) { return "chip-" + (cls || "n") + "-" + t; }
  function chipGlyph(t) { return PIXEL_FONT[t] ? t : (t === "É" ? "E" : "?"); }

  function generateTextures(scene) {
    [1, 2].forEach(function (player) {
      SHAPES.forEach(function (shape) {
        var grid = pieceSprite(shape, player);
        gridTex(scene, "pawn-" + player + "-" + shape, grid);
        // Silhouette blanche (flash de capture / transformation) et fantôme gris
        // (leurre) : textures dédiées, pas de teinte GPU — identique en Canvas et WebGL.
        gridTex(scene, "pawnw-" + player + "-" + shape, grid.map(function (row) { return row.map(function (c) { return c ? "#ffffff" : null; }); }));
        gridTex(scene, "pawng-" + player + "-" + shape, grid.map(function (row, y) { return row.map(function (c, x) {
          if (!c) return null;
          if (c === PAWN_PALETTES[player].outline) return "#3b3550";
          return (x + y) % 2 ? "#9a93b0" : "#7d7696";
        }); }));
      });
    });
    canvasTex(scene, "shadow", 12, 3, function (put) {
      for (var x = 1; x < 11; x++) put(x, 1, "#0b0714");
      for (x = 3; x < 9; x++) { put(x, 0, "#0b0714"); put(x, 2, "#0b0714"); }
    });
    ["move", "capture", "select", "card", "hover", "zone"].forEach(function (k) {
      canvasTex(scene, "hl-" + k + "-0", 16, 16, hlDraw(k, 0));
      canvasTex(scene, "hl-" + k + "-1", 16, 16, hlDraw(k, 1));
    });
    Object.keys(BOARD_MARKERS).forEach(function (k) { mapTex(scene, "mk-" + k, BOARD_MARKERS[k]); });
    canvasTex(scene, "px", 1, 1, function (put) { put(0, 0, "#ffffff"); });
  }

  function ensureChip(scene, t, cls) {
    var key = chipKey(t, cls);
    return canvasTex(scene, key, 5, 7, function (put) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 5; x++)
        put(x, y, (x === 0 || y === 0 || x === 4 || y === 6) ? ART_INK : (CHIP_COLORS[cls] || CHIP_COLORS[""]));
      glyph(put, chipGlyph(t), 1, 1, ART_INK);
    });
  }

  /* ---------- Agrandissement entier ---------- */
  function fitToContainer() {
    if (!gameRef) return;
    var host = document.getElementById("phaser-board");
    if (!host) return;
    var avail = Math.max(SIZE, host.clientWidth);
    var dpr = window.devicePixelRatio || 1;
    var n = Math.max(1, Math.floor(avail * dpr / SIZE)); // pixels physiques par pixel d'art
    var zoom = n / dpr;
    if (gameRef.scale.zoom !== zoom) gameRef.scale.setZoom(zoom);
  }

  class BootScene extends Phaser.Scene {
    constructor() { super({ key: "Boot" }); }
    create() { generateTextures(this); this.scene.start("Board"); }
  }

  class BoardScene extends Phaser.Scene {
    constructor() { super({ key: "Board" }); }

    create() {
      var self = this;
      this.terrainSeed = null;
      this.boardImg = this.add.image(0, 0, this.boardKey(1)).setOrigin(0, 0).setDepth(0);
      this.pawnRecs = {};    // id -> {container, img, shadow, r, c, hopping, sig}
      this.dynamic = [];     // objets reconstruits à chaque sync
      this.blinkers = [];    // surbrillances à 2 images
      this.blinkFrame = 0;
      this.gameId = null;
      this.hover = this.add.image(0, 0, "hl-hover-0").setOrigin(0, 0).setDepth(8).setVisible(false);
      // Clignotement des surbrillances : bascule d'image toutes les 300 ms (pas discrets).
      this.time.addEvent({ delay: 300, loop: true, callback: function () {
        self.blinkFrame ^= 1;
        self.blinkers.forEach(function (b) { if (b.active) b.setTexture(b.getData("base") + "-" + self.blinkFrame); });
        // Animation de repos : chaque personnage respire d'1 px, en décalé.
        self.bobTick = (self.bobTick || 0) + 1;
        Object.keys(self.pawnRecs).forEach(function (id) {
          var rec = self.pawnRecs[id];
          if (!rec.hopping) rec.img.setY(((self.bobTick >> 1) + rec.bobPhase) % 2 ? -1 : 0);
        });
      } });
      this.input.on("pointermove", function (p) {
        var cell = self.cellAt(p.worldX, p.worldY);
        if (!cell) { self.hover.setVisible(false); return; }
        self.hover.setPosition(cx(cell.c), cy(cell.r)).setVisible(true);
      });
      this.input.on("pointerout", function () { self.hover.setVisible(false); });
      this.input.on("pointerdown", function (p) {
        var cell = self.cellAt(p.worldX, p.worldY);
        if (cell && typeof window.WDCellClick === "function") window.WDCellClick(cell.r, cell.c);
      });
      sceneRef = this;
      fitToContainer();
      if (storedView) this.applyView();
    }

    boardKey(seed) {
      var key = "board-" + seed;
      canvasTex(this, key, SIZE, SIZE, function (put) { drawBoard(put, seed); });
      return key;
    }

    cellAt(x, y) {
      var c = Math.floor((x - FRAME) / CELL), r = Math.floor((y - FRAME) / CELL);
      return (r >= 0 && r < 8 && c >= 0 && c < 8) ? { r: r, c: c } : null;
    }

    addDynamic(obj) { this.dynamic.push(obj); return obj; }
    addHighlight(kind, r, c, depth) {
      var img = this.add.image(cx(c), cy(r), "hl-" + kind + "-" + this.blinkFrame).setOrigin(0, 0).setDepth(depth);
      img.setData("base", "hl-" + kind);
      this.blinkers.push(img);
      return this.addDynamic(img);
    }

    applyView() {
      var view = storedView, hop = storedHop, self = this;
      storedHop = null;
      if (!view) return;
      var freshGame = view.gameId !== this.gameId;
      if (freshGame) { // nouvelle partie : on repart d'un plateau vide, sans effets
        Object.keys(this.pawnRecs).forEach(function (id) { self.destroyRec(self.pawnRecs[id]); });
        this.pawnRecs = {};
        this.gameId = view.gameId;
      }
      if (view.terrainSeed && view.terrainSeed !== this.terrainSeed) { // terrain propre à chaque partie
        this.terrainSeed = view.terrainSeed;
        this.boardImg.setTexture(this.boardKey(view.terrainSeed));
      }
      this.dynamic.forEach(function (o) { o.destroy(); });
      this.dynamic = []; this.blinkers = [];
      (view.zone || []).forEach(function (z) { self.addHighlight("zone", z.r, z.c, 1); });

      view.targets.forEach(function (t) { self.addHighlight(t.capture ? "capture" : "move", t.r, t.c, 6); });
      if (view.selected) this.addHighlight("select", view.selected.r, view.selected.c, 5);
      view.cardTargets.forEach(function (t) { self.addHighlight("card", t.r, t.c, 5); });
      view.guards.forEach(function (gd) {
        self.addDynamic(self.add.image(cx(gd.c) + 1, cy(gd.r) + 8, "mk-guard").setOrigin(0, 0).setDepth(2));
      });
      view.traps.forEach(function (tp) {
        self.addDynamic(self.add.image(cx(tp.c) + 1, cy(tp.r) + 1, "mk-trap").setOrigin(0, 0).setDepth(2));
      });
      view.decoys.forEach(function (d) { // leurre : silhouette fantôme
        var img = self.add.image(cx(d.c), cy(d.r), "pawng-" + d.owner + "-" + d.shape).setOrigin(0, 0);
        img.setAlpha(0.6).setDepth(3);
        self.addDynamic(img);
      });

      var seen = {};
      view.pawns.forEach(function (p) {
        seen[p.id] = true;
        var rec = self.pawnRecs[p.id];
        var sig = p.chips.map(function (ch) { return ch.t + ch.cls; }).join("|") + (p.suspicion ? "?" : "");
        if (!rec) {
          rec = self.makeRec(p);
          rec.sig = sig;
          if (!freshGame && view.phase.indexOf("select") !== 0 && view.phase.indexOf("deploy") !== 0) self.materialize(rec, p);
          else if (view.phase.indexOf("deploy") === 0) self.landPuff(p);
        } else if (rec.sig !== sig) {
          var gained = sig.length > rec.sig.length;
          rec.sig = sig;
          self.transformFlash(rec, p, gained);
        }
        var oldR = rec.r, oldC = rec.c;
        rec.r = p.r; rec.c = p.c;
        if (hop && hop.pawnId === p.id && !rec.hopping && (oldR !== p.r || oldC !== p.c)) self.startHop(rec, oldR, oldC, p.r, p.c);
        else if (!rec.hopping) { rec.container.setPosition(cx(p.c), cy(p.r)); }
        self.renderChips(rec, p);
      });
      Object.keys(this.pawnRecs).forEach(function (id) {
        if (seen[id]) return;
        var rec = self.pawnRecs[id];
        if (!freshGame && view.phase.indexOf("deploy") !== 0 && view.phase.indexOf("select") !== 0 && view.phase !== "handover") self.shatter(rec);
        self.destroyRec(rec);
        delete self.pawnRecs[id];
      });
    }

    makeRec(p) {
      var shadow = this.add.image(2, 13, "shadow").setOrigin(0, 0);
      var img = this.add.image(0, 0, "pawn-" + p.player + "-" + p.shape).setOrigin(0, 0);
      var container = this.add.container(cx(p.c), cy(p.r), [shadow, img]).setDepth(4);
      var rec = { container: container, img: img, shadow: shadow, r: p.r, c: p.c, hopping: false, chipObjs: [], player: p.player, shape: p.shape, sig: "",
                  bobPhase: parseInt(String(p.id).replace(/\D/g, ""), 10) % 2 || 0 };
      this.pawnRecs[p.id] = rec;
      return rec;
    }
    destroyRec(rec) { rec.container.destroy(); }

    renderChips(rec, p) {
      var self = this;
      rec.chipObjs.forEach(function (o) { o.destroy(); });
      rec.chipObjs = [];
      var chips = p.chips;
      if (chips.length > 3) chips = chips.slice(0, 2).concat([{ t: "+", cls: "" }]);
      chips.forEach(function (chip, i) {
        var key = ensureChip(self, chip.t, chip.cls);
        var img = self.add.image(16 - (chips.length - i) * 5, -1, key).setOrigin(0, 0);
        rec.container.add(img); rec.chipObjs.push(img);
      });
      if (p.suspicion) {
        var s = self.add.image(11, 10, "mk-suspicion").setOrigin(0, 0);
        rec.container.add(s); rec.chipObjs.push(s);
      }
    }

    /* Pose pendant le déploiement : petit nuage de poussière en 4 pas. */
    landPuff(p) {
      for (var i = 0; i < 6; i++) this.pixelParticle(cx(p.c) + 4 + i, cy(p.r) + 14, (i - 2.5) > 0 ? 3 : -3, -1 - (i % 2), "#e8dcc0", 1, 4, 60);
    }

    /* Saut image par image : 4 pas de 70 ms, arc au milieu, positions entières. */
    startHop(rec, fromR, fromC, toR, toC) {
      var sx = cx(fromC), sy = cy(fromR), tx = cx(toC), ty = cy(toR), step = 0;
      var arc = [0, 3, 4, 2, 0];
      rec.hopping = true;
      rec.container.setPosition(sx, sy);
      this.time.addEvent({ delay: 70, repeat: 3, callback: function () {
        step++;
        var t = step / 4;
        rec.container.setPosition(Math.round(sx + (tx - sx) * t), Math.round(sy + (ty - sy) * t) - arc[step]);
        rec.shadow.setY(13 + arc[step]);
        if (step === 4) { rec.container.setPosition(tx, ty); rec.shadow.setY(13); rec.hopping = false; }
      } });
    }

    /* Capture : flash blanc d'une image, puis éclats pixel du pion (6 pas). */
    shatter(rec) {
      var pal = PAWN_PALETTES[rec.player];
      var x0 = rec.container.x, y0 = rec.container.y;
      var ghost = this.add.image(x0, y0, "pawnw-" + rec.player + "-" + rec.shape).setOrigin(0, 0).setDepth(7);
      this.time.delayedCall(90, function () { ghost.destroy(); });
      var cols = [pal.main, pal.light, pal.outline, pal.gem];
      for (var i = 0; i < 12; i++) {
        var ang = (i / 12) * Math.PI * 2;
        this.pixelParticle(x0 + 7, y0 + 7, Math.round(Math.cos(ang) * (6 + (i % 3) * 2)), Math.round(Math.sin(ang) * (6 + (i % 2) * 3)) + 2, cols[i % cols.length], 2, 6, 80);
      }
      this.flashCell(rec.r, rec.c);
    }

    /* Transformation (propriété, protection, gel…) : silhouette blanche en 4 pas. */
    transformFlash(rec, p, gained) {
      var img = rec.img, step = 0, base = "pawn-" + rec.player + "-" + rec.shape;
      this.time.addEvent({ delay: 70, repeat: 3, callback: function () {
        step++;
        img.setTexture(step % 2 ? "pawnw-" + rec.player + "-" + rec.shape : base);
      } });
      if (gained) {
        var pal = PAWN_PALETTES[p.player];
        for (var i = 0; i < 6; i++) this.pixelParticle(cx(p.c) + 3 + i * 2, cy(p.r) + 12, 0, -8 - (i % 3) * 2, i % 2 ? pal.gem : "#ffffff", 1, 5, 90);
      }
    }

    /* Apparition (Résurrection, Duplication, Fusion) : silhouette qui se remplit. */
    materialize(rec, p) {
      var img = rec.img, step = 0;
      img.setTexture("pawnw-" + rec.player + "-" + rec.shape).setAlpha(0.34);
      this.time.addEvent({ delay: 90, repeat: 2, callback: function () {
        step++;
        if (step === 1) img.setAlpha(0.67);
        else if (step === 2) img.setAlpha(1);
        else img.setTexture("pawn-" + rec.player + "-" + rec.shape);
      } });
      for (var i = 0; i < 8; i++) {
        var ang = (i / 8) * Math.PI * 2;
        var dx = Math.round(Math.cos(ang) * 9), dy = Math.round(Math.sin(ang) * 9);
        this.pixelParticle(cx(p.c) + 7 + dx, cy(p.r) + 7 + dy, -dx, -dy, i % 2 ? "#ffffff" : PAWN_PALETTES[p.player].light, 1, 5, 70);
      }
    }

    /* Particule pixel : trajet quantifié en n pas, toujours sur un pixel entier. */
    pixelParticle(x, y, dx, dy, color, size, steps, delay) {
      var key = "px-" + size + "-" + color;
      canvasTex(this, key, size, size, function (put) { for (var a = 0; a < size; a++) for (var b = 0; b < size; b++) put(a, b, color); });
      var img = this.add.image(x, y, key).setOrigin(0, 0).setDepth(7);
      var step = 0;
      this.time.addEvent({ delay: delay || 90, repeat: steps - 1, callback: function () {
        step++;
        var t = step / steps;
        img.setPosition(Math.round(x + dx * t), Math.round(y + dy * t));
        if (step >= steps - 1) img.setAlpha(0.5);
        if (step === steps) img.destroy();
      } });
    }

    /* Flash d'une case : voile blanc en 4 paliers d'opacité. */
    flashCell(r, c) {
      var rect = this.add.image(cx(c), cy(r), "px").setOrigin(0, 0).setDisplaySize(CELL, CELL).setDepth(7).setAlpha(0.6);
      var levels = [0.45, 0.3, 0.15, 0], step = 0;
      this.time.addEvent({ delay: 80, repeat: 3, callback: function () {
        rect.setAlpha(levels[step]); step++;
        if (step === 4) rect.destroy();
      } });
    }

    /* Effets de carte (CARD_FX) : mêmes motifs, ramenés à l'échelle logique
       (1 case = 16 px) et quantifiés en 6 pas. */
    spawnFx(r, c, fx, big) {
      if (!fx) return;
      var x0 = cx(c) + 7, y0 = cy(r) + 7, n = big ? 16 : 10, size = big ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * Math.PI * 2, dx, dy, sx = x0, sy = y0;
        if (fx.pattern === "ring" || fx.pattern === "rune") { dx = Math.round(Math.cos(ang) * 8); dy = Math.round(Math.sin(ang) * 8); }
        else if (fx.pattern === "snow") { sx = x0 + ((i % 5) - 2) * 3; sy = y0 - 8; dx = 0; dy = 10 + (i % 3) * 2; }
        else if (fx.pattern === "rise") { sx = x0 + ((i % 5) - 2) * 3; sy = y0 + 6; dx = 0; dy = -10 - (i % 3) * 3; }
        else if (fx.pattern === "converge") { sx = x0 + Math.round(Math.cos(ang) * 10); sy = y0 + Math.round(Math.sin(ang) * 10); dx = x0 - sx; dy = y0 - sy; }
        else if (fx.pattern === "swap") { dx = (i % 2 ? 1 : -1) * (4 + (i % 4) * 2); dy = ((i % 3) - 1) * 3; }
        else if (fx.pattern === "link") { dx = Math.round(Math.cos(ang) * 6); dy = 0; sy = y0 + ((i % 3) - 1) * 3; }
        else if (fx.pattern === "veil") { sx = x0 + ((i % 4) - 2) * 3; sy = y0 - 6; dx = 0; dy = 4; }
        else { dx = ((i % 5) - 2) * 4; dy = ((Math.floor(i / 5) % 3) - 1) * 4 - 2; }
        this.pixelParticle(sx, sy, dx, dy, fx.colors[i % fx.colors.length], size, 6, 90);
      }
      if (fx.pattern === "ring" || fx.pattern === "rune") this.runeCircle(r, c, fx.colors[0]);
    }

    /* Cercle runique d'activation : anneau pixel qui apparaît en 3 pas. */
    runeCircle(r, c, color) {
      var key = "ring-" + color;
      canvasTex(this, key, 16, 16, function (put) {
        for (var a = 0; a < 48; a++) {
          if (a % 4 === 3) continue;
          var ang = a / 48 * Math.PI * 2;
          put(Math.round(7.5 + Math.cos(ang) * 7), Math.round(7.5 + Math.sin(ang) * 7), color);
        }
      });
      var img = this.add.image(cx(c), cy(r), key).setOrigin(0, 0).setDepth(6).setAlpha(0.4), step = 0;
      this.time.addEvent({ delay: 90, repeat: 4, callback: function () {
        step++;
        img.setAlpha([0.7, 1, 0.7, 0.35, 0][step - 1]);
        if (step === 5) img.destroy();
      } });
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    gameRef = new Phaser.Game({
      type: Phaser.AUTO, // WebGL ou Canvas : aucune teinte GPU utilisée, rendu identique
      parent: "phaser-board",
      width: SIZE, height: SIZE,
      backgroundColor: ART_INK,
      pixelArt: true, roundPixels: true, antialias: false,
      scale: { mode: Phaser.Scale.NONE, zoom: 3 },
      banner: false,
      scene: [BootScene, BoardScene]
    });
    window.addEventListener("resize", fitToContainer);
    if (window.matchMedia) {
      try { window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)").addEventListener("change", fitToContainer); } catch (e) { /* navigateurs anciens */ }
    }
  });
})();
