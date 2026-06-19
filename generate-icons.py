"""
App-Icons aus dem Originallogo des SV Lau-Brechte rendern.

Ablauf:
  1. logo-orig.png laden (heraldischer Adler mit Schrift darunter)
  2. nur den Adler-Teil oben croppen (Schrift entfaellt)
  3. auf einen hellgruenen Hintergrund mit gerundeten Ecken legen
  4. PNG-Varianten 32 / 180 / 192 / 512 schreiben
"""
from PIL import Image, ImageDraw, ImageOps
import os

# Vereinsfarben
BG_LIGHT = (223, 242, 218, 255)  # #DFF2DA helles Vereinsgruen
DARK     = (27, 67, 50)          # #1B4332 dunkles Vereinsgruen (Logo-Farbe)

MASTER = 1024  # Master-Aufloesung

def find_adler_bbox(img):
    """Findet den Adler-Bereich oben (heuristisch: ueber dem grossen Leerraum
    vor der Schrift 'seit 1645')."""
    gray = img.convert('L')
    # Pro Zeile pruefen, wie viel dunkler Inhalt drin ist
    pix = gray.load()
    w, h = img.size
    dark_per_row = []
    for y in range(h):
        cnt = 0
        for x in range(0, w, 4):  # samplen
            if pix[x, y] < 100:
                cnt += 1
        dark_per_row.append(cnt)
    # Adler beginnt oben, dann kommt eine grosse helle Zone, dann Text
    # Suche die erste lange Zone von Leerzeilen NACH dem Adler
    # Adler-Bereich endet, wenn fuer >40 Zeilen kaum dunkle Pixel da sind
    started = False
    last_dark = 0
    for y in range(h):
        if dark_per_row[y] > 5:
            started = True
            last_dark = y
        elif started and y - last_dark > 40:
            # Adler-Ende gefunden
            adler_bottom = last_dark + 10
            return (0, 0, w, adler_bottom)
    return (0, 0, w, h)

def make_icon(size, src_logo):
    """Erstellt ein Icon der gegebenen Groesse mit hellgruenem Hintergrund."""
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(icon, 'RGBA')

    # Hintergrund: gerundetes Quadrat
    radius = int(size * 0.18)
    d.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=BG_LIGHT)

    # Adler mit Padding einsetzen
    # Logo nimmt etwa 75% der Icon-Hoehe ein
    target = int(size * 0.78)
    logo = src_logo.copy()
    # Proportional skalieren, sodass die laengere Seite = target
    logo.thumbnail((target, target), Image.LANCZOS)
    lw, lh = logo.size

    # Zentriert platzieren
    px = (size - lw) // 2
    py = (size - lh) // 2

    # Falls Logo nicht RGBA, weisse Pixel transparent machen
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')
    # Pixel mit ~weisser Farbe -> Alpha=0 setzen
    data = logo.load()
    for y in range(lh):
        for x in range(lw):
            r, g, b, a = data[x, y]
            # Weisser/sehr heller Hintergrund -> transparent
            if r > 235 and g > 235 and b > 235:
                data[x, y] = (0, 0, 0, 0)

    icon.paste(logo, (px, py), logo)
    return icon

# --- Hauptablauf -----------------------------------------------------------
print('Lade logo-orig.png ...')
src = Image.open('logo-orig.png').convert('RGB')
print(f'  Original: {src.size}, Mode: {src.mode}')

print('Suche Adler-Bereich ...')
bbox = find_adler_bbox(src)
print(f'  Adler-Crop: {bbox}')
adler = src.crop(bbox)
# Mit etwas Rand padden
pad = int(min(adler.size) * 0.03)
adler_padded = ImageOps.expand(adler, border=pad, fill=(255, 255, 255))
print(f'  Adler nach Crop: {adler_padded.size}')

print('Master rendern ...')
master = make_icon(MASTER, adler_padded)

OUTPUTS = {
    'icon.png':       180,
    'icon-192.png':   192,
    'icon-512.png':   512,
    'favicon-32.png':  32,
}

for fname, sz in OUTPUTS.items():
    img = master.resize((sz, sz), Image.LANCZOS)
    img.save(fname, 'PNG', optimize=True)
    print(f'  -> {fname:18s} {sz:>4d}x{sz:<4d}  {os.path.getsize(fname):>6d} bytes')

print('Fertig.')
