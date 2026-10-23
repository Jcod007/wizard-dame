"use strict";
/* Juge script du code — tests reconstruits indépendamment (ronde des juges, 2026-10-23).
 * Charge engine.js sous Node.
 *
 * Bugs CONNUS : reproductions de comportements que le jeu n'a PAS encore corrigés,
 * en attente d'une décision de conception d'Ekoue (backlog §6.3 du README).
 * Ils s'affichent « CONNU » et ne font pas échouer la suite. Si l'un d'eux se
 * met à passer, la suite ÉCHOUE avec « CORRIGÉ » : retire-le alors de KNOWN.
 * Tout autre échec est un vrai échec. */
const M = require("../engine.js");
const KNOWN = {
  B3: "durée du Silence : expire un tour trop tard (backlog : durées Silence/Lien)",
  B4: "Dissipation ne retire pas un gel en cours (backlog : Dissipation vs gel)",
  B5: "J2 commence son premier tour avec 4 cartes (backlog)",
  B7: "Lien contourné par les cartes de déplacement (backlog)",
  B8: "Repoussement : un seul pousseur considéré (règle à préciser)",
  B9: "Réversion après Résurrection restaure les propriétés d'avant la mort (à trancher)",
  B12: "Piège : durée asymétrique selon le joueur (backlog)",
  B13: "Anti re-gel contournable en chaîne (backlog)"
};
let pass = 0, fail = 0, known = 0;
function T(name, cond, extra) {
  const id = name.split(" ")[0], why = KNOWN[id];
  const info = extra ? "  [" + extra + "]" : "";
  if (why && !cond) { known++; console.log("CONNU " + name + info + "  — " + why); return; }
  if (why && cond) { fail++; console.log("FAIL  " + name + "  — CORRIGÉ : retirer " + id + " de KNOWN"); return; }
  if (cond) { pass++; console.log("PASS  " + name + info); }
  else { fail++; console.log("FAIL  " + name + info); }
}
function fresh(seed) {
  const g = M.createGame(seed == null ? 42 : seed);
  const pools = { 1: [], 2: [] };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g.board[r][c]) pools[g.board[r][c].player].push(g.board[r][c]);
  return { g, pools };
}
function startGame(seed) { // essentielles choisies, phase move, current 1, turnCount 1/0
  const { g, pools } = fresh(seed);
  M.chooseEssential(g, 1, pools[1][0].id); g.phase = "select2"; g.current = 2; // simule le bouton passation de l'UI
  M.chooseEssential(g, 2, pools[2][0].id);
  return { g, pools };
}
function clearBoard(g) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[r][c] = null; }
function put(g, pawn, r, c) { g.board[r][c] = pawn; return pawn; }
function moveFirst(g, pawn, tr, tc) {
  const f = M.findPawn(g, pawn.id); const mv = M.pawnMoves(g, f.r, f.c).find(m => m.toR === tr && m.toC === tc);
  return mv ? M.applyMove(g, f.r, f.c, mv) : { ok: false, error: "pas de coup vers " + tr + "," + tc };
}

