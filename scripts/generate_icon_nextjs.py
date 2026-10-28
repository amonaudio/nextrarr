#!/usr/bin/env python3
"""Generate a 256x256 PNG icon for nEXTrarr 0.1 (Next.js version)."""
import struct
import zlib
import os

W = H = 256

def make_png():
    bg = (0x0a, 0x0a, 0x0a, 0xff)   # near-black background
    fg = (0xff, 0x8c, 0x1f, 0xff)  # orange (nEXTrarr brand)
    light = (0xe0, 0xe0, 0xe0, 0xff)

    pixels = bytearray()
    for y in range(H):
        pixels.append(0)
        for x in range(W):
            r, g, b, a = bg
            # Border
            if 20 <= x <= 235 and 20 <= y <= 235 and (
                x <= 24 or x >= 231 or y <= 24 or y >= 231
            ):
                r, g, b, a = fg
            # Top stripe (clapper top)
            if 30 <= y <= 50 and 30 <= x <= 225:
                r, g, b, a = fg
            # Diagonal stripes on the clapper top
            if 30 <= y <= 50:
                period = (x - 30) // 24
                if period % 2 == 0 and (x - 30) % 24 < 12:
                    r, g, b, a = bg
            # "nE" stylized in the center (lowercase n + uppercase E)
            # E
            if 70 <= x <= 120 and (
                100 <= y <= 115 or 145 <= y <= 160 or 185 <= y <= 200 or
                (100 <= y <= 200 and 70 <= x <= 80)
            ):
                r, g, b, a = light
            # n (left of E, lowercase)
            if 30 <= x <= 60:
                # left vertical bar of n
                if 100 <= y <= 200 and 30 <= x <= 40:
                    r, g, b, a = light
                # right vertical bar of n
                if 100 <= y <= 200 and 50 <= x <= 60:
                    r, g, b, a = light
                # top horizontal connector
                if 100 <= y <= 110 and 30 <= x <= 60:
                    r, g, b, a = light
                # diagonal hump (approximate with two diagonal lines)
                if abs((x - 35) - (y - 105)) < 4 and 105 <= y <= 200:
                    r, g, b, a = light
            pixels.extend((r, g, b, a))

    compressed = zlib.compress(bytes(pixels), 9)

    def chunk(typ, data):
        return (
            struct.pack(">I", len(data)) +
            typ + data +
            struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "unraid")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "icon.png")
    with open(out, "wb") as f:
        f.write(make_png())
    # Also copy to /public/favicon.png for the Next.js app
    public_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
    os.makedirs(public_dir, exist_ok=True)
    with open(os.path.join(public_dir, "favicon.png"), "wb") as f:
        f.write(make_png())
    print(f"Wrote {out} and {public_dir}/favicon.png")
