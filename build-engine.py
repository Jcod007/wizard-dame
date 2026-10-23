#!/usr/bin/env python3
"""Extraction mécanique de la logique pure de game.js vers engine.js.
Aucune réécriture de logique : blocs copiés ligne à ligne depuis game.js.
Blocs DOM exclus : pixelArtURL / pawnSpriteURL / cardSpriteURL (100-148),
cardSceneURL (1160-1221), Sound (1224-1284), interface navigateur (1304+).
Utilisé lors de la migration Phaser (2026-10-23) ; conservé pour traçabilité.
"""
src = open("game.js", encoding="utf-8").read().split("\n")

def block(a, b):  # 1-indexed inclusive
    return src[a - 1:b]

out = []
out.append('"use strict";')
out.append("/*")
out.append(" * Wizard Dame — engine.js : LOGIQUE PURE du jeu (migration Phaser, 2026-10-23).")
out.append(" * Extrait mécaniquement de game.js : constantes, catalogue CARDS, decks,")
out.append(" * machine à états, système de propriétés provisoire, CARD_FX, et les DONNÉES")
out.append(" * pixel art (SPRITE_MAPS, scènes procédurales) — comme données uniquement.")
out.append(" * ZÉRO référence DOM, ZÉRO référence Phaser : chargeable sous Node (tests)")
out.append(" * exactement comme game.js. Le rendu vit dans phaser-main.js (plateau) et")
out.append(" * ui-dom.js (cartes/menus en DOM, sons Web Audio).")
out.append(" *")
out += block(3, 17)  # commentaire propriétés provisoires d'origine
out.append("")
out += block(19, 99)     # SHAPES, SPRITE_MAPS, PLAYER_PALETTES, FAMILY_GLYPHS, FAMILY_COLORS
out.append("")
out += block(150, 1143)  # CARD_FX, propriétés, CARDS, decks, moteur pur, playCard (+8 lignes journal 2026-10-23)
out.append("")
out += block(1144, 1167) # En-tête art de scène + SCENE_PALETTES + RUNE_MINI + hash2 (données)
out += block(1230, 1230) # cardNumber (pur)
out.append("")
out.append("/* ================= Exports Node (tests) ================= */")
out.append("")
exp = block(1296, 1310)
exp = [l.replace(", Sound: Sound", "") for l in exp]
out += exp
out.append("")

open("engine.js", "w", encoding="utf-8").write("\n".join(out))
print("engine.js écrit :", len(out), "lignes")
