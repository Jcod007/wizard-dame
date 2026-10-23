"use strict";
/* Placement libre et secret (décision d'Ekoue, 2026-10-23) :
   deploy1 -> select1 -> handover -> deploy2 -> select2 -> move. */
const M = require("../engine.js");
let pass = 0, fail = 0;
function t(name, cond, info) { if (cond) { pass++; console.log("PASS  " + name); } else { fail++; console.log("FAIL  " + name + (info ? "  [" + info + "]" : "")); } }
function pawnsOf(g, pl) { const out = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (g.board[r][c] && g.board[r][c].player === pl) out.push({ r, c, p: g.board[r][c] }); return out; }

const g = M.createGame(7, { deploy: true });
t("P1 plateau vide et réserves de 12 au départ", pawnsOf(g, 1).length === 0 && pawnsOf(g, 2).length === 0 && g.reserve[1].length === 12 && g.reserve[2].length === 12);
t("P2 phase initiale deploy1", g.phase === "deploy1");
t("P3 hors zone refusé (J1 rangée du haut)", !M.deployPawn(g, 1, 0, 0).ok);
t("P4 le J2 ne peut pas placer pendant deploy1", !M.deployPawn(g, 2, 0, 0).ok);
t("P5 pose sur une case CLAIRE autorisée (plus de damier)", M.deployPawn(g, 1, 7, 7).ok && g.board[7][7].player === 1);
t("P6 case occupée refusée", !M.deployPawn(g, 1, 7, 7).ok);
t("P7 reprise d'un pion posé", M.undeployPawn(g, 1, 7, 7).ok && !g.board[7][7] && g.reserve[1].length === 12);
const wanted = g.reserve[1][3].shape;
t("P8 choix du personnage dans la réserve", M.deployPawn(g, 1, 6, 0, 3).ok && g.board[6][0].shape === wanted);
t("P9 validation refusée tant qu'il reste des pions", !M.finishDeploy(g, 1).ok);
M.autoDeploy(g, 1);
const p1 = pawnsOf(g, 1);
t("P10 autoDeploy : 12 pions, tous dans les rangées 6-8", p1.length === 12 && p1.every(x => x.r >= 5) && g.reserve[1].length === 0);
t("P11 validation -> select1", M.finishDeploy(g, 1).ok && g.phase === "select1");
t("P12 pièce essentielle J1 -> handover", M.chooseEssential(g, 1, p1[0].p.id).ok && g.phase === "handover");
t("P13 passation -> deploy2, joueur 2", M.passDevice(g).ok && g.phase === "deploy2" && g.current === 2);
M.autoDeploy(g, 2);
const p2 = pawnsOf(g, 2);
t("P14 J2 : 12 pions dans les rangées 1-3", p2.length === 12 && p2.every(x => x.r <= 2));
t("P15 validation J2 -> select2", M.finishDeploy(g, 2).ok && g.phase === "select2");
t("P16 pièce essentielle J2 -> la partie commence, J1 joue", M.chooseEssential(g, 2, p2[0].p.id).ok && g.phase === "move" && g.current === 1);
t("P17 identifiants uniques (24 pions)", new Set(p1.concat(p2).map(x => x.p.id)).size === 24);
t("P18 6 personnages représentés par camp", new Set(p1.map(x => x.p.shape)).size === 6 && new Set(p2.map(x => x.p.shape)).size === 6);
const legacy = M.createGame(42);
t("P19 sans option : mise en place historique conservée (tests)", legacy.phase === "select1" && pawnsOf(legacy, 1).length === 12 && !legacy.deployMode);
t("P20 passation historique -> select2", (M.chooseEssential(legacy, 1, pawnsOf(legacy, 1)[0].p.id), M.passDevice(legacy).ok && legacy.phase === "select2"));
console.log("=== RESULTAT : " + pass + " PASS, " + fail + " FAIL ===");
process.exit(fail ? 1 : 0);
