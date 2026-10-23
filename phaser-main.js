"use strict";
/*
 * Wizard Dame — phaser-main.js : rendu du PLATEAU sous Phaser 3.60.0.
 * Aucune logique de jeu ici : les règles vivent dans engine.js, l'UI cartes /
 * menus dans ui-dom.js, les ressources pixel art dans art.js et assets/.
 *
 * Caméra (décision d'Ekoue, 2026-10-23) : vue DEPUIS LE CAMP DU JOUEUR 1,
 * comme à une table de duel. Rangée 8 (adversaire) au fond, rangée 1 au premier
 * plan ; le plateau s'élargit d'une rangée à l'autre (perspective en escalier,
 * sans redimensionner les sprites), relief des dalles et falaise de l'île au
 * premier plan. Le camp violet est vu de dos, le camp orange de face.
 *
 * Section 12 — grille de pixels stricte : tout est dessiné à la résolution
 * logique BW x BH, positions entières, agrandissement par multiple ENTIER de
 * pixels physiques (zoom = n / devicePixelRatio). Animations image par image.
 *
 * Pont avec ui-dom.js :
 *   - ui-dom appelle WDBoard.sync(view, hop) après chaque rendu ;
 *   - les clics remontent par window.WDCellClick(r, c) ;
 *   - ui-dom appelle WDBoard.spawnFx / WDBoard.flashCell pour les effets.
 */

