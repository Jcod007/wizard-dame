#!/usr/bin/env python3
"""Génère les planches des personnages de Wizard Dame (assets/characters/).

Sources (non versionnées, à décompresser à part) :
  - Mana Seed Character Base Demo 2.0 (Seliel the Shaper) — usage commercial
    et non commercial autorisé par l'auteur (« this is only a demo.txt ») ;
  - Basic Asset Pack (monstres 16x16) — droits confirmés par Ekoue.

Usage :
  python3 tools/build-characters.py <dossier Mana Seed> <dossier Basic Asset Pack>

Pour chaque personnage et chaque camp, une planche de cases 64x64 :
  rangée 0 : attente (4 images)      rangée 1 : déplacement (4 images)
  rangée 2 : blessure, chute 1, chute 2
Le camp 1 (violet, en bas du plateau) est vu de DOS, le camp 2 (orange) de FACE :
chaque armée regarde l'autre. Pieds de chaque case en (32, 44).
Les humains sont au pixel près ; les monstres 16x16 sont agrandis x2 (choix d'Ekoue).
Les portraits (interface) montrent toujours le personnage de face.
"""
import colorsys, json, os, sys
from PIL import Image

FRAME, FEET = 64, (32, 44)
TEAM_HUE = {1: 268 / 360, 2: 24 / 360}
BOOST = {1: (1.05, 1.0), 2: (1.35, 1.15)}  # l'orange a besoin d'un peu plus d'éclat

HUMANS = {
    "mage":      dict(skin="v01", out="fstr_v01", hair="bob1_v02", hat="pnty_v01", w="mc01_v01", sh=None),
    "chevalier": dict(skin="v03", out="fstr_v02", hair="dap1_v03", hat=None, w="sw01_v01", sh="sh01_v01"),
    "eclaireur": dict(skin="v02", out="fstr_v04", hair="bob1_v10", hat="pfht_v01", w="sw01_v02", sh=None),
}
MONSTERS = {
    "golem":  "Stone Troll/StoneTroll.png",
    "hibou":  "Ocular Watcher/OcularWatcher.png",
    "esprit": "Ochre Jelly/OchreJelly.png",
}


