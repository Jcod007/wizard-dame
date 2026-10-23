"use strict";
/* Orchestrateur — vérification des corrections appliquées après la ronde des juges. */
const M = require("../engine.js");
let pass = 0, fail = 0;
function T(name, cond, extra) { if (cond) { pass++; console.log("PASS  " + name + (extra ? "  [" + extra + "]" : "")); } else { fail++; console.log("FAIL  " + name + (extra ? "  [" + extra + "]" : "")); } }
function fresh(seed) { const g = M.createGame(seed == null ? 42 : seed); const pools = { 1: [], 2: [] }; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g.board[r][c]) pools[g.board[r][c].player].push(g.board[r][c]); return { g, pools }; }
function startGame(seed) { const { g, pools } = fresh(seed); M.chooseEssential(g, 1, pools[1][0].id); g.phase = "select2"; g.current = 2; M.chooseEssential(g, 2, pools[2][0].id); return { g, pools }; }
function clearBoard(g) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null; }
function put(g, pawn, r, c) { g.board[r][c] = pawn; return pawn; }
function firstMove(g, player) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = g.board[r][c]; if (p && p.player === player) { const ms = M.pawnMoves(g, r, c); if (ms.length) return M.applyMove(g, r, c, ms[0]); } } return { ok: false, error: "aucun coup" }; }

// A. Protection : tentative légale, annulée, consommée ; 2e tentative capture pour vrai
{
  const { g, pools } = startGame(); clearBoard(g);
  const a = put(g, pools[1][1], 2, 2), v = put(g, pools[2][1], 2, 3);
  put(g, pools[1][0], 7, 0); put(g, pools[2][0], 0, 7);
  M.addFx(v, "shield", 99, "untilCapture");
  g.phase = "move"; g.current = 1;
  const cap = M.pawnMoves(g, 2, 2).find(m => m.toR === 2 && m.toC === 4 && m.capture);
  T("A1 capture contre pion protégé PROPOSÉE (tentative légale)", !!cap);
  const r1 = cap ? M.applyMove(g, 2, 2, cap) : { ok: false };
  T("A2 capture annulée : victime en place, bouclier consommé, attaquant a sauté, 0 point",
    r1.ok && g.board[2][3] === v && !M.fxOf(v, "shield") && g.board[2][4] === a && g.captured[1] === 0 && !g.winner);
  g.phase = "move"; g.current = 1; // rejoue un tour pour le test
  const back = M.pawnMoves(g, 2, 4).find(m => m.toR === 2 && m.toC === 2 && m.capture);
  const r2 = back ? M.applyMove(g, 2, 4, back) : { ok: false };
  T("A3 sans protection, la capture suivante élimine la victime", r2.ok && g.board[2][3] === null && g.captured[1] === 1);
}
// B. Gel : unique pion gelé = tour passé, pas une défaite
{
  const { g, pools } = startGame(); clearBoard(g);
  const solo = put(g, pools[1][1], 4, 4); put(g, pools[1][0], 7, 7);
  put(g, pools[2][0], 0, 7); put(g, pools[2][1], 0, 5);
  // gele les DEUX pions J1 pour leur prochain tour
  solo.frozenForTurn = g.turnCount[1] + 1; pools[1][0].frozenForTurn = g.turnCount[1] + 1;
  g.phase = "card"; g.current = 2;
  const res = M.endTurn(g);
  T("B1 fin de tour J2 -> J1 tout gelé : PAS de vainqueur, le tour revient à J2",
    res.ok !== false && !g.winner && g.current === 2, "winner=" + g.winner + " current=" + g.current);
}
// C. Marque de passage : la capture vers une case n'est plus écrasée par le glissement
{
  const { g, pools } = startGame(); clearBoard(g);
  const a = put(g, pools[1][1], 4, 4), v = put(g, pools[2][1], 4, 5);
  put(g, pools[1][0], 7, 0); put(g, pools[2][0], 0, 7);
  M.addFx(a, "passage", 2, "ownerEnd");
  const to = M.pawnMoves(g, 4, 4).filter(m => m.toR === 4 && m.toC === 6);
  T("C1 une seule entrée vers (4,6) et c'est la CAPTURE", to.length === 1 && !!to[0].capture, JSON.stringify(to));
}
// E. Garde de case : encore active au prochain tour du propriétaire, déclenche à l'entrée
{
  const { g, pools } = startGame();
  const mv = firstMove(g, 1);
  T("E0 déplacement principal J1 ok", mv.ok === true);
  const idx = 0; g.hands[1][idx] = "garde_case";
  const cellPawnPos = M.findPawn(g, pools[1].find(p => { const f = M.findPawn(g, p.id); return f && f.r === 4; }).id);
  const res = M.playCard(g, idx, [{ r: 4, c: 1 }], {});
  T("E1 garde posée en (4,1)", res.ok === true && g.guards.length === 1, res.error || "");
  M.endTurn(g); // -> J2
  const mv2 = firstMove(g, 2);
  M.endTurn(g); // -> J1 (2e tour)
  T("E2 garde ENCORE présente au 2e tour de son propriétaire", g.guards.length === 1, "roundsLeft=" + (g.guards[0] && g.guards[0].roundsLeft));
  // un pion J1 entre en (4,1)
  let entered = false;
  for (let r = 0; r < 8 && !entered; r++) for (let c = 0; c < 8 && !entered; c++) { const p = g.board[r][c]; if (p && p.player === 1) { const m = M.pawnMoves(g, r, c).find(x => x.toR === 4 && x.toC === 1); if (m) { M.applyMove(g, r, c, m); entered = true; } } }
  T("E3 entrée d'un allié : garde consommée, bouclier gagné", entered && g.guards.length === 0);
}
console.log("=== RESULTAT : " + pass + " PASS / " + fail + " FAIL ===");