(function () {
  var BW = 324, BH = 200, CX = 162, Y0 = 34, CLIFF = 22;
  var RAISE = { dalle: 2, cristal: 2, place: 3 };
  var FEET_Y = 44; // pieds dans une case 64x64 des planches (characters.json)
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

  /* ---------- Géométrie de la vue ---------- */
  var ROWS = [];
  (function () {
    var y = Y0;
    for (var r = 0; r < 8; r++) { ROWS.push({ y: y, wt: 30 + r, wb: 31 + r, h: 14 + r }); y += 14 + r; }
  })();
  var BOARD_BOTTOM = ROWS[7].y + ROWS[7].h;

  function liftOf(r, c, seed) { return RAISE[terrainAt(r, c, seed)] || 0; }
  /* Parcourt les pixels du dessus d'une case : cb(x, y, u, v, edgeDist). */
  function eachCellPixel(r, c, lift, cb) {
    var R = ROWS[r];
    for (var yy = 0; yy < R.h; yy++) {
      var t = (yy + 0.5) / R.h, w = R.wt + (R.wb - R.wt) * t, left = CX - 4 * w + c * w;
      for (var x = Math.floor(left) - 1; x <= Math.ceil(left + w) + 1; x++) {
        var u = (x + 0.5 - left) / w;
        if (u < 0 || u >= 1) continue;
        var ed = Math.min(u * w, (1 - u) * w, yy + 0.5, R.h - yy - 0.5);
        cb(x, R.y + yy - lift, u, t, ed);
      }
    }
  }
  function anchorOf(r, c, seed) {
    var R = ROWS[r], wm = (R.wt + R.wb) / 2;
    return { x: Math.round(CX + (c - 3.5) * wm), y: R.y + Math.round(R.h * 0.6) - liftOf(r, c, seed) };
  }

  /* ---------- Textures (canvas, pixel par pixel) ---------- */
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
  function glyph(put, ch, x0, y0, col) {
    var g = PIXEL_FONT[ch]; if (!g) return;
    for (var y = 0; y < 5; y++) for (var x = 0; x < 3; x++) if (g[y][x] === "#") put(x0 + x, y0 + y, col);
  }
  function hexDarken(hex, f) { return shadeHex(hex, -f); }

  /* Plateau : terrain par cases (art.js) projeté sur la perspective en escalier,
     faces avant des dalles en relief, falaise de l'île, place runique centrale,
     coordonnées A-H (sur la falaise) et 1-8 (à gauche de chaque rangée). */
  function drawBoard(put, seed) {
    for (var r = 0; r < 8; r++) {
      var R = ROWS[r];
      for (var c = 0; c < 8; c++) {
        var kind = terrainAt(r, c, seed), tile = terrainTile(kind, r, c), lift = RAISE[kind] || 0;
        var base = TERRAIN[kind].base, lb = Math.round(CX - 4 * R.wb + c * R.wb);
        var face = lift + (r === 7 ? CLIFF : 2);
        for (var x = lb; x < lb + R.wb; x++) for (var d = 0; d < face; d++) {
          var col;
          if (d === 0) col = shadeHex(base, 0.1);
          else if (d < lift + 2) col = hexDarken(base, 0.35);
          else col = Math.floor(d / 3) % 2 ? "#2e2a44" : "#3b3550";
          if (r === 7 && d === face - 1 && artHash(x, d, seed) < 0.35) col = "#2c5027";
          if (x === lb) col = hexDarken(col, 0.3);
          put(x, R.y + R.h - lift + d, col);
        }
        eachCellPixel(r, c, lift, function (x, y, u, v, ed) {
          var col = tile[Math.min(14, Math.floor(v * 15))][Math.min(14, Math.floor(u * 15))];
          if (ed < 1) col = hexDarken(col, 0.35);
          else if (ed < 2 && (v < 0.2 || u < 0.2)) col = shadeHex(col, 0.12);
          put(x, y, col);
        });
      }
      if (r === 4) { // cercle runique sur la place (D4-E5)
        var cy = Math.round((ROWS[3].y + ROWS[4].y + ROWS[4].h) / 2) - 3;
        for (var a = 0; a < 140; a++) {
          var ang = a / 140 * Math.PI * 2;
          put(Math.round(CX + Math.cos(ang) * 26), Math.round(cy + Math.sin(ang) * 12), "#e9c46a");
          if (a % 3) put(Math.round(CX + Math.cos(ang) * 21), Math.round(cy + Math.sin(ang) * 9), "#9a6b1f");
        }
      }
      // Numéro de rangée (8 au fond, 1 devant), comme cellName()
      var N = String(8 - r), nx = Math.round(CX - 4 * R.wb) - 6, ny = R.y + Math.round(R.h / 2) - 3;
      glyph(put, N, nx + 1, ny + 1, ART_INK); glyph(put, N, nx, ny, "#e9c46a");
    }
    var R7 = ROWS[7];
    for (var cc = 0; cc < 8; cc++) {
      var L = "ABCDEFGH"[cc], lx = Math.round(CX - 4 * R7.wb + cc * R7.wb + R7.wb / 2) - 1, ly = BOARD_BOTTOM + 9;
      glyph(put, L, lx + 1, ly + 1, ART_INK); glyph(put, L, lx, ly, "#e9c46a");
    }
  }

  function chipKey(t, cls) { return "chip-" + (cls || "n") + "-" + t; }
  function chipGlyph(t) { return PIXEL_FONT[t] ? t : (t === "É" ? "E" : "?"); }
  function ensureChip(scene, t, cls) {
    return canvasTex(scene, chipKey(t, cls), 5, 7, function (put) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 5; x++)
        put(x, y, (x === 0 || y === 0 || x === 4 || y === 6) ? ART_INK : (CHIP_COLORS[cls] || CHIP_COLORS[""]));
      glyph(put, chipGlyph(t), 1, 1, ART_INK);
    });
  }

  function generateTextures(scene) {
    [1, 2].forEach(function (pl) { // cercle d'équipe au sol, à la Dofus
      var pal = PAWN_PALETTES[pl];
      canvasTex(scene, "ring-" + pl, 19, 8, function (put) {
        for (var a = 0; a < 64; a++) {
          var ang = a / 64 * Math.PI * 2;
          put(Math.round(9 + Math.cos(ang) * 8), Math.round(4 + Math.sin(ang) * 3), pal.dark);
          put(Math.round(9 + Math.cos(ang) * 7), Math.round(3 + Math.sin(ang) * 3), pal.light);
        }
        for (var x = 4; x < 15; x++) put(x, 4, "rgba(11,7,20,0.45)");
      });
    });
    canvasTex(scene, "px", 1, 1, function (put) { put(0, 0, "#ffffff"); });
    Object.keys(BOARD_MARKERS).forEach(function (k) {
      var sp = BOARD_MARKERS[k];
      canvasTex(scene, "mk-" + k, sp.map[0].length, sp.map.length, function (put) {
        sp.map.forEach(function (row, y) { for (var x = 0; x < row.length; x++) put(x, y, sp.colors[row[x]]); });
      });
    });
    // Animations des personnages (planches 64x64 : attente, déplacement, blessure/chute)
    SHAPES.forEach(function (sh) {
      [1, 2].forEach(function (pl) {
        var k = "ch-" + sh + "-" + pl;
        scene.anims.create({ key: k + "-idle", frames: scene.anims.generateFrameNumbers(k, { start: 0, end: 3 }), frameRate: 5, repeat: -1 });
        scene.anims.create({ key: k + "-move", frames: scene.anims.generateFrameNumbers(k, { start: 4, end: 7 }), frameRate: 14, repeat: -1 });
        scene.anims.create({ key: k + "-fall", frames: scene.anims.generateFrameNumbers(k, { frames: [8, 9, 10] }), frameRate: 8, repeat: 0 });
      });
    });
  }

  /* ---------- Agrandissement entier ---------- */
  function fitToContainer() {
    if (!gameRef) return;
    var host = document.getElementById("phaser-board");
    if (!host) return;
    var avail = Math.max(BW, host.clientWidth);
    var dpr = window.devicePixelRatio || 1;
    var n = Math.max(1, Math.floor(avail * dpr / BW)); // pixels physiques par pixel d'art
    var zoom = n / dpr;
    if (gameRef.scale.zoom !== zoom) gameRef.scale.setZoom(zoom);
  }

  class BootScene extends Phaser.Scene {
    constructor() { super({ key: "Boot" }); }
    preload() {
      var self = this;
      SHAPES.forEach(function (sh) {
        [1, 2].forEach(function (pl) {
          self.load.spritesheet("ch-" + sh + "-" + pl, "assets/characters/" + sh + "-" + pl + ".png", { frameWidth: 64, frameHeight: 64 });
        });
      });
    }
    create() { generateTextures(this); this.scene.start("Board"); }
  }

  class BoardScene extends Phaser.Scene {
    constructor() { super({ key: "Board" }); }

    create() {
      var self = this;
      this.terrainSeed = 1;
      this.boardImg = this.add.image(0, 0, this.boardKey(1)).setOrigin(0, 0).setDepth(0);
      // Calque de surbrillances : deux images (clignotement), redessinées à chaque état.
      this.overlays = [0, 1].map(function (f) {
        var key = "overlay-" + f;
        var tex = self.textures.createCanvas(key, BW, BH);
        tex.getContext().imageSmoothingEnabled = false;
        return { tex: tex, img: self.add.image(0, 0, key).setOrigin(0, 0).setDepth(1).setVisible(f === 0) };
      });
      this.blinkFrame = 0;
      this.pawnRecs = {};
      this.dynamic = [];
      this.gameId = null;
      this.hoverCell = null;
      this.time.addEvent({ delay: 300, loop: true, callback: function () {
        self.blinkFrame ^= 1;
        self.overlays[0].img.setVisible(self.blinkFrame === 0);
        self.overlays[1].img.setVisible(self.blinkFrame === 1);
      } });
      this.input.on("pointermove", function (p) {
        var cell = self.cellAt(p.worldX, p.worldY);
        var key = cell ? cell.r + "," + cell.c : null;
        if (key !== self.hoverCell) { self.hoverCell = key; self.drawOverlays(); }
      });
      this.input.on("pointerout", function () { self.hoverCell = null; self.drawOverlays(); });
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
      canvasTex(this, key, BW, BH, function (put) { drawBoard(put, seed); });
      return key;
    }
    anchor(r, c) { return anchorOf(r, c, this.terrainSeed); }

    /* Case visée : d'abord le personnage sous le pointeur (il dépasse sur les
       rangées du fond), du premier plan vers le fond ; sinon la dalle. */
    cellAt(x, y) {
      var recs = Object.keys(this.pawnRecs).map(function (k) { return this.pawnRecs[k]; }, this)
        .sort(function (a, b) { return b.r - a.r; });
      for (var i = 0; i < recs.length; i++) {
        var a = this.anchor(recs[i].r, recs[i].c);
        if (x >= a.x - 9 && x <= a.x + 9 && y >= a.y - 30 && y <= a.y + 2) return { r: recs[i].r, c: recs[i].c };
      }
      for (var r = 7; r >= 0; r--) {
        for (var c = 0; c < 8; c++) {
          var R = ROWS[r], lift = liftOf(r, c, this.terrainSeed), yy = y - R.y + lift;
          if (yy < 0 || yy >= R.h) continue;
          var t = (yy + 0.5) / R.h, w = R.wt + (R.wb - R.wt) * t, left = CX - 4 * w + c * w;
          if (x >= left && x < left + w) return { r: r, c: c };
        }
      }
      return null;
    }

    /* Surbrillances dessinées dans le calque, sur la forme exacte de chaque case. */
    drawOverlays() {
      var view = storedView || this.lastView, self = this;
      if (!view) return;
      this.overlays.forEach(function (ov, frame) {
        var ctx = ov.tex.getContext();
        ctx.clearRect(0, 0, BW, BH);
        function put(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
        function outline(r, c, col, dotted, width) {
          eachCellPixel(r, c, liftOf(r, c, self.terrainSeed), function (x, y, u, v, ed) {
            if (ed < width && (!dotted || (x + y + frame) % 2 === 0)) put(x, y, col);
          });
        }
        function gem(r, c, col, hi) {
          var a = self.anchor(r, c), s = frame ? 2 : 1;
          for (var dy = -s - 1; dy <= s; dy++) for (var dx = -s - 1; dx <= s; dx++) put(a.x + dx, a.y + dy, ART_INK);
          for (dy = -s; dy < s; dy++) for (dx = -s; dx < s; dx++) put(a.x + dx, a.y + dy, col);
          put(a.x - s, a.y - s, hi);
        }
        (view.zone || []).forEach(function (z) { outline(z.r, z.c, "#f5c542", true, 1.5); });
        view.targets.forEach(function (t) {
          if (t.capture) { outline(t.r, t.c, "#ff5d5d", frame === 0, 2); }
          else { outline(t.r, t.c, "#37d67a", true, 1.5); gem(t.r, t.c, "#37d67a", "#b8f5c9"); }
        });
        view.cardTargets.forEach(function (t) { outline(t.r, t.c, "#f5c542", true, 2.5); });
        if (view.selected) outline(view.selected.r, view.selected.c, frame ? "#fff3c4" : "#f5c542", false, 2);
        if (self.hoverCell) { var hc = self.hoverCell.split(","); outline(+hc[0], +hc[1], "rgba(243,239,255,0.8)", false, 1); }
        ov.tex.refresh();
      });
    }

    applyView() {
      var view = storedView, hop = storedHop, self = this;
      storedHop = null;
      if (!view) return;
      this.lastView = view;
      var freshGame = view.gameId !== this.gameId;
      if (freshGame) {
        Object.keys(this.pawnRecs).forEach(function (id) { self.pawnRecs[id].container.destroy(); });
        this.pawnRecs = {};
        this.gameId = view.gameId;
      }
      if (view.terrainSeed && view.terrainSeed !== this.terrainSeed) {
        this.terrainSeed = view.terrainSeed;
        this.boardImg.setTexture(this.boardKey(view.terrainSeed));
      }
      this.drawOverlays();
      this.dynamic.forEach(function (o) { o.destroy(); });
      this.dynamic = [];
      view.guards.forEach(function (gd) {
        var a = self.anchor(gd.r, gd.c);
        self.dynamic.push(self.add.image(a.x - 12, a.y - 4, "mk-guard").setOrigin(0, 0).setDepth(2 + gd.r * 10));
      });
      view.traps.forEach(function (tp) {
        var a = self.anchor(tp.r, tp.c);
        self.dynamic.push(self.add.image(a.x + 5, a.y - 4, "mk-trap").setOrigin(0, 0).setDepth(2 + tp.r * 10));
      });
      view.decoys.forEach(function (d) { // leurre : silhouette fantôme d'un personnage
        var a = self.anchor(d.r, d.c);
        var s = self.add.sprite(a.x, a.y, "ch-" + d.shape + "-" + d.owner, 0).setOrigin(0.5, FEET_Y / 64);
        s.setAlpha(0.45).setDepth(5 + d.r * 10);
        self.dynamic.push(s);
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
        else if (!rec.hopping) { var a = self.anchor(p.r, p.c); rec.container.setPosition(a.x, a.y).setDepth(10 + p.r * 10); }
        self.renderChips(rec, p);
      });
      Object.keys(this.pawnRecs).forEach(function (id) {
        if (seen[id]) return;
        var rec = self.pawnRecs[id];
        if (!freshGame && view.phase.indexOf("deploy") !== 0 && view.phase.indexOf("select") !== 0 && view.phase !== "handover") self.fall(rec);
        rec.container.destroy();
        delete self.pawnRecs[id];
      });
    }

    makeRec(p) {
      var a = this.anchor(p.r, p.c), key = "ch-" + p.shape + "-" + p.player;
      var ring = this.add.image(-9, -4, "ring-" + p.player).setOrigin(0, 0);
      var sprite = this.add.sprite(0, 0, key, 0).setOrigin(0.5, FEET_Y / 64);
      sprite.play({ key: key + "-idle", startFrame: parseInt(String(p.id).replace(/\D/g, ""), 10) % 4 });
      var container = this.add.container(a.x, a.y, [ring, sprite]).setDepth(10 + p.r * 10);
      var rec = { container: container, sprite: sprite, key: key, r: p.r, c: p.c, hopping: false, chipObjs: [], player: p.player, shape: p.shape, sig: "" };
      this.pawnRecs[p.id] = rec;
      return rec;
    }

    renderChips(rec, p) {
      var self = this;
      rec.chipObjs.forEach(function (o) { o.destroy(); });
      rec.chipObjs = [];
      var chips = p.chips;
      if (chips.length > 3) chips = chips.slice(0, 2).concat([{ t: "+", cls: "" }]);
      var x0 = -Math.round(chips.length * 5 / 2);
      chips.forEach(function (chip, i) {
        var img = self.add.image(x0 + i * 5, -42, ensureChip(self, chip.t, chip.cls)).setOrigin(0, 0);
        rec.container.add(img); rec.chipObjs.push(img);
      });
      if (p.suspicion) {
        var s = self.add.image(8, -24, "mk-suspicion").setOrigin(0, 0);
        rec.container.add(s); rec.chipObjs.push(s);
      }
    }

    landPuff(p) {
      var a = this.anchor(p.r, p.c);
      for (var i = 0; i < 6; i++) this.pixelParticle(a.x - 3 + i, a.y, i > 2 ? 3 : -3, -1 - (i % 2), "#e8dcc0", 1, 4, 60, p.r);
    }

    /* Déplacement : animation de marche + saut en 4 pas, positions entières. */
    startHop(rec, fromR, fromC, toR, toC) {
      var A = this.anchor(fromR, fromC), B = this.anchor(toR, toC), step = 0, arc = [0, 3, 5, 3, 0];
      rec.hopping = true;
      rec.sprite.play(rec.key + "-move");
      rec.container.setPosition(A.x, A.y).setDepth(10 + Math.max(fromR, toR) * 10);
      this.time.addEvent({ delay: 75, repeat: 3, callback: function () {
        if (!rec.container.active) return; // personnage retiré pendant le saut (capture, Fusion…)
        step++;
        var t = step / 4;
        rec.container.setPosition(Math.round(A.x + (B.x - A.x) * t), Math.round(A.y + (B.y - A.y) * t) - arc[step]);
        if (step === 4) {
          rec.container.setPosition(B.x, B.y).setDepth(10 + toR * 10);
          rec.sprite.play(rec.key + "-idle");
          rec.hopping = false;
        }
      } });
    }

    /* Capture : le personnage est touché puis tombe (images du kit), éclats aux couleurs du camp. */
    fall(rec) {
      var a = { x: rec.container.x, y: rec.container.y }, self = this;
      var body = this.add.sprite(a.x, a.y, rec.key, 8).setOrigin(0.5, FEET_Y / 64).setDepth(rec.container.depth);
      body.play(rec.key + "-fall");
      var levels = [1, 1, 1, 0.66, 0.33, 0], step = 0;
      this.time.addEvent({ delay: 120, repeat: 5, callback: function () {
        body.setAlpha(levels[step]); step++;
        if (step === 6) body.destroy();
      } });
      var pal = PAWN_PALETTES[rec.player], cols = [pal.main, pal.light, pal.dark, "#ffffff"];
      for (var i = 0; i < 12; i++) {
        var ang = (i / 12) * Math.PI * 2;
        this.pixelParticle(a.x, a.y - 12, Math.round(Math.cos(ang) * (6 + (i % 3) * 2)), Math.round(Math.sin(ang) * (5 + (i % 2) * 3)), cols[i % cols.length], 2, 6, 80, rec.r);
      }
      this.flashCell(rec.r, rec.c);
    }

    /* Transformation (protection, propriété, gel…) : clignotement en 4 pas + étincelles. */
    transformFlash(rec, p, gained) {
      var s = rec.sprite, step = 0;
      this.time.addEvent({ delay: 70, repeat: 3, callback: function () { step++; if (s.active) s.setAlpha(step % 2 ? 0.35 : 1); } });
      if (gained) {
        var a = this.anchor(p.r, p.c), pal = PAWN_PALETTES[p.player];
        for (var i = 0; i < 6; i++) this.pixelParticle(a.x - 6 + i * 2, a.y - 2, 0, -14 - (i % 3) * 3, i % 2 ? pal.gem : "#ffffff", 1, 5, 90, p.r);
      }
    }

    /* Apparition (Résurrection, Duplication, Fusion) : fondu en paliers + convergence. */
    materialize(rec, p) {
      var s = rec.sprite, step = 0, a = this.anchor(p.r, p.c);
      s.setAlpha(0.25);
      this.time.addEvent({ delay: 90, repeat: 2, callback: function () { step++; if (s.active) s.setAlpha([0.5, 0.75, 1][step - 1]); } });
      for (var i = 0; i < 8; i++) {
        var ang = (i / 8) * Math.PI * 2, dx = Math.round(Math.cos(ang) * 10), dy = Math.round(Math.sin(ang) * 10);
        this.pixelParticle(a.x + dx, a.y - 12 + dy, -dx, -dy, i % 2 ? "#ffffff" : PAWN_PALETTES[p.player].light, 1, 5, 70, p.r);
      }
    }

    pixelParticle(x, y, dx, dy, color, size, steps, delay, row) {
      var key = "px-" + size + "-" + color;
      canvasTex(this, key, size, size, function (put) { for (var a = 0; a < size; a++) for (var b = 0; b < size; b++) put(a, b, color); });
      var img = this.add.image(x, y, key).setOrigin(0, 0).setDepth(15 + (row || 0) * 10), step = 0;
      this.time.addEvent({ delay: delay || 90, repeat: steps - 1, callback: function () {
        step++;
        var t = step / steps;
        img.setPosition(Math.round(x + dx * t), Math.round(y + dy * t));
        if (step >= steps - 1) img.setAlpha(0.5);
        if (step === steps) img.destroy();
      } });
    }

    /* Flash d'une case : voile blanc sur la forme exacte de la dalle, en 4 paliers. */
    flashCell(r, c) {
      var key = "cellmask-" + this.terrainSeed + "-" + r + "-" + c, self = this;
      canvasTex(this, key, BW, BH, function (put) {
        eachCellPixel(r, c, liftOf(r, c, self.terrainSeed), function (x, y) { put(x, y, "#ffffff"); });
      });
      var img = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(3 + r * 10).setAlpha(0.6);
      var levels = [0.45, 0.3, 0.15, 0], step = 0;
      this.time.addEvent({ delay: 80, repeat: 3, callback: function () {
        img.setAlpha(levels[step]); step++;
        if (step === 4) img.destroy();
      } });
    }

    /* Effets de carte (CARD_FX), centrés sur le personnage de la case, 6 pas. */
    spawnFx(r, c, fx, big) {
      if (!fx) return;
      var a = this.anchor(r, c), x0 = a.x, y0 = a.y - 12, n = big ? 16 : 10, size = big ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * Math.PI * 2, dx, dy, sx = x0, sy = y0;
        if (fx.pattern === "ring" || fx.pattern === "rune") { dx = Math.round(Math.cos(ang) * 10); dy = Math.round(Math.sin(ang) * 6); }
        else if (fx.pattern === "snow") { sx = x0 + ((i % 5) - 2) * 3; sy = y0 - 14; dx = 0; dy = 14 + (i % 3) * 2; }
        else if (fx.pattern === "rise") { sx = x0 + ((i % 5) - 2) * 3; sy = y0 + 10; dx = 0; dy = -16 - (i % 3) * 3; }
        else if (fx.pattern === "converge") { sx = x0 + Math.round(Math.cos(ang) * 12); sy = y0 + Math.round(Math.sin(ang) * 10); dx = x0 - sx; dy = y0 - sy; }
        else if (fx.pattern === "swap") { dx = (i % 2 ? 1 : -1) * (4 + (i % 4) * 2); dy = ((i % 3) - 1) * 3; }
        else if (fx.pattern === "link") { dx = Math.round(Math.cos(ang) * 8); dy = 0; sy = y0 + ((i % 3) - 1) * 3; }
        else if (fx.pattern === "veil") { sx = x0 + ((i % 4) - 2) * 3; sy = y0 - 10; dx = 0; dy = 6; }
        else { dx = ((i % 5) - 2) * 4; dy = ((Math.floor(i / 5) % 3) - 1) * 4 - 2; }
        this.pixelParticle(sx, sy, dx, dy, fx.colors[i % fx.colors.length], size, 6, 90, r);
      }
      if (fx.pattern === "ring" || fx.pattern === "rune") this.runeCircle(r, c, fx.colors[0]);
    }

    runeCircle(r, c, color) {
      var key = "ring-fx-" + color, a = this.anchor(r, c);
      canvasTex(this, key, 25, 11, function (put) {
        for (var k = 0; k < 64; k++) {
          if (k % 4 === 3) continue;
          var ang = k / 64 * Math.PI * 2;
          put(Math.round(12 + Math.cos(ang) * 12), Math.round(5 + Math.sin(ang) * 5), color);
        }
      });
      var img = this.add.image(a.x - 12, a.y - 5, key).setOrigin(0, 0).setDepth(4 + r * 10).setAlpha(0.4), step = 0;
      this.time.addEvent({ delay: 90, repeat: 4, callback: function () {
        step++;
        img.setAlpha([0.7, 1, 0.7, 0.35, 0][step - 1]);
        if (step === 5) img.destroy();
      } });
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    gameRef = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "phaser-board",
      width: BW, height: BH,
      transparent: true,
      pixelArt: true, roundPixels: true, antialias: false,
      scale: { mode: Phaser.Scale.NONE, zoom: 2 },
      banner: false,
      scene: [BootScene, BoardScene]
    });
    window.addEventListener("resize", fitToContainer);
    if (window.matchMedia) {
      try { window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)").addEventListener("change", fitToContainer); } catch (e) { /* navigateurs anciens */ }
    }
  });
})();
