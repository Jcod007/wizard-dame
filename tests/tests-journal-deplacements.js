"use strict";
/* Journal (« Ce qui vient de se passer ») — correction 2026-10-23 :
   le journal du moteur (g.log, affiché par ui-dom.js) doit enregistrer
   les déplacements normaux (joueur, forme, de -> vers en coordonnées
   humaines), les captures (entrée existante, sans doublon) et les
   passages de tour. Avant la correction, seuls cartes/captures/effets
   étaient journalisés : un déplacement normal + une fin de tour ne
   laissaient aucune trace. */
const M = require("../engine.js");
let pass = 0, fail = 0;
function T(name, cond, extra) { if (cond) { pass++; console.log("PASS  " + name + (extra ? "  [" + extra + "]" : "")); } else { fail++; console.log("FAIL  " + name + (extra ? "  [" + extra + "]" : "")); } }
function name(r, c) { return "ABCDEFGH"[c] + (8 - r); } // convention indépendante, doit correspondre au moteur
function fresh(seed) { const g = M.createGame(seed == null ? 42 : seed); const pools = { 1: [], 2: [] }; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g.board[r][c]) pools[g.board[r][c].player].push(g.board[r][c]); return { g, pools }; }
function startGame(seed) { const { g, pools } = fresh(seed); M.chooseEssential(g, 1, pools[1][0].id); g.phase = "select2"; g.current = 2; M.chooseEssential(g, 2, pools[2][0].id); return { g, pools }; }
function clearBoard(g) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null; }
function put(g, pawn, r, c) { g.board[r][c] = pawn; return pawn; }
function firstPlainMove(g, player) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = g.board[r][c]; if (!p || p.player !== player) continue;
    const m = M.pawnMoves(g, r, c).find(x => !x.capture);
    if (m) return { r, c, move: m, pawn: p };
  }
  return null;
}
function countInLog(g, s) { return g.log.filter(e => e === s).length; }

// 1. Déplacement normal journalisé (joueur, forme, de -> vers), puis passage de tour journalisé
{
  const { g } = startGame();
  const found = firstPlainMove(g, 1);
  T("J1 un coup normal existe au départ", !!found);
  const before = g.log.length;
  const res = found ? M.applyMove(g, found.r, found.c, found.move) : { ok: false };
  T("J2 déplacement appliqué", res.ok === true, res.error || "");
  const expected = "Joueur 1 déplace un pion " + M.pieceName(found.pawn.shape) + " de " + name(found.r, found.c) + " vers " + name(found.move.toR, found.move.toC) + ".";
  const newEntries = g.log.slice(before);
  T("J3 entrée de déplacement exacte ajoutée", newEntries.filter(e => e === expected).length === 1, JSON.stringify(newEntries));
  const res2 = M.endTurn(g);
  T("J4 fin de tour acceptée", res2.ok !== false && g.current === 2);
  T("J5 entrée « Au tour du Joueur 2. » ajoutée une seule fois", countInLog(g, "Au tour du Joueur 2.") === 1, JSON.stringify(g.log.slice(-3)));

  // 2. Tour du Joueur 2 puis retour : une seule entrée « Au tour du Joueur 1. »
  const found2 = firstPlainMove(g, 2);
  if (found2) M.applyMove(g, found2.r, found2.c, found2.move);
  M.endTurn(g);
  T("J6 retour au Joueur 1 journalisé une seule fois", g.current === 1 && countInLog(g, "Au tour du Joueur 1.") === 1, JSON.stringify(g.log.slice(-3)));
}

// 3. Capture : entrée de capture existante conservée, AUCUNE entrée « déplace » en doublon
{
  const { g, pools } = startGame(); clearBoard(g);
  const a = put(g, pools[1][1], 4, 4), v = put(g, pools[2][1], 4, 5);
  put(g, pools[1][0], 7, 0); put(g, pools[2][0], 0, 7);
  g.phase = "move"; g.current = 1;
  const cap = M.pawnMoves(g, 4, 4).find(m => m.toR === 4 && m.toC === 6 && m.capture);
  T("J7 capture (4,4)->(4,6) proposée", !!cap);
  const before = g.log.length;
  const res = cap ? M.applyMove(g, 4, 4, cap) : { ok: false };
  const newEntries = g.log.slice(before);
  T("J8 capture appliquée et journalisée", res.ok === true && newEntries.some(e => e.indexOf("capture un pion " + M.pieceName(v.shape)) !== -1), JSON.stringify(newEntries));
  T("J9 aucune entrée « déplace » pour une capture", !newEntries.some(e => e.indexOf("déplace un pion") !== -1), JSON.stringify(newEntries));
  T("J10 attaquant bien arrivé en (4,6)", g.board[4][6] === a && g.captured[1] === 1);
}

console.log("=== RESULTAT : " + pass + " PASS / " + fail + " FAIL ===");
process.exitCode = fail ? 1 : 0;
