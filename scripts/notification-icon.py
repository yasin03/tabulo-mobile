# Android bildirim simgesi: logo işaretinin beyaz silueti, "t" harfi saydam oyuk (docs/designs/logo.svg geometrisi).
# Kullanım: python3 scripts/notification-icon.py assets/images/notification-icon.png
import math, struct, sys, zlib

SIZE = 96
SS = 4
# Logo koordinatları (120'lik viewBox): sekme 64..86 x 22..38, gövde 28..92 x 30..96
BX0, BY0, BX1, BY1 = 28, 22, 92, 96
PAD = 10
scale = (SIZE - 2 * PAD) / max(BX1 - BX0, BY1 - BY0)
ox = (SIZE - (BX1 - BX0) * scale) / 2 - BX0 * scale
oy = (SIZE - (BY1 - BY0) * scale) / 2 - BY0 * scale

def in_rrect(x, y, x0, y0, w, h, r):
    x1, y1 = x0 + w, y0 + h
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def quad(p0, p1, p2, n=24):
    return [((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0], (1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]) for t in (i/n for i in range(n+1))]

stroke_t = [(56, 42), (56, 76)] + quad((56, 76), (56, 87), (67, 87))[1:] + [(72, 87)]
stroke_bar = [(45, 55), (71, 55)]
HALF = 5

def dist_seg(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    l = dx*dx + dy*dy
    t = 0 if l == 0 else max(0, min(1, ((px-ax)*dx + (py-ay)*dy) / l))
    return math.hypot(px - (ax + t*dx), py - (ay + t*dy))

def on_stroke(x, y, pts):
    return any(dist_seg(x, y, pts[i], pts[i+1]) <= HALF for i in range(len(pts)-1))

def covered(x, y):
    if in_rrect(x, y, 64, 22, 22, 16, 4) and not in_rrect(x, y, 28, 30, 64, 66, 10):
        return True
    if in_rrect(x, y, 28, 30, 64, 66, 10):
        return not (on_stroke(x, y, stroke_t) or on_stroke(x, y, stroke_bar))
    return False

rows = []
for py in range(SIZE):
    row = bytearray([0])
    for px in range(SIZE):
        hits = 0
        for sy in range(SS):
            for sx in range(SS):
                X = (px + (sx + .5) / SS - ox) / scale
                Y = (py + (sy + .5) / SS - oy) / scale
                hits += covered(X, Y)
        a = round(255 * hits / (SS * SS))
        row += bytes([255, 255, 255, a])
    rows.append(bytes(row))

def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0)) \
    + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
open(sys.argv[1], 'wb').write(png)
