"""Generate every AccoHost icon.

Small sizes use a simplified two-building mark drawn on a 16-unit grid, so
every edge lands on a whole pixel and stays razor sharp. Large sizes use the
same mark at higher resolution. logo.png and the share card use Ram's full
clean logo.  Black background, white buildings, as chosen.
"""
from PIL import Image, ImageDraw
import os

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
SRC_LOGO = '/root/.claude/uploads/165d41ac-c118-5536-ae65-05cf797ac819/80a2d194-image.png'
OUT = 'icons_out'
os.makedirs(OUT, exist_ok=True)

# geometry on a 16-unit grid, inclusive coordinates
TALL  = (2, 3, 7, 14)
SHORT = (9, 6, 13, 14)
WINDOWS = [(3,5),(5,5),(3,8),(5,8),(10,8),(12,8),(10,11),(12,11)]
DOOR = (4, 11, 5, 14)

def draw_mark(size, scale=1.0, bg=BLACK, fg=WHITE):
    """scale<1 shrinks the mark inside the canvas (used for maskable icons)."""
    img = Image.new('RGB', (size, size), bg)
    d = ImageDraw.Draw(img)
    unit = size * scale / 16.0
    off = (size - size * scale) / 2.0
    def px(v):            # grid unit -> pixel, rounded so edges stay sharp
        return int(round(off + v * unit))
    def box(r, colour):
        x0, y0, x1, y1 = r
        d.rectangle([px(x0), px(y0), px(x1 + 1) - 1, px(y1 + 1) - 1], fill=colour)
    box(TALL, fg); box(SHORT, fg)
    for (x, y) in WINDOWS:
        box((x, y, x, y), bg)
    box(DOOR, bg)
    return img

def svg_mark():
    u = 1000 / 16.0
    def rect(r, colour):
        x0, y0, x1, y1 = r
        return (f'<rect x="{x0*u:.1f}" y="{y0*u:.1f}" '
                f'width="{(x1-x0+1)*u:.1f}" height="{(y1-y0+1)*u:.1f}" fill="{colour}"/>')
    parts = ['<rect width="1000" height="1000" fill="#000000"/>',
             rect(TALL, '#FFFFFF'), rect(SHORT, '#FFFFFF')]
    parts += [rect((x, y, x, y), '#000000') for (x, y) in WINDOWS]
    parts.append(rect(DOOR, '#000000'))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">'
            + ''.join(parts) + '</svg>')

made = []

# --- small + app icons, all from the simplified mark ---
for name, size in [('favicon-16x16.png', 16), ('favicon-32x32.png', 32),
                   ('apple-touch-icon.png', 180),
                   ('android-chrome-192x192.png', 192),
                   ('android-chrome-512x512.png', 512)]:
    draw_mark(size).save(f'{OUT}/{name}'); made.append((name, f'{size}x{size}', 'mark'))

# --- maskable: Android crops to a circle, so the mark sits in the safe 60% ---
for name, size in [('maskable-icon-192x192.png', 192), ('maskable-icon-512x512.png', 512)]:
    draw_mark(size, scale=0.60).save(f'{OUT}/{name}')
    made.append((name, f'{size}x{size}', 'mark, 20% safe margin'))

# --- multi-size .ico so Windows and search engines pick the best one ---
draw_mark(64).save(f'{OUT}/favicon.ico', format='ICO',
                   sizes=[(16,16),(32,32),(48,48),(64,64)])
made.append(('favicon.ico', '16/32/48/64', 'mark, multi-size'))

# --- vector favicon ---
open(f'{OUT}/favicon.svg', 'w').write(svg_mark())
made.append(('favicon.svg', 'vector', 'mark'))

# --- full clean logo for the header ---
logo = Image.open(SRC_LOGO).convert('RGB')
logo.resize((512, 512), Image.LANCZOS).save(f'{OUT}/logo.png', optimize=True)
made.append(('logo.png', '512x512', 'your clean logo'))

# --- share card 1200x630, logo centred on black ---
card = Image.new('RGB', (1200, 630), BLACK)
side = 560
card.paste(logo.resize((side, side), Image.LANCZOS), ((1200-side)//2, (630-side)//2))
card.save(f'{OUT}/og-image.png', optimize=True)
made.append(('og-image.png', '1200x630', 'your clean logo on black'))

print(f"  {len(made)} files written to {OUT}/\n")
for n, s, src in made:
    print(f"    {n:<30} {s:<14} {src}")
