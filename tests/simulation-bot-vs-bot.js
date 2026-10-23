/* Simulation bot-vs-bot contre engine.js — bots aléatoires (déplacement
 * aléatoire parmi les coups légaux, carte aléatoire avec cibles candidates
 * selon def.cible, choix par défaut pour les cartes à options).
 * Versionnée dans le projet (règle « preuves rejouables » de la ronde des juges).
 * Usage : node tests/simulation-bot-vs-bot.js [nbParties]
 * 1 pli = 1 tour complet d'un joueur (déplacement + carte éventuelle). */
"use strict";
const M = require("../engine.js");

function rand(rng, n) { return Math.floor(rng() * n); }
function cellsOf(g, pred) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = g.board[r][c];
    if (pred(p, r, c)) out.push({ r, c });
  }
  return out;
}
function candidates(g, id) {
  const def = M.CARDS[id], me = g.current, op = me === 1 ? 2 : 1;
  const own = cellsOf(g, p => p && p.player === me);
  const ene = cellsOf(g, p => p && p.player === op);
  const emp = cellsOf(g, p => !p);
  const sets = [];
  const t = def.cible;
  if (t === "none" || t === "noneChoice") sets.push([]);
  else if (t === "ownPawn") own.forEach(x => sets.push([x]));
  else if (t === "enemyPawn") ene.forEach(x => sets.push([x]));
  else if (t === "anyPawn") own.concat(ene).forEach(x => sets.push([x]));
  else if (t === "emptyCell" || t === "graveyardCell") emp.slice(0, 14).forEach(x => sets.push([x]));
  else if (t === "ownPair") { for (let i = 0; i < own.length; i++) for (let j = 0; j < own.length; j++) if (i !== j) sets.push([own[i], own[j]]); }
  else if (t === "enemyPair") { for (let i = 0; i < ene.length; i++) for (let j = 0; j < ene.length; j++) if (i !== j) sets.push([ene[i], ene[j]]); }
  else if (t === "ownPawnOrCell") { own.forEach(x => sets.push([x])); emp.slice(0, 8).forEach(x => sets.push([x])); }
  else if (t === "ownPawnCell") { own.forEach(o => emp.slice(0, 6).forEach(e => sets.push([o, e]))); }
  return sets;
}
function choicesFor(g, id) {
  const ch = {};
  if (id === "mutation") ch.propId = "aegis";
  if (id === "dernier_pari") ch.pariMode = "protect";
  if (id === "resurrection") ch.graveyardIndex = 0;
  if (id === "interference") { ch.revealIndex = 0; ch.oppDiscardIndex = 0; }
  if (id === "dernier_rempart") ch.discardHandIndex = g.hands[g.current].length > 1 ? 1 : 0;
  return ch;
}

function run(N) {
  let completed = 0, errors = 0, totalPlies = 0, essWins = 0, noMoveWins = 0, otherWins = 0;
  const wins = { 1: 0, 2: 0 };
  for (let s = 1; s <= N; s++) {
    try {
      const rng = M.makeRng(1000 + s);
      const g = M.createGame(5000 + s);
      for (const pl of [1, 2]) {
        if (pl === 2) { g.phase = "select2"; g.current = 2; } // passation, comme l'UI
        const mine = cellsOf(g, p => p && p.player === pl);
        const pick = mine[rand(rng, mine.length)];
        const res = M.chooseEssential(g, pl, g.board[pick.r][pick.c].id);
        if (!res.ok) throw new Error("chooseEssential: " + res.error);
      }
      let plies = 0, guard = 0;
      while (g.phase !== "over" && guard++ < 4000) {
        if (g.phase === "move") {
          const mine = cellsOf(g, p => p && p.player === g.current);
          const movable = mine.filter(x => M.pawnMoves(g, x.r, x.c).length > 0);
          if (!movable.length) {
            const r = M.endTurn(g); if (!r.ok) throw new Error("endTurn sans coup: " + r.error);
            plies++; continue;
          }
          const from = movable[rand(rng, movable.length)];
          const moves = M.pawnMoves(g, from.r, from.c);
          const res = M.applyMove(g, from.r, from.c, moves[rand(rng, moves.length)]);
          if (!res.ok) throw new Error("applyMove: " + res.error);
          if (g.phase === "over") plies++;
        } else if (g.phase === "card") {
          let played = false;
          if (rng() < 0.65) {
            const order = g.hands[g.current].map((_, i) => i);
            for (let i = order.length - 1; i > 0; i--) { const j = rand(rng, i + 1); const t = order[i]; order[i] = order[j]; order[j] = t; }
            for (const hi of order) {
              const id = g.hands[g.current][hi];
              if (M.cardPrecheck(g, id)) continue;
              const sets = candidates(g, id);
              for (let k = 0; k < Math.min(sets.length, 14) && !played; k++) {
                const res = M.playCard(g, hi, sets[rand(rng, sets.length)], choicesFor(g, id));
                if (res.ok) played = true;
              }
              if (played) break;
            }
          }
          if (!played) { const r = M.endTurn(g); if (!r.ok) throw new Error("endTurn: " + r.error); }
          plies++;
        } else { throw new Error("phase inattendue: " + g.phase); }
      }
      if (g.phase === "over") {
        completed++; totalPlies += plies; wins[g.winner]++;
        const reason = g.winReason || "";
        if (/essentielle/i.test(reason)) essWins++;
        else if (/aucun coup|sans coup|immobil/i.test(reason)) noMoveWins++;
        else otherWins++;
      } else { errors++; console.log("partie", s, "non terminée, phase =", g.phase); }
    } catch (e) { errors++; console.log("partie", s, "ERREUR:", e.message); }
  }
  console.log("=== SIM engine.js : " + completed + "/" + N + " terminées, erreurs=" + errors +
    ", plis moyens=" + (totalPlies / Math.max(1, completed)).toFixed(1) +
    ", vainqueurs J1/J2=" + wins[1] + "/" + wins[2] +
    ", victoires essentielle=" + essWins + ", sans-coup=" + noMoveWins + ", autres=" + otherWins);
  process.exitCode = (errors || completed !== N) ? 1 : 0;
}

run(parseInt(process.argv[2] || "200", 10));
