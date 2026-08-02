#!/usr/bin/env python3
"""Erzeugt die App-Icons fuer ROMA (ohne externe Bibliotheken).

Aufruf:  python3 generate-icons.py
Ergebnis: icon-512.png, icon-192.png, icon-180.png, favicon-32.png
"""
import struct
import zlib
import os

BG_OBEN = (58, 38, 26)
BG_UNTEN = (26, 18, 13)
GOLD = (224, 180, 81)
GOLD_D = (176, 133, 48)
TERRA = (165, 70, 47)


def leinwand(n):
    """Bild als Liste von Zeilen mit RGB-Tupeln, mit Farbverlauf gefuellt."""
    px = []
    for y in range(n):
        t = y / max(1, n - 1)
        c = tuple(round(BG_OBEN[i] + (BG_UNTEN[i] - BG_OBEN[i]) * t) for i in range(3))
        px.append([c] * n)
    return px


def rechteck(px, x0, y0, x1, y1, farbe):
    n = len(px)
    for y in range(max(0, int(y0)), min(n, int(y1))):
        for x in range(max(0, int(x0)), min(n, int(x1))):
            px[y][x] = farbe


def dreieck(px, x0, x1, yspitze, ybasis, farbe):
    """Gleichschenkliges Dreieck (Giebel)."""
    n = len(px)
    mitte = (x0 + x1) / 2
    hoehe = ybasis - yspitze
    for y in range(max(0, int(yspitze)), min(n, int(ybasis))):
        t = (y - yspitze) / hoehe
        hw = (x1 - x0) / 2 * t
        for x in range(max(0, int(mitte - hw)), min(n, int(mitte + hw) + 1)):
            px[y][x] = farbe


def tempel(px, n):
    """Roemischer Tempel: Giebel, Saeulen, Stufen."""
    rand = n * 0.14
    breite = n - 2 * rand
    giebel_oben = n * 0.16
    giebel_unten = n * 0.36
    dreieck(px, rand - n * 0.03, n - rand + n * 0.03, giebel_oben, giebel_unten, GOLD)
    # Architrav
    rechteck(px, rand - n * 0.02, giebel_unten, n - rand + n * 0.02, giebel_unten + n * 0.055, GOLD_D)
    # Saeulen
    saeulen = 4
    oben = giebel_unten + n * 0.065
    unten = n * 0.78
    lueck = breite / (saeulen * 2 + 1)
    for i in range(saeulen):
        x0 = rand + lueck * (i * 2 + 1)
        rechteck(px, x0, oben, x0 + lueck, unten, GOLD)
        rechteck(px, x0 + lueck * 0.62, oben, x0 + lueck, unten, GOLD_D)
    # Stufen
    rechteck(px, rand - n * 0.04, unten, n - rand + n * 0.04, unten + n * 0.05, GOLD_D)
    rechteck(px, rand - n * 0.08, unten + n * 0.05, n - rand + n * 0.08, unten + n * 0.10, GOLD)
    rechteck(px, rand - n * 0.12, unten + n * 0.10, n - rand + n * 0.12, unten + n * 0.155, GOLD_D)
    # Grundlinie in Terrakotta
    rechteck(px, 0, unten + n * 0.155, n, n, TERRA)


def schreibe_png(pfad, px):
    n = len(px)
    roh = b''.join(b'\x00' + b''.join(struct.pack('3B', *p) for p in zeile) for zeile in px)

    def block(typ, daten):
        c = typ + daten
        return struct.pack('>I', len(daten)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += block(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0))
    png += block(b'IDAT', zlib.compress(roh, 9))
    png += block(b'IEND', b'')
    with open(pfad, 'wb') as f:
        f.write(png)
    print(pfad, os.path.getsize(pfad), 'Bytes')


def erzeuge(name, n):
    px = leinwand(n)
    tempel(px, n)
    schreibe_png(name, px)


if __name__ == '__main__':
    hier = os.path.dirname(os.path.abspath(__file__))
    os.chdir(hier)
    erzeuge('icon-512.png', 512)
    erzeuge('icon-192.png', 192)
    erzeuge('icon-180.png', 180)
    erzeuge('favicon-32.png', 32)
