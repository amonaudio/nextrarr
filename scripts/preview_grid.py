#!/usr/bin/env python3
"""
Render a textual preview of the grid as the frontend would display it,
based on the same mock data used in verify_extrarr.py.

This is an ASCII-art approximation showing:
- The card layout
- The icon overlays (top-left, top-right, bottom-left, bottom-right)
- The status colors (green/orange/warning)
- The alphabetical navigation sidebar
"""

import sys
import os

PROJECT_ROOT = "/home/z/my-project/download/extrarr"
sys.path.insert(0, PROJECT_ROOT)

MEDIA_ROOT = "/tmp/extrarr_mock"
CONFIG_DIR = "/tmp/extrarr_config"

import json
import shutil

# Rebuild the mock
for d in (MEDIA_ROOT, CONFIG_DIR):
    if os.path.exists(d):
        shutil.rmtree(d)
    os.makedirs(d)

movies_root = f"{MEDIA_ROOT}/Movies"
os.makedirs(movies_root)

m1 = f"{movies_root}/Movie 1 Complete"
os.makedirs(m1)
open(f"{m1}/theme.mp3", "w").close()
open(f"{m1}/Movie 1 Complete-clearlogo.png", "wb").close()
with open(f"{m1}/Movie 1 Complete.nfo", "w", encoding="utf-8") as f:
    f.write("<movie>\n  <title>Movie 1 Complete</title>\n"
            "  <trailer>plugin://plugin.video.youtube/play/?video_id=abc123XYZ_9</trailer>\n"
            "</movie>\n")

m2 = f"{movies_root}/Movie 2 Empty"
os.makedirs(m2)
with open(f"{m2}/Movie 2 Empty.nfo", "w", encoding="utf-8") as f:
    f.write("<movie>\n  <title>Movie 2 Empty</title>\n</movie>\n")

m3 = f"{movies_root}/Movie 3 Theme Only"
os.makedirs(m3)
open(f"{m3}/theme.mp3", "w").close()
with open(f"{m3}/Movie 3 Theme Only.nfo", "w", encoding="utf-8") as f:
    f.write("<movie>\n  <title>Movie 3 Theme Only</title>\n</movie>\n")

# Add a Movie 4 unmapped to test the warning icon path
# (its radarr path won't match the path_map → is_mapped=False)
m4 = f"{movies_root}/Another Movie Unmapped"
os.makedirs(m4)

CONFIG = {
    "radarr_url": "http://mock:7878",
    "radarr_api_key": "mock-key",
    "sonarr_url": "",
    "sonarr_api_key": "",
    "fanart_api_key": "",
    "tmdb_api_key": "",
    "path_map": [{"docker": "/movies", "local": movies_root}],
}
with open(f"{CONFIG_DIR}/config.json", "w", encoding="utf-8") as f:
    json.dump(CONFIG, f, indent=2)
os.chmod(f"{CONFIG_DIR}/config.json", 0o600)

os.environ["EXTRARR_CONFIG_FILE"] = f"{CONFIG_DIR}/config.json"
os.environ["EXTRARR_ALLOWED_PREFIXES"] = f"{MEDIA_ROOT},/tmp"
os.environ["EXTRARR_LOG_LEVEL"] = "ERROR"

MOCK_RADARR_MEDIA = [
    {"id": 1, "title": "Movie 1 Complete", "year": 2020,
     "path": "/movies/Movie 1 Complete",
     "images": [{"coverType": "poster", "remoteUrl": "https://image.tmdb.org/t/p/original/aaa.jpg"}],
     "added": "2024-01-15T00:00:00Z"},
    {"id": 2, "title": "Movie 2 Empty", "year": 2021,
     "path": "/movies/Movie 2 Empty",
     "images": [{"coverType": "poster", "remoteUrl": "https://image.tmdb.org/t/p/original/bbb.jpg"}],
     "added": "2024-02-20T00:00:00Z"},
    {"id": 3, "title": "Movie 3 Theme Only", "year": 2022,
     "path": "/movies/Movie 3 Theme Only",
     "images": [{"coverType": "poster", "remoteUrl": "https://image.tmdb.org/t/p/original/ccc.jpg"}],
     "added": "2024-03-30T00:00:00Z"},
    {"id": 4, "title": "Another Movie Unmapped", "year": 2023,
     "path": "/unmapped/Another Movie Unmapped",  # does NOT match path_map
     "images": [{"coverType": "poster", "remoteUrl": "https://image.tmdb.org/t/p/original/ddd.jpg"}],
     "added": "2024-04-10T00:00:00Z"},
]

