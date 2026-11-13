# Turns recorded frames (from tools/record-demo.mjs) into a looping GIF.
#
#   python3 tools/make-gif.py <framesDir> <out.gif> [width] [colors] [palette]
#
# Needs Pillow (pip install pillow). No dithering, so it stays small (X's GIF
# limit is 15 MB). palette:
#   'segment' (default)  one palette per ~1 s of frames: accurate colors through
#                        theme changes, while frames in a segment still compress well
#   'global'             one palette for the whole clip (smallest, colors drift)
#   'frame'              a palette per frame (most accurate, much bigger)

import json
import os
import re
import sys
from PIL import Image

frames_dir, out = sys.argv[1], sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 960
colors = int(sys.argv[4]) if len(sys.argv) > 4 else 160
mode = sys.argv[5] if len(sys.argv) > 5 else 'segment'

meta = json.load(open(os.path.join(frames_dir, 'meta.json')))
files = sorted(f for f in os.listdir(frames_dir) if f.endswith(('.png', '.jpg')))


def load(name):
    im = Image.open(os.path.join(frames_dir, name)).convert('RGB')
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


imgs = [load(f) for f in files]

def theme_colors():
    # The exact colors the donut, arrows and chips are drawn in: every theme's
    # xterm palette from src/donut-core.js. Reserving them keeps small bright
    # details (like lit arrows) from being snapped to a wrong hue.
    src = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'donut-core.js')).read()
    out = set()
    for arr in re.findall(r"colors: \[([\d, ]+)\]", src):
        for n in map(int, arr.split(',')):
            if n >= 232:
                v = 8 + (n - 232) * 10
                out.add((v, v, v))
            elif n >= 16:
                level = lambda c: 0 if c == 0 else 55 + c * 40
                i = n - 16
                out.add((level(i // 36), level(i // 6 % 6), level(i % 6)))
    return sorted(out)


RESERVED = theme_colors()


def shared_palette(group):
    # One palette for `group`: the reserved theme colors, plus the most common
    # colors (median cut) of a handful of frames spread across the group.
    sample = group[:: max(1, len(group) // 6)]
    sheet = Image.new('RGB', (width, sample[0].height * len(sample)))
    for i, im in enumerate(sample):
        sheet.paste(im, (0, i * im.height))
    common = sheet.quantize(colors=max(16, colors - len(RESERVED)), method=Image.Quantize.MEDIANCUT)
    rgb = common.getpalette()[: 3 * max(16, colors - len(RESERVED))]
    rgb += [c for color in RESERVED for c in color]
    palette = Image.new('P', (1, 1))
    palette.putpalette(rgb + [0] * (768 - len(rgb)))
    return [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in group]


if mode == 'global':
    quantized = shared_palette(imgs)
elif mode == 'segment':
    seg = int(meta['fps'])
    quantized = [q for i in range(0, len(imgs), seg) for q in shared_palette(imgs[i:i + seg])]
else:
    quantized = [im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for im in imgs]
# GIF timing is in 10 ms steps, so 15 fps (66.7 ms) can't be exact. Round each
# frame's end time instead (70, 60, 70, …) so the average stays spot on.
step = 1000 / meta['fps']
durations = [round((i + 1) * step, -1) - round(i * step, -1) for i in range(len(quantized))]
quantized[0].save(out, save_all=True, append_images=quantized[1:], duration=durations, loop=0, optimize=True, disposal=1)
print(f"{out}: {os.path.getsize(out) / 1e6:.1f} MB, {quantized[0].width}x{quantized[0].height}, {len(quantized)} frames")