console.log("=== A. VERIFICATIONS ANNONCEES ===");
// A1 mise en place
{
  const { g } = fresh();
  let n1 = 0, n2 = 0, darkOk = true, rowsOk = true;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = g.board[r][c]; if (!p) continue;
    if (p.player === 1) { n1++; if (r < 5) rowsOk = false; } else { n2++; if (r > 2) rowsOk = false; }
    if ((r + c) % 2 !== 1) darkOk = false; }
  T("A1 setup 12+12, cases foncees, rangees de depart", n1 === 12 && n2 === 12 && darkOk && rowsOk, "J1=" + n1 + " J2=" + n2);
  T("A2 mains de depart 3, decks 34, total 37/joueur",
    g.hands[1].length === 3 && g.hands[2].length === 3 && g.decks[1].length === 34 && g.decks[2].length === 34,
    "mains " + g.hands[1].length + "/" + g.hands[2].length + " decks " + g.decks[1].length + "/" + g.decks[2].length);
}
// A3 mouvements 8 directions, cases claires comprises
{
  const { g, pools } = fresh(); clearBoard(g);
  const p = put(g, pools[1][0], 4, 4);
  const dests = M.pawnMoves(g, 4, 4).map(m => m.toR + "," + m.toC).sort();
  T("A3 pion seul au centre : 8 destinations (dont cases claires)", dests.length === 8, dests.join(" "));
}
// A4 capture par saut + pas de chaine
{
  const { g, pools } = startGame(); clearBoard(g);
  const a = put(g, pools[1][0], 2, 2), v = put(g, pools[2][1], 2, 3), v2 = put(g, pools[2][2], 3, 5);
  put(g, pools[1][1], 7, 0); put(g, pools[2][0], 0, 7); // l'essentielle J2 est pools[2][0], mise a l'abri
  g.phase = "move"; g.current = 1;
  const cap = M.pawnMoves(g, 2, 2).find(m => m.toR === 2 && m.toC === 4);
  T("A4a capture orthogonale par saut proposee", !!cap && !!cap.capture);
  const res = cap ? M.applyMove(g, 2, 2, cap) : { ok: false };
  T("A4b capture appliquee : victime au cimetiere, phase=card", res.ok && g.board[2][3] === null && g.graveyard[2].includes(v) && g.phase === "card");
  const again = M.applyMove(g, 2, 4, { toR: 4, toC: 6 });
  T("A4c aucune chaine : 2e saut refuse en phase card", again.ok === false, again.error);
}
// A5 carte avant deplacement refusee
{
  const { g } = startGame();
  g.hands[1] = ["bouclier_runique"];
  const f = M.findPawn(g, g.hands && M.findPawn(g, Object.values(g.board.flat().find(p => p && p.player === 1) || {}).id || ""));
  const anyP1 = g.board.flat().find(p => p && p.player === 1);
  const pos = (() => { for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (g.board[r][c] === anyP1) return { r, c }; })();
  const res = M.playCard(g, 0, [pos], {});
  T("A5 carte refusee avant le deplacement principal", res.ok === false && /APRÈS/.test(res.error), res.error);
}
// A6 deuxieme carte refusee
{
  const { g, pools } = startGame();
  const mv = (() => { for (let r=0;r<8;r++) for (let c=0;c<8;c++) { const p=g.board[r][c]; if (p && p.player===1) { const ms=M.pawnMoves(g,r,c); if (ms.length) return {r,c,m:ms[0]}; } } })();
  M.applyMove(g, mv.r, mv.c, mv.m);
  g.hands[1] = ["bouclier_runique", "bouclier_runique"];
  const tgt = (() => { for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (g.board[r][c] && g.board[r][c].player===1) return {r,c}; })();
  const r1 = M.playCard(g, 0, [tgt], {});
  const r2 = M.playCard(g, 0, [tgt], {});
  T("A6a premiere carte acceptee", r1.ok === true, r1.error || "");
  T("A6b deuxieme carte refusee (1 max/tour)", r2.ok === false && /Une seule carte/.test(r2.error), r2.error);
}
// A7 limite de main 4 + pioche (et asymetrie J2 - voir B5)
let handJ2FirstTurn = null;
{
  const { g } = startGame();
  // J1 joue un coup puis termine
  const mv = (() => { for (let r=0;r<8;r++) for (let c=0;c<8;c++) { const p=g.board[r][c]; if (p && p.player===1) { const ms=M.pawnMoves(g,r,c); if (ms.length) return {r,c,m:ms[0]}; } } })();
  M.applyMove(g, mv.r, mv.c, mv.m); M.endTurn(g);
  handJ2FirstTurn = g.hands[2].length;
  M.endTurn(g); // J2 ne peut pas terminer sans bouger -> on verifie l'etat d'abord
}
// A8 bouclier / egide excluent la capture
{
  const { g, pools } = fresh(); clearBoard(g);
  const a = put(g, pools[1][0], 4, 4), v = put(g, pools[2][0], 4, 5);
  put(g, pools[1][1], 7, 7); put(g, pools[2][1], 0, 0);
  // Correction A de l'orchestrateur (§4.3) : la capture contre un pion protégé est une
  // tentative LÉGALE ; c'est sa résolution qui l'annule (voir B11). L'ancienne attente
  // « capture exclue des coups légaux » rendait Bouclier et Égide permanents.
  M.addFx(v, "shield", 99, "untilCapture");
  let caps = M.pawnMoves(g, 4, 4).filter(m => m.capture);
  T("A8a bouclier : la tentative de capture reste un coup legal", caps.length === 1);
  v.fx = []; M.addProp(v, "aegis");
  caps = M.pawnMoves(g, 4, 4).filter(m => m.capture);
  T("A8b egide : la tentative de capture reste un coup legal", caps.length === 1);
  T("A8c captureProtection rend shield/aegis selon l'etat", M.captureProtection(g, v) === "aegis");
}
// A9 capture de l'essentielle = victoire
{
  const { g, pools } = fresh(); clearBoard(g);
  const a = put(g, pools[1][0], 4, 4), v = put(g, pools[2][0], 4, 5);
  v.essential = true; g.phase = "move"; g.current = 1;
  const cap = M.pawnMoves(g, 4, 4).find(m => m.capture);
  const res = M.applyMove(g, 4, 4, cap);
  T("A9 capture essentielle = victoire immediate", g.phase === "over" && g.winner === 1, "winner=" + g.winner + " raison=" + g.winReason);
}
// A10 gel + interdiction de re-gel (cas pur gel->gel)
{
  const { g, pools } = startGame(); clearBoard(g);
  const mine = put(g, pools[1][0], 5, 1), mine2 = put(g, pools[1][1], 7, 7);
  const tgt = put(g, pools[2][0], 2, 2), other2 = put(g, pools[2][1], 0, 6);
  g.phase = "move"; g.current = 1;
  moveFirst(g, mine, 4, 1);
  g.hands[1] = ["gel"];
  const gr = M.playCard(g, 0, [{ r: 2, c: 2 }], {});
  T("A10a gel accepte, frozenForTurn = prochain tour du proprietaire", gr.ok && tgt.frozenForTurn === 1, "frozenForTurn=" + tgt.frozenForTurn + " turnCount2=" + g.turnCount[2]);
  M.endTurn(g); // -> tour J2 (turnCount2=1)
  T("A10b pion gele immobilise pendant son tour", M.pawnMoves(g, 2, 2).length === 0 && M.isImmobilised(g, tgt));
  moveFirst(g, other2, 1, 6); M.endTurn(g); // J2 bouge l'autre pion, -> tour J1 n2
  moveFirst(g, mine, 3, 1);
  g.hands[1] = ["gel"];
  const gr2 = M.playCard(g, 0, [{ r: 2, c: 2 }], {});
  T("A10c re-gel au tour suivant le gel : refuse", gr2.ok === false && /re-gel interdit/.test(gr2.error), gr2.error);
}
// A11 cartes : 30 definitions completes
{
  const ids = M.CARD_IDS; const req = ["nom", "famille", "teinte", "cible", "description", "conditions", "cout", "risque", "duree"];
  let missing = [];
  ids.forEach(id => { const d = M.CARDS[id];
    req.forEach(f => { if (typeof d[f] !== "string" || !d[f].length) missing.push(id + "." + f); });
    if (!M.CARD_FX[id]) missing.push(id + ".CARD_FX");
    if (!M.FAMILY_GLYPHS[d.famille]) missing.push(id + ".familleInconnue"); });
  T("A11 30 cartes, tous champs requis + FX + famille valide", ids.length === 30 && missing.length === 0, missing.join(",") || "30 ids");
}
// A12 decks
{
  let sums = {}, allKnown = true;
  [1, 2].forEach(pl => { sums[pl] = 0; Object.keys(M.DECK_RECIPES[pl]).forEach(id => { sums[pl] += M.DECK_RECIPES[pl][id]; if (!M.CARDS[id]) allKnown = false; }); });
  T("A12 recettes de decks : ids connus, tailles egales", allKnown && sums[1] === sums[2], "J1=" + sums[1] + " J2=" + sums[2]);
  const d1 = M.buildDeckFor(1, M.makeRng(7));
  T("A12b buildDeckFor rend 37 cartes melangees", d1.length === sums[1]);
}
// A13 sprites / glyphes
{
  // 2026-10-23 : les formes sont devenues des personnages (art.js, PIECE_SPRITES) ;
  // on vérifie leurs silhouettes (tout pixel non vide -> "#") avec le même critère.
  const ART = require(__dirname + "/../art.js");
  let okS = true; const maps = M.SHAPES.map(sh => ART.PIECE_SPRITES[sh].map(row => row.replace(/[^.]/g, "#")));
  maps.forEach(mp => { if (mp.length !== 16 || mp.some(row => row.length !== 16 || /[^.#]/.test(row))) okS = false; });
  const distinct = new Set(maps.map(m => m.join("|"))).size;
  let okG = true; Object.values(M.FAMILY_GLYPHS).forEach(mp => { if (mp.length !== 12 || mp.some(row => row.length !== 12)) okG = false; });
  T("A13 sprites 16x16 valides et distincts, glyphes 12x12", okS && distinct === 6 && okG, "distincts=" + distinct);
}
// A14 robustesse entrees invalides (sans crash)
{
  const { g } = startGame();
  let ok = true, detail = "";
  try {
    if (M.pawnMoves(g, 99, 99).length !== 0) { ok = false; detail = "pawnMoves OOB"; }
    if (M.applyMove(g, 0, 1, {}).ok !== false) { ok = false; detail = "applyMove {}"; }
    g.phase = "card"; g.hands[1] = ["gel"];
    if (M.playCard(g, 0, [{ r: 99, c: 99 }], {}).ok !== false) { ok = false; detail = "gel OOB accepte"; }
    if (M.playCard(g, 99, [], {}).ok !== false) { ok = false; detail = "handIndex OOB"; }
  } catch (e) { ok = false; detail = "exception: " + e.message; }
  T("A14 cibles/cases hors plateau refusees sans exception", ok, detail);
}

console.log("=== B. REPRODUCTIONS DE BUGS (CONNU = bug prouve, en attente de decision ; l'attendu est le comportement correct) ===");
// B1 gel sur l'unique pion adverse = defaite immediate au startTurn
{
  const { g, pools } = startGame(); clearBoard(g);
  const mine = put(g, pools[1][0], 5, 1), sole = put(g, pools[2][0], 2, 2);
  put(g, pools[1][1], 7, 7);
  g.phase = "move"; g.current = 1;
  moveFirst(g, mine, 4, 1); g.hands[1] = ["gel"]; M.playCard(g, 0, [{ r: 2, c: 2 }], {});
  M.endTurn(g);
  T("B1 gel d'un pion unique ne doit PAS terminer la partie (immobilise 1 tour seulement)",
    g.phase !== "over", "phase=" + g.phase + " winner=" + g.winner + " raison=" + g.winReason);
}
// B2 ambiguite capture vs glissement (Marque de passage) : destination identique, 2 coups
{
  const { g, pools } = fresh(); clearBoard(g);
  const a = put(g, pools[1][0], 4, 4), v = put(g, pools[2][0], 4, 5);
  put(g, pools[1][1], 7, 7); put(g, pools[2][1], 0, 0);
  M.addFx(a, "passage", 2, "ownerEnd"); g.phase = "move"; g.current = 1;
  const dests = M.pawnMoves(g, 4, 4).filter(m => m.toR === 4 && m.toC === 6);
  console.log("      [B2] coups vers (4,6) : " + JSON.stringify(dests));
  const res = M.applyMove(g, 4, 4, { toR: 4, toC: 6 });
  T("B2 en choisissant la destination de capture, la victime doit etre capturee (ou le choix doit etre explicite)",
    res.ok && g.board[4][5] === null && g.graveyard[2].includes(v),
    "victime encore en (4,5) ? " + !!g.board[4][5] + " ; coups candidats=" + dests.length);
}
// B3 silence sur pion adverse dure 2 tours adverses au lieu d'1
{
  const { g, pools } = startGame(); clearBoard(g);
  const mine = put(g, pools[1][0], 5, 1), mine2 = put(g, pools[1][1], 7, 0);
  const xp = put(g, pools[2][0], 2, 2), o2 = put(g, pools[2][1], 0, 6);
  M.addProp(xp, "aegis");
  g.phase = "move"; g.current = 1;
  moveFirst(g, mine, 4, 1); g.hands[1] = ["silence"];
  const sr = M.playCard(g, 0, [{ r: 2, c: 2 }], {});
  M.endTurn(g);                    // tour J2 n1 (silence doit couvrir ce tour)
  moveFirst(g, o2, 1, 6); M.endTurn(g); // fin du tour J2 n1 -> le silence devrait expirer ici ; tour J1 n2
  const stillSilenced = !!M.fxOf(xp, "silence") && xp.props.every(p => p.silenced);
  T("B3 silence adverse expire a la fin du PROCHAIN tour de son proprietaire (1 tour)",
    sr.ok && !stillSilenced, "silence encore actif apres le 1er tour adverse ? " + stillSilenced + " fx=" + JSON.stringify(M.fxOf(xp, "silence")));
}
// B4 dissipation ne defait pas un gel EN COURS
{
  const { g, pools } = startGame(); clearBoard(g);
  const mine = put(g, pools[1][0], 5, 1), helper = put(g, pools[1][1], 7, 7);
  put(g, pools[2][0], 0, 0); put(g, pools[2][1], 0, 7);
  g.phase = "move"; g.current = 1;
  mine.frozenForTurn = g.turnCount[1]; mine.frozenLastTurn = g.turnCount[1]; // gele POUR CE tour-ci
  moveFirst(g, helper, 6, 7); // un autre pion effectue le deplacement principal
  g.hands[1] = ["dissipation"];
  const dr = M.playCard(g, 0, [{ r: 5, c: 1 }], {});
  T("B4 dissipation doit retirer un gel en cours (carte : 'Retire un effet negatif (gel...)')",
    dr.ok && !M.isImmobilised(g, mine), "res=" + JSON.stringify(dr) + " frozenForTurn=" + mine.frozenForTurn + " turnCount1=" + g.turnCount[1]);
}
// B5 J2 piocherait des son 1er tour (main passee 3->4) alors que J1 non
T("B5 main de J2 a son TOUT premier tour = 3 (comme J1 au depart)", handJ2FirstTurn === 3, "main J2 au debut de son 1er tour = " + handJ2FirstTurn);
// B6 moteur : dernier pari mode deplacement fonctionne COTE MOTEUR (contraste avec l'UI, cf rapport)
{
  const { g, pools } = startGame(); clearBoard(g);
  const mine = put(g, pools[1][0], 4, 4); put(g, pools[2][0], 0, 0); put(g, pools[2][1], 0, 7);
  g.phase = "move"; g.current = 1;
  moveFirst(g, pools[1][0], 4, 3); // recule pour liberer la trajectoire de test... (4,3)-> pari vers (4,5)? on refait proprement ci-dessous
  // etat: pion en (4,3). Pari move2 vers (4,5), chemin (4,4) libre.
  g.hands[1] = ["dernier_pari"];
  const pr = M.playCard(g, 0, [{ r: 4, c: 3 }, { r: 4, c: 5 }], { pariMode: "move2" });
  T("B6 [moteur] dernier pari move2 accepte avec 2 cibles (l'echec est cote UI)", pr.ok === true, pr.error || "");
}
// B7 lien (Manhattan <=3) contourne par une carte de deplacement (pas de cote)
{
  const { g, pools } = startGame(); clearBoard(g);
  const a = put(g, pools[2][0], 4, 4), b = put(g, pools[2][1], 4, 7); // distance Manhattan = 3 (max legal)
  const mine = put(g, pools[1][0], 7, 0), mine2 = put(g, pools[1][1], 7, 7);
  M.addFx(a, "link", 2, "ownerEnd", { partnerId: b.id }); M.addFx(b, "link", 2, "ownerEnd", { partnerId: a.id });
  // tour de J2 proprietaire des lies : il doit d'abord faire un deplacement principal avec un pion libre... aucun libre hors lies :
  // on force la phase carte comme apres un deplacement principal quelconque :
  g.current = 2; g.phase = "card"; g.movedThisTurn = true;
  g.hands[2] = ["pas_de_cote"];
  const pr = M.playCard(g, 0, [{ r: 4, c: 4 }, { r: 3, c: 3 }], {});
  const distAfter = Math.abs(3 - 4) + Math.abs(3 - 7);
  T("B7 pas de cote d'un pion lie doit etre refuse si Manhattan devient > 3",
    pr.ok === false, "res.ok=" + pr.ok + " distance apres coup=" + (pr.ok ? distAfter : "n/a"));
}
// B8 repoussement : pousseur choisi arbitrairement, echec alors qu'un autre pousseur a la voie libre
{
  const { g, pools } = startGame(); clearBoard(g);
  const enemy = put(g, pools[2][0], 4, 4);
  const north = put(g, pools[1][0], 3, 4), southBlock = put(g, pools[1][1], 5, 4), west = put(g, pools[1][2], 4, 3);
  const mover = put(g, pools[1][3], 7, 7); put(g, pools[2][1], 0, 0);
  g.phase = "move"; g.current = 1;
  moveFirst(g, mover, 6, 7);
  g.hands[1] = ["repoussement"];
  const rr = M.playCard(g, 0, [{ r: 4, c: 4 }], {});
  T("B8 repoussement doit reussir via le pousseur ouest (case est libre) quand le pousseur nord est bloque",
    rr.ok === true, "res=" + JSON.stringify(rr));
}
// B9 resurrection puis reversion : restauration de proprietes au-dela du plafond de resurrection
{
  const { g, pools } = startGame(); clearBoard(g);
  const mover = put(g, pools[1][0], 7, 0); put(g, pools[2][0], 0, 0); put(g, pools[2][1], 0, 7);
  const dead = pools[1][1];
  dead.props = [{ id: "ailes", silenced: false }];
  dead.history = [[{ id: "aegis", silenced: false }, { id: "ailes", silenced: false }, { id: "entrave", silenced: false }]]; // snapshot d'une purification passee
  dead.fx = []; dead.essential = false;
  g.graveyard[1] = [dead];
  g.phase = "move"; g.current = 1;
  moveFirst(g, mover, 6, 0);
  g.hands[1] = ["resurrection"];
  const rs = M.playCard(g, 0, [{ r: 5, c: 1 }], { graveyardIndex: 0 });
  const posAfterRes = dead.props.filter(p => M.PROPERTY_CATALOG[p.id].positive).length;
  M.endTurn(g); // J2
  const o = M.findPawn(g, pools[2][0].id); moveFirst(g, pools[2][0], 1, 0); M.endTurn(g); // retour J1
  const mv2 = (() => { for (let r=0;r<8;r++) for (let c=0;c<8;c++) { const p=g.board[r][c]; if (p && p.player===1 && p!==dead) { const ms=M.pawnMoves(g,r,c); if (ms.length) return {r,c,m:ms[0]}; } } })();
  M.applyMove(g, mv2.r, mv2.c, mv2.m);
  g.hands[1] = ["reversion"];
  const fDead = M.findPawn(g, dead.id);
  const rv = M.playCard(g, 0, [{ r: fDead.r, c: fDead.c }], {});
  const posAfterRev = dead.props.filter(p => M.PROPERTY_CATALOG[p.id].positive).length;
  T("B9 apres resurrection (max 1 propriete positive), reversion ne doit pas restaurer 2 positives + 1 negative d'avant la mort",
    rs.ok && posAfterRes <= 1 && !(rv.ok && posAfterRev > 1),
    "res.ok=" + rs.ok + " positives apres resurrection=" + posAfterRes + " reversion.ok=" + rv.ok + " positives apres reversion=" + posAfterRev + " props=" + JSON.stringify(dead.props.map(p => p.id)));
}
// B10 applyMove avec move=null leve une exception au lieu d'un refus propre
{
  const { g, pools } = startGame();
  const f0 = M.findPawn(g, pools[1].find(p => M.pawnMoves(g, M.findPawn(g, p.id).r, M.findPawn(g, p.id).c).length > 0).id);
  let threw = null;
  try { const r = M.applyMove(g, f0.r, f0.c, null); threw = r && r.ok === false ? null : "retour inattendu"; }
  catch (e) { threw = e.constructor.name + ": " + e.message; }
  T("B10 applyMove(g,r,c,null) doit retourner {ok:false}, pas lever", threw === null, "exception=" + threw);
}
// B11 bouclier : la protection bloque la capture puis se consume (correction A appliquée)
{
  const { g, pools } = fresh(); clearBoard(g);
  const a = put(g, pools[1][0], 4, 4), v = put(g, pools[2][0], 4, 5);
  M.addFx(v, "shield", 99, "untilCapture"); g.phase = "move"; g.current = 1;
  const attempt = M.applyMove(g, 4, 4, { toR: 4, toC: 6 });
  console.log("      [B11] tentative de capture sur pion bouclier : " + JSON.stringify(attempt) + " ; bouclier toujours present : " + !!M.fxOf(v, "shield") + " (remaining=" + (M.fxOf(v, "shield") || {}).remaining + ")");
  T("B11 capture sur pion protege : coup joue, capture annulee, bouclier consomme",
    attempt.ok === true && g.board[4][5] === v && !M.fxOf(v, "shield"));
}
// B12 duree du piege : asymetrie selon le joueur qui le pose
{
  function trapRoundsLeft(owner) {
    const { g, pools } = startGame(); clearBoard(g);
    const m1 = put(g, pools[1][0], 7, 0), m2 = put(g, pools[2][0], 0, 7);
    put(g, pools[1][1], 7, 7); put(g, pools[2][1], 0, 0);
    g.current = owner; g.phase = "move"; g.turnCount[owner] = Math.max(g.turnCount[owner], 1);
    const mover = owner === 1 ? m1 : m2;
    const f = M.findPawn(g, mover.id); const ms = M.pawnMoves(g, f.r, f.c);
    M.applyMove(g, f.r, f.c, ms[0]);
    g.hands[owner] = ["piege_runique"];
    M.playCard(g, 0, [{ r: 3, c: 3 }], {});
    M.endTurn(g);
    return g.traps.length ? g.traps[0].roundsLeft : null;
  }
  const leftJ1 = trapRoundsLeft(1), leftJ2 = trapRoundsLeft(2);
  console.log("      [B12] roundsLeft juste apres la fin du tour de pose : piege de J1=" + leftJ1 + " , piege de J2=" + leftJ2);
  T("B12 duree du piege identique quel que soit le joueur qui le pose ('3 tours complets')", leftJ1 === leftJ2, "J1=" + leftJ1 + " J2=" + leftJ2);
}
// B13 gel enchaine apres une immobilisation d'Eveil (frozenLastTurn jamais pose par tickFx)
{
  const { g, pools } = startGame(); clearBoard(g);
  const mine = put(g, pools[1][0], 5, 1), victim = put(g, pools[2][0], 2, 2);
  put(g, pools[1][1], 7, 7); put(g, pools[2][1], 0, 6);
  // le pion adverse vient de purger une immobilisation (ex. retombée d'Eveil) pendant SON tour actuel :
  victim.frozenForTurn = g.turnCount[2]; victim.frozenLastTurn = -1; // tickFx pose frozenForTurn SANS frozenLastTurn
  g.phase = "move"; g.current = 1;
  moveFirst(g, mine, 4, 1); g.hands[1] = ["gel"];
  const gr = M.playCard(g, 0, [{ r: 2, c: 2 }], {});
  T("B13 un pion immobilise au tour precedent ne doit pas etre re-immobilise en chaine (esprit anti re-gel)",
    gr.ok === false, "gel accepte ? " + gr.ok + " frozenForTurn=" + victim.frozenForTurn);
}
// B14 pioche : la main ne depasse jamais 4 sur un cycle complet (controle positif)
{
  const { g, pools } = startGame();
  let maxSeen = 0, okCycle = true;
  for (let i = 0; i < 6; i++) {
    const cur = g.current;
    let moved = false;
    for (let r = 0; r < 8 && !moved; r++) for (let c = 0; c < 8 && !moved; c++) {
      const p = g.board[r][c]; if (p && p.player === cur) { const ms = M.pawnMoves(g, r, c); if (ms.length) { M.applyMove(g, r, c, ms[0]); moved = true; } }
    }
    if (!moved) { okCycle = false; break; }
    M.endTurn(g);
    maxSeen = Math.max(maxSeen, g.hands[1].length, g.hands[2].length);
    if (g.phase === "over") break;
  }
  T("B14 [controle] sur 6 demi-tours, main <= 4 toujours", okCycle && maxSeen <= 4, "max main vue=" + maxSeen);
}
console.log("=== RESULTAT : " + pass + " PASS, " + fail + " FAIL, " + known + " CONNUS (backlog) ===");
process.exitCode = fail ? 1 : 0;
