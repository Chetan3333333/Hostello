"""Generate every AccoHost icon from Ram's original logo.

Decision (Ram, 30 Oct 2026): ONE logo everywhere. No separate simplified mark
for small sizes. Every icon, including the favicon, is the original logo.

The logo is a raster image, so each size is produced by high-quality
downsampling from the 1254px original rather than from an already-shrunk
copy, which would compound the softening.
"""
from PIL import Image
import base64, io, os

SRC = '/root/.claude/uploads/165d41ac-c118-5536-ae65-05cf797ac819/80a2d194-image.png'
OUT = 'icons_out'
BLACK = (0, 0, 0)
os.makedirs(OUT, exist_ok=True)

original = Image.open(SRC).convert('RGB')

def at(size):
    """Always downsample from the full-resolution original."""
    return original.resize((size, size), Image.LANCZOS)

made = []
def save(img, name, note):
    img.save(f'{OUT}/{name}', optimize=True)
    made.append((name, f'{img.size[0]}x{img.size[1]}', note))

# every icon slot = the original logo
save(at(16),  'favicon-16x16.png',           'original logo')
save(at(32),  'favicon-32x32.png',           'original logo')
save(at(180), 'apple-touch-icon.png',        'original logo')
save(at(192), 'android-chrome-192x192.png',  'original logo')
save(at(512), 'android-chrome-512x512.png',  'original logo')
# maskable: the badge already sits inside Android's safe circle (37.4% vs 40%)
save(at(192), 'maskable-icon-192x192.png',   'original logo, fits the safe circle')
save(at(512), 'maskable-icon-512x512.png',   'original logo, fits the safe circle')
save(at(512), 'logo.png',                    'original logo')

# multi-size .ico so each place picks the best one it has
at(64).save(f'{OUT}/favicon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64)])
made.append(('favicon.ico', '16/32/48/64', 'original logo, multi-size'))

# the logo is a photo, not a drawing, so the SVG wraps a PNG of it
buf = io.BytesIO(); at(192).save(buf, format='PNG', optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">'
       f'<image width="192" height="192" href="data:image/png;base64,{b64}"/></svg>')
open(f'{OUT}/favicon.svg','w').write(svg)
made.append(('favicon.svg', '192 embedded', 'original logo'))

# share card: logo centred on black
card = Image.new('RGB', (1200, 630), BLACK)
side = 560
card.paste(at(side), ((1200-side)//2, (630-side)//2))
save(card, 'og-image.png', 'original logo on black')

print(f"  {len(made)} files written\n")
for n,s,note in made:
    kb = os.path.getsize(f'{OUT}/{n}')
    print(f"    {n:<30} {s:<14} {kb:>7,} bytes   {note}")