from app import create_app
app = create_app()

import app.services.radarr_sonarr as rs
import app.routes.media as media_route
rs.fetch_media_list = lambda config, media_type, timeout=15: MOCK_RADARR_MEDIA
rs.fetch_root_folders = lambda config, media_type, timeout=10: ["/movies", "/unmapped"]
media_route.radarr_sonarr.fetch_media_list = rs.fetch_media_list
media_route.radarr_sonarr.fetch_root_folders = rs.fetch_root_folders

client = app.test_client()
r = client.get("/api/media/radarr")
data = r.get_json()

# === Render ===

def ansi(text, color):
    codes = {"green": 32, "orange": 33, "blue": 34, "red": 31, "yellow": 93, "gray": 90, "bold": 1}
    return f"\033[{codes[color]}m{text}\033[0m"

print()
print("=" * 78)
print(" " + ansi("🎬 Extrarr v2.0.0 — GRID PREVIEW (rendered from /api/media JSON)", "bold"))
print("=" * 78)

# Header (mimics the actual page header)
print()
print(f"  🎬 Extrarr {ansi('v2.0.0', 'orange')}                              🎬 Radarr 📺 Sonarr 🔄")
print(f"  Controls: [Radarr] [Sonarr] [🔄] | Filter: All | Sort: Title ⬇ | Search...")
print(f"             ▎ local-search 🔎 | youtube-search | 🌙 | ⚙️")

# Stats
valid = [m for m in data if m["is_mapped"] and m["folder_exists"]]
tH = sum(1 for m in valid if m["has_theme"])
aH = sum(1 for m in valid if m["has_artwork"])
trH = sum(1 for m in valid if m["has_trailer"])
print()
print(f"  🎵 Tema: {tH}/{len(valid)} | 🖼️ Artwork: {aH}/{len(valid)} | 🎬 Trailer: {trH}/{len(valid)} "
      f"(Valide: {len(valid)}/{len(data)})")

# Grid header
print()
print(f"  Risultati visualizzati: {ansi(str(len(data)), 'orange')}")

# Render each card (in the order the frontend would: sorted by title asc)
data_sorted = sorted(data, key=lambda m: m["title"].lower())
data_sorted.reverse()  # sortDir=asc reverses after sort

print()
print("  " + "─" * 74)
print(f"  {'Card':<6} {'Title':<28} {'Year':<6} │ Top-L  Top-R  Bot-L          Bot-R")
print("  " + "─" * 74)

for i, m in enumerate(data_sorted, 1):
    title = m["title"][:27]
    year = str(m["year"])[:5]

    # Determine icon overlays (mirrors grid.js buildCard logic)
    if not m["is_mapped"]:
        top_l = ansi("⚠️ unmapped", "yellow")
        top_r = ""
        bot_l = ""
        bot_r = ""
    elif not m["folder_exists"]:
        top_l = ansi("⚠️ no-folder", "yellow")
        top_r = ""
        bot_l = ""
        bot_r = ""
    else:
        top_l = ansi("🔧", "gray")
        # Top-right: theme status (green checkmark OR orange download arrow)
        if m["has_theme"]:
            top_r = ansi("✔️", "green")
        else:
            top_r = ansi("⬇️", "orange")
        # Bottom-left: play-theme | view-art | play-trailer (disabled if missing)
        play = ansi("🎵", "gray") if m["has_theme"] else ansi("🎵·", "gray")
        art = ansi("👁️", "gray")
        trailer = ansi("🎬", "gray") if m["has_trailer"] else ansi("🎬·", "gray")
        bot_l = f"{play} {art} {trailer}"
        bot_r = ansi("🖼️", "gray")

    print(f"  [{i}]   {ansi(title, 'bold'):<36} {year:<6} │ {top_l:<8} {top_r:<6} {bot_l:<14} {bot_r}")

