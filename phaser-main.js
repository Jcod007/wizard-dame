"use strict";
/*
 * Wizard Dame — phaser-main.js : rendu du PLATEAU sous Phaser 3.60.0
 * (moteur décidé par Ekoue le 2026-10-23 ; plan de migration de la synthèse
 * des juges, §5). Aucune logique de jeu ici : les règles vivent dans
 * engine.js (pur, testé sous Node) ; l'UI cartes/menus vit dans ui-dom.js.
 *
 * Pont avec ui-dom.js :
 *   - ui-dom appelle WDBoard.sync(view, hop) après chaque rendu ;
 *   - les clics sur les cases remontent par window.WDCellClick(r, c) ;
 *   - ui-dom appelle WDBoard.spawnFx / WDBoard.flashCell pour les effets.
 * Textures générées au Boot depuis les DONNÉES pixel d'engine.js
 * (SPRITE_MAPS 16x16 par forme et par palette) via canvas textures —
 * aucun asset externe, aucune étape de build.
 */

(function () {
  var CELL = 64, BOARD_PX = CELL * 8, PAWN_SIZE = 56; // pion = 88 % de la case, comme l'ancien CSS
  var sceneRef = null;        // scène Board une fois créée
  var storedView = null;      // dernier view-model reçu (avant/après boot)
  var storedHop = null;

  window.WDBoard = {
    sync: function (view, hop) {
      storedView = view; storedHop = hop || null;
      if (sceneRef) sceneRef.applyView();
    },
    spawnFx: function (r, c, fx, big) { if (sceneRef) sceneRef.spawnFx(r, c, fx, big); },
    flashCell: function (r, c) { if (sceneRef) sceneRef.flashCell(r, c); },
    isReady: function () { return !!sceneRef; }
  };

  function pawnKey(player, shape) { return "pawn-" + player + "-" + shape; }

  /* Même règle de couleur que l'ancien pawnSpriteURL() de game.js :
     contour sombre, gemme centrale, lumière en haut à gauche, couleur pleine. */
  function generateTextures(scene) {
    [1, 2].forEach(function (player) {
      var pal = PLAYER_PALETTES[player];
      SHAPES.forEach(function (shape) {
        var map = SPRITE_MAPS[shape];
        var tex = scene.textures.createCanvas(pawnKey(player, shape), 16, 16);
        var ctx = tex.getContext();
        ctx.clearRect(0, 0, 16, 16);
        for (var r = 0; r < 16; r++) for (var c = 0; c < 16; c++) {
          if (map[r][c] !== "#") continue;
          var edge = !map[r - 1] || map[r - 1][c] !== "#" || !map[r + 1] || map[r + 1][c] !== "#" ||
                     map[r][c - 1] !== "#" || map[r][c + 1] !== "#";
          var col;
          if (edge) col = pal.outline;
          else if ((r === 7 || r === 8) && (c === 7 || c === 8)) col = pal.gem;
          else if (r + c <= 9) col = pal.light;
          else col = pal.main;
          ctx.fillStyle = col; ctx.fillRect(c, r, 1, 1);
        }
        tex.refresh();
      });
    });
    var px = scene.textures.createCanvas("px", 1, 1);
    var pctx = px.getContext();
    pctx.fillStyle = "#ffffff"; pctx.fillRect(0, 0, 1, 1);
    px.refresh();
  }

  class BootScene extends Phaser.Scene {
    constructor() { super({ key: "Boot" }); }
    create() {
      generateTextures(this);
      this.scene.start("Board");
    }
  }

  var CHIP_BG = { "": "#cfc3ee", gold: "#f5c542", red: "#fca5a5", blue: "#7dd3fc", gray: "#94a3b8" };

  class BoardScene extends Phaser.Scene {
    constructor() { super({ key: "Board" }); }

    create() {
      var self = this;
      this.pawnRecs = {};   // id -> {container, img, r, c, hopping}
      this.dynamic = [];    // objets reconstruits à chaque sync (marqueurs, surbrillances, leurres)
      // Cases du plateau : deux tons durs par couleur, comme l'ancien CSS.
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
        var light = (r + c) % 2 === 0;
        var idx = r * 8 + c;
        var fill = light ? (idx % 2 === 0 ? 0xb3a4dc : 0xcfc3ee)
                         : (idx % 2 === 1 ? 0x483a80 : 0x5b4a9e);
        var sq = this.add.rectangle((c + 0.5) * CELL, (r + 0.5) * CELL, CELL, CELL, fill);
        sq.setDepth(0);
        sq.setInteractive({ useHandCursor: true });
        (function (rr, cc) {
          sq.on("pointerdown", function () {
            if (typeof window.WDCellClick === "function") window.WDCellClick(rr, cc);
          });
        })(r, c);
      }
      sceneRef = this;
      if (storedView) this.applyView();
    }

    addDynamic(obj) { this.dynamic.push(obj); return obj; }

    applyView() {
      var view = storedView, hop = storedHop;
      storedHop = null;
      if (!view) return;
      var self = this;
      // Nettoyer marqueurs / surbrillances / leurres (reconstruits à chaque fois)
      this.dynamic.forEach(function (o) { o.destroy(); });
      this.dynamic = [];

      // Arrivées légales du pion sélectionné
      view.targets.forEach(function (t) {
        var x = (t.c + 0.5) * CELL, y = (t.r + 0.5) * CELL;
        if (t.capture) {
          var outer = self.add.rectangle(x, y, CELL - 4, CELL - 4).setStrokeStyle(4, 0xff5d5d).setFillStyle(0xffffff, 0);
          var inner = self.add.rectangle(x, y, 41, 41).setStrokeStyle(4, 0xff5d5d).setFillStyle(0xffffff, 0);
          outer.setDepth(1); inner.setDepth(1);
          self.addDynamic(outer); self.addDynamic(inner);
          self.tweens.add({ targets: [outer, inner], scaleX: 1.12, scaleY: 1.12, duration: 220, yoyo: true, repeat: -1 });
        } else {
          var dot = self.add.rectangle(x, y, 19, 19, 0x37d67a).setStrokeStyle(3, 0x0b0714);
          dot.setDepth(1);
          self.addDynamic(dot);
          self.tweens.add({ targets: dot, scaleX: 1.18, scaleY: 1.18, duration: 220, yoyo: true, repeat: -1 });
        }
      });
      // Case sélectionnée
      if (view.selected) {
        var sel = this.add.rectangle((view.selected.c + 0.5) * CELL, (view.selected.r + 0.5) * CELL, CELL - 4, CELL - 4)
          .setStrokeStyle(4, 0xf5c542).setFillStyle(0xffffff, 0);
        sel.setDepth(5);
        this.addDynamic(sel);
      }
      // Cibles de carte déjà cliquées
      view.cardTargets.forEach(function (t) {
        var ct = self.add.rectangle((t.c + 0.5) * CELL, (t.r + 0.5) * CELL, CELL - 4, CELL - 4)
          .setStrokeStyle(4, 0xf5c542).setFillStyle(0xffffff, 0);
        ct.setDepth(5);
        self.addDynamic(ct);
      });
      // Gardes de case et pièges (visibles du propriétaire seulement — filtrés par ui-dom)
      view.guards.forEach(function (gd) {
        var t = self.add.text(gd.c * CELL + 4, gd.r * CELL + CELL - 22, "✦",
          { fontFamily: "monospace", fontSize: "18px", color: "#f5c542" });
        t.setDepth(2); self.addDynamic(t);
      });
      view.traps.forEach(function (tp) {
        var t = self.add.text(tp.c * CELL + 4, tp.r * CELL + 2, "✷",
          { fontFamily: "monospace", fontSize: "18px", color: "#facc15" });
        t.setDepth(2); self.addDynamic(t);
      });
      // Leurres (pions fantômes semi-transparents)
      view.decoys.forEach(function (d) {
        var img = self.add.image((d.c + 0.5) * CELL, (d.r + 0.5) * CELL, pawnKey(d.owner, d.shape));
        img.setDisplaySize(PAWN_SIZE, PAWN_SIZE);
        img.setAlpha(0.55); img.setTint(0x9a8fb0);
        img.setDepth(3);
        self.addDynamic(img);
      });

      // Pions : sprites persistants par id (pour animer le saut)
      var seen = {};
      view.pawns.forEach(function (p) {
        seen[p.id] = true;
        var x = (p.c + 0.5) * CELL, y = (p.r + 0.5) * CELL;
        var rec = self.pawnRecs[p.id];
        if (!rec) {
          var img = self.add.image(0, 0, pawnKey(p.player, p.shape));
          img.setDisplaySize(PAWN_SIZE, PAWN_SIZE);
          var container = self.add.container(x, y, [img]);
          container.setDepth(4);
          rec = { container: container, img: img, r: p.r, c: p.c, hopping: false, chipObjs: [] };
          self.pawnRecs[p.id] = rec;
        }
        var oldR = rec.r, oldC = rec.c;
        rec.r = p.r; rec.c = p.c;
        if (hop && hop.pawnId === p.id && !rec.hopping && (oldR !== p.r || oldC !== p.c)) {
          self.startHop(rec, oldR, oldC, p.r, p.c);
        } else if (!rec.hopping) {
          rec.container.setPosition(x, y);
        }
        self.renderChips(rec, p);
      });
      Object.keys(this.pawnRecs).forEach(function (id) {
        if (!seen[id]) {
          self.pawnRecs[id].container.destroy();
          delete self.pawnRecs[id];
        }
      });
    }

    renderChips(rec, p) {
      rec.chipObjs.forEach(function (o) { o.destroy(); });
      rec.chipObjs = [];
      p.chips.forEach(function (chip, i) {
        var n = p.chips.length;
        var t = this.add.text(30 - (n - 1 - i) * 13, -31, chip.t, {
          fontFamily: "monospace", fontSize: "10px", color: "#0b0714",
          backgroundColor: CHIP_BG[chip.cls] || "#cfc3ee", padding: { x: 2, y: 1 }
        });
        t.setOrigin(1, 0);
        rec.container.add(t);
        rec.chipObjs.push(t);
      }, this);
      if (p.suspicion) {
        var s = this.add.text(30, 31, "?", {
          fontFamily: "monospace", fontSize: "11px", color: "#ffffff",
          backgroundColor: "#b91c1c", padding: { x: 3, y: 1 }
        });
        s.setOrigin(1, 1);
        rec.container.add(s);
        rec.chipObjs.push(s);
      }
    }

    /* Saut image par image : 4 pas discrets de 70 ms, arc au milieu —
       équivalent Phaser de l'ancienne animation CSS steps(4). */
    startHop(rec, fromR, fromC, toR, toC) {
      var sx = (fromC + 0.5) * CELL, sy = (fromR + 0.5) * CELL;
      var tx = (toC + 0.5) * CELL, ty = (toR + 0.5) * CELL;
      rec.hopping = true;
      rec.container.setPosition(sx, sy);
      var step = 0;
      this.time.addEvent({
        delay: 70, repeat: 3,
        callback: function () {
          step++;
          var t = step / 4;
          var x = sx + (tx - sx) * t;
          var y = sy + (ty - sy) * t - Math.sin(Math.PI * t) * CELL * 0.14;
          rec.container.setPosition(x, y);
          var size = (step === 2) ? PAWN_SIZE * 1.06 : PAWN_SIZE;
          rec.img.setDisplaySize(size, size);
          if (step === 4) {
            rec.container.setPosition(tx, ty);
            rec.img.setDisplaySize(PAWN_SIZE, PAWN_SIZE);
            rec.hopping = false;
          }
        }
      });
    }

    /* Flash d'une case en 5 pas (équivalent de l'ancien cardFlash steps(5)). */
    flashCell(r, c) {
      var rect = this.add.rectangle((c + 0.5) * CELL, (r + 0.5) * CELL, CELL, CELL, 0xffffff, 0.55);
      rect.setDepth(7);
      var step = 0;
      this.time.addEvent({
        delay: 90, repeat: 4,
        callback: function () {
          step++;
          rect.setAlpha(0.55 * (1 - step / 5));
          if (step === 5) rect.destroy();
        }
      });
    }

    /* Particules pixel par carte : mêmes motifs que l'ancien spawnFx DOM
       (burst | ring | rune | snow | rise | converge | swap | link | veil),
       déplacement quantifié en 6 pas — image par image, aucun lissage. */
    spawnFx(r, c, fx, big) {
      if (!fx) return;
      var cx = (c + 0.5) * CELL, cy = (r + 0.5) * CELL;
      var n = big ? 18 : 12;
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * Math.PI * 2;
        var dx = 0, dy = 0;
        if (fx.pattern === "ring" || fx.pattern === "rune") { dx = Math.round(Math.cos(ang) * 26); dy = Math.round(Math.sin(ang) * 26); }
        else if (fx.pattern === "snow") { dx = ((i % 5) - 2) * 9; dy = 20 + (i % 4) * 8; }
        else if (fx.pattern === "rise") { dx = ((i % 5) - 2) * 8; dy = -18 - (i % 4) * 9; }
        else if (fx.pattern === "converge") { dx = -Math.round(Math.cos(ang) * 30); dy = -Math.round(Math.sin(ang) * 30); }
        else { dx = ((i % 5) - 2) * 13; dy = ((Math.floor(i / 5) % 3) - 1) * 15 - 6; }
        var fromX = fx.pattern === "converge" ? -dx : 0;
        var fromY = fx.pattern === "converge" ? -dy : 0;
        var img = this.add.image(cx + fromX, cy + fromY, "px");
        img.setDisplaySize(7, 7);
        img.setTint(Phaser.Display.Color.HexStringToColor(fx.colors[i % fx.colors.length]).color);
        img.setDepth(6);
        (function (img2, fx0, fy0, dx2, dy2) {
          var state = { t: 0 };
          this.tweens.add({
            targets: state, t: 1, duration: 600,
            onUpdate: function () {
              var stepT = Math.floor(state.t * 6) / 6; // 6 pas discrets
              img2.setPosition(cx + fx0 + (dx2 - fx0) * stepT, cy + fy0 + (dy2 - fy0) * stepT);
              img2.setAlpha(1 - stepT * 0.9);
            },
            onComplete: function () { img2.destroy(); }
          });
        }).call(this, img, fromX, fromY, dx, dy);
      }
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "phaser-board",
      width: BOARD_PX,
      height: BOARD_PX,
      backgroundColor: "#0b0714",
      pixelArt: true, // sprites nets : aucun anticrénelage, aucun lissage
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [BootScene, BoardScene]
    });
  });
})();
