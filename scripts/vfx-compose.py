"""
TICKET 198c — compose a side-by-side sheet: the lab column (cropped out of the 194k sheet, which is
the only capture of the lab there is) beside the game's frames from `vfx-sheet.mjs`, one row per
moment.

    python3 scripts/vfx-compose.py <title> <194k sheet> <frames dir> <name> <out.jpg> [frames dir 2] [name 2]

Row i of the 194k sheet holds the lab at the moment MOMENTS[i]; the game frames are `<name>-<ms>.png`.
"""
import sys
from PIL import Image, ImageDraw

MOMENTS = [250, 550, 850, 1150, 1500, 1900]
LAB_ROWS = [70, 348, 626, 904, 1182, 1458]   # where each lab frame starts on the 194k sheet
LAB_H = 238
LAB_X = (6, 566)
COL_W = 560
ROW_H = 330
GAP = 6

title, lab_sheet, frames_dir, name, out = sys.argv[1:6]
extra = sys.argv[6:8] if len(sys.argv) >= 8 else None

lab = Image.open(lab_sheet)
cols = 2 + (1 if extra else 0)
sheet = Image.new('RGB', (GAP + cols * (COL_W + GAP), 60 + len(MOMENTS) * ROW_H), (12, 14, 20))
draw = ImageDraw.Draw(sheet)
draw.text((8, 8), title, fill=(255, 255, 255))
draw.text((8, 30), 'Battle Juice Lab (from the 194k sheet)', fill=(255, 210, 120))
draw.text((GAP * 2 + COL_W, 30), f'Game, 198b: {name}', fill=(255, 210, 120))
if extra:
    draw.text((GAP * 3 + COL_W * 2, 30), f'Game, 198b: {extra[1]}', fill=(255, 210, 120))

for i, ms in enumerate(MOMENTS):
    y = 60 + i * ROW_H
    draw.text((8, y - 2), f'+{ms} ms', fill=(200, 205, 215))
    crop = lab.crop((LAB_X[0], LAB_ROWS[i], LAB_X[1], LAB_ROWS[i] + LAB_H))
    sheet.paste(crop, (GAP, y + 12))
    game = Image.open(f'{frames_dir}/{name}-{ms}.png')
    game = game.resize((COL_W, round(game.height * COL_W / game.width)), Image.LANCZOS)
    sheet.paste(game, (GAP * 2 + COL_W, y + 12))
    if extra:
        game2 = Image.open(f'{extra[0]}/{extra[1]}-{ms}.png')
        game2 = game2.resize((COL_W, round(game2.height * COL_W / game2.width)), Image.LANCZOS)
        sheet.paste(game2, (GAP * 3 + COL_W * 2, y + 12))

sheet.save(out, quality=88)
print(out, sheet.size)