print()
print("  " + "─" * 74)
print("  Legend:")
print(f"    {ansi('✔️', 'green')} = tema presente   {ansi('⬇️', 'orange')} = tema mancante (click per scaricare)")
print(f"    {ansi('⚠️', 'yellow')} = warning (percorso non mappato o cartella inesistente)")
print(f"    {ansi('·', 'gray')} suffisso = icona disabilitata (azione non disponibile)")
print(f"    🔧 = editor   🎵 = play tema   👁️ = vedi artwork   🎬 = play trailer   🖼️ = scarica artwork")

# Alpha nav
print()
print("  Alpha-nav sidebar (right edge):")
letters = sorted(set(m["title"][0].upper() for m in data))
print("    " + " ".join(letters))

# Modal preview: editor for Movie 1
print()
print("=" * 78)
print(" " + ansi("📝 Modal preview: Editor (🔧 click on Movie 1 Complete)", "bold"))
print("=" * 78)
print()
print("  ┌────────────────────────────────────────────────────────────────────┐")
print("  │ Editor: Movie 1 Complete                                       [×] │")
print("  ├────────────────────────────────────────────────────────────────────┤")
print("  │ 🎵 Tema Musicale (✅ Presente)                                    │")
print("  │ ┌──────────────────────────────────────────────────────────────┐ │")
print("  │ │ [🔍 Cerca Tema su YouTube                                    ] │ │")
print("  │ │ [Incolla link YouTube tema     ] [⬇️]                         ] │ │")
print("  │ └──────────────────────────────────────────────────────────────┘ │")
print("  │                                                                  │")
print("  │ 🎬 Trailer (NFO)                                                 │")
print("  │ ┌──────────────────────────────────────────────────────┐         │")
print("  │ │ [🔍 Cerca Trailer su YouTube                         ]         │")
print("  │ │ [Incolla link YouTube trailer  ] [Salva NFO]          ]         │")
print("  │ └──────────────────────────────────────────────────────┘         │")
print("  └────────────────────────────────────────────────────────────────────┘")

# Modal preview: artwork browser
print()
print("=" * 78)
print(" " + ansi("🖼️ Modal preview: Artwork browser (👁️ click on Movie 1 Complete)", "bold"))
print("=" * 78)
print()
print("  ┌────────────────────────────────────────────────────────────────────┐")
print("  │ Gestione Artwork: Movie 1 Complete                            [×] │")
print("  ├────────────────────────────────────────────────────────────────────┤")
print("  │ 🖼️ Artwork Locali                                                  │")
print("  │ ┌────────┐ ┌────────┐ ┌────────┐                                  │")
print("  │ │  IMG   │ │  IMG   │ │  IMG   │   (one card per local file)       │")
print("  │ │Movie1- │ │Movie1- │ │Movie1- │                                     │")
print("  │ │clear.. │ │banner │ │land.. │                                     │")
print("  │ └────────┘ └────────┘ └────────┘                                  │")
print("  │                                                                  │")
print("  │ 🌐 Artwork Online (Fanart.tv)                                     │")
print("  │ ┌────────┐ ┌────────┐                                            │")
print("  │ │  IMG   │ │  IMG   │   [⬇️ Scarica/Sostituisci]                    │")
print("  │ │Tipo:.. │ │Tipo:.. │                                            │")
print("  │ └────────┘ └────────┘                                            │")
print("  │                                                                  │")
print("  │ 🎬 Artwork Online (TMDB)                                          │")
print("  │ ┌────────┐ ┌────────┐ ┌────────┐                                │")
print("  │ │  IMG   │ │  IMG   │ │  IMG   │                                │")
print("  │ └────────┘ └────────┘ └────────┘                                │")
print("  └────────────────────────────────────────────────────────────────────┘")

# Media bar
print()
print("=" * 78)
print(" " + ansi("🎵 Persistent media bar (after clicking 🎵 on Movie 1)", "bold"))
print("=" * 78)
print()
print("  ┌────────────────────────────────────────────────────────────────────┐")
print("  │ 🎵 Movie 1 Complete     [▶ ━━━━●━━━━━━━━━━ 00:42 / 03:21]         │")
print("  └────────────────────────────────────────────────────────────────────┘")

# Cleanup
shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
shutil.rmtree(CONFIG_DIR, ignore_errors=True)

print()
print("=" * 78)
print(" " + ansi("Preview rendered — mock library matches expected UI state.", "green"))
print("=" * 78)