def recolor(im, team):
    """Teinte du camp sur les pixels saturés (tissus), valeur conservée."""
    im = im.copy(); p = im.load()
    s_mul, v_mul = BOOST[team]
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = p[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.28:
                nr, ng, nb = colorsys.hsv_to_rgb(TEAM_HUE[team], min(1, s * s_mul), min(1, v * v_mul))
                p[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return im


def human_page(ms, page, cls, team):
    c = HUMANS[cls]; pre = f"char_a_{page}_"; d = os.path.join(ms, f"char_a_{page}")
    def layer(rel): return Image.open(os.path.join(d, rel)).convert("RGBA")
    im = Image.new("RGBA", (512, 512))
    im.alpha_composite(layer(pre + "0bas_humn_" + c["skin"] + ".png"))
    im.alpha_composite(recolor(layer("1out/" + pre + "1out_" + c["out"] + ".png"), team))
    im.alpha_composite(layer("4har/" + pre + "4har_" + c["hair"] + ".png"))
    if c["hat"]:
        hat = layer("5hat/" + pre + "5hat_" + c["hat"] + ".png")
        im.alpha_composite(recolor(hat, team) if c["hat"].startswith("pnty") else hat)
    im.alpha_composite(layer("6tla/" + pre + "6tla_" + c["w"] + ".png"))
    if c["sh"]: im.alpha_composite(layer("7tlb/" + pre + "7tlb_" + c["sh"] + ".png"))
    return im


def cell(sheet, row, col):
    return sheet.crop((col * FRAME, row * FRAME, (col + 1) * FRAME, (row + 1) * FRAME))


def human_sheet(ms, cls, team, facing_row):
    p2 = human_page(ms, "pONE2", cls, team)   # attente / déplacement
    p1 = human_page(ms, "pONE1", cls, team)   # blessure / chute
    out = Image.new("RGBA", (4 * FRAME, 3 * FRAME))
    for i in range(4):
        out.alpha_composite(cell(p2, facing_row, i), (i * FRAME, 0))
        out.alpha_composite(cell(p2, facing_row, 4 + i), (i * FRAME, FRAME))
    for i, col in enumerate((5, 6, 7)):
        out.alpha_composite(cell(p1, facing_row, col), (i * FRAME, 2 * FRAME))
    return out


def monster_frames(bp, cls, team):
    src = Image.open(os.path.join(bp, "Basic Monster Animations", MONSTERS[cls])).convert("RGBA")
    frames = []
    for i in range(src.width // 16):
        f = recolor(src.crop((i * 16, 0, i * 16 + 16, 16)), team).resize((32, 32), Image.NEAREST)
        box = Image.new("RGBA", (FRAME, FRAME)); bb = f.getbbox()
        box.alpha_composite(f, (FEET[0] - 16, FEET[1] - bb[3] + 1))
        frames.append(box)
    return frames


def monster_sheet(bp, cls, team):
    fr = monster_frames(bp, cls, team)
    out = Image.new("RGBA", (4 * FRAME, 3 * FRAME))
    for i in range(4):
        out.alpha_composite(fr[i % len(fr)], (i * FRAME, 0))
        out.alpha_composite(fr[(i + 1) % len(fr)], (i * FRAME, FRAME))
    # blessure = silhouette claire ; chute = la créature s'affaisse (moitié basse)
    hurt = fr[0].copy(); hp = hurt.load()
    for y in range(FRAME):
        for x in range(FRAME):
            r, g, b, a = hp[x, y]
            if a: hp[x, y] = (min(255, r + 90), min(255, g + 90), min(255, b + 90), a)
    out.alpha_composite(hurt, (0, 2 * FRAME))
    for k, cut in ((1, 0.5), (2, 0.25)):
        f = fr[0]; bb = f.getbbox(); h = bb[3] - bb[1]
        squashed = f.crop(bb).resize((bb[2] - bb[0], max(2, int(h * cut))), Image.NEAREST)
        box = Image.new("RGBA", (FRAME, FRAME)); box.alpha_composite(squashed, (bb[0], FEET[1] - squashed.height + 1))
        out.alpha_composite(box, (k * FRAME, 2 * FRAME))
    return out


PORTRAIT = 40  # toutes les vignettes ont la même taille : agrandissement entier identique dans l'interface


def portrait(frame_img):
    bb = frame_img.getbbox()
    body = frame_img.crop(bb)
    out = Image.new("RGBA", (PORTRAIT, PORTRAIT))
    out.alpha_composite(body, ((PORTRAIT - body.width) // 2, PORTRAIT - body.height - 1))
    return out


def main(ms, bp, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    manifest = {"frame": FRAME, "feet": list(FEET), "portrait": PORTRAIT, "rows": {"idle": 0, "move": 1, "hurt": 2},
                "idleFrames": 4, "moveFrames": 4, "hurtFrame": 0, "deadFrames": [1, 2], "characters": {}}
    for cls in list(HUMANS) + list(MONSTERS):
        entry = {"kind": "humain" if cls in HUMANS else "creature", "portraits": {}}
        for team in (1, 2):
            facing = 1 if team == 1 else 0   # rangées Mana Seed : 0 = face, 1 = dos
            if cls in HUMANS:
                sheet = human_sheet(ms, cls, team, facing)
                face = cell(human_page(ms, "pONE2", cls, team), 0, 0)
            else:
                sheet = monster_sheet(bp, cls, team)
                face = monster_frames(bp, cls, team)[0]
            sheet.save(os.path.join(out_dir, f"{cls}-{team}.png"))
            p = portrait(face); p.save(os.path.join(out_dir, f"portrait-{cls}-{team}.png"))
            entry["portraits"][str(team)] = [p.width, p.height]
        manifest["characters"][cls] = entry
    with open(os.path.join(out_dir, "characters.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("planches générées :", len(manifest["characters"]) * 2)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], sys.argv[2], os.path.join(here, "..", "assets", "characters"))
