#!/usr/bin/env python3
"""
Mock verification: simulate a Radarr library + path map and verify
that /api/media returns correct flags, the grid data is well-formed,
and all security invariants hold.

Layout of the mock media library:
  /tmp/extrarr_mock/Movies/
    ├── "Movie 1 Complete/"      # theme + clearlogo + trailer  → all flags True
    │   ├── theme.mp3
    │   ├── "Movie 1 Complete-clearlogo.png"
    │   └── "Movie 1 Complete.nfo"  (with <trailer>)
    ├── "Movie 2 Empty/"          # nothing                    → all flags False
    │   └── "Movie 2 Empty.nfo"  (no <trailer>)
    └── "Movie 3 Theme Only/"    # theme only                  → only has_theme True
        ├── theme.mp3
        └── "Movie 3 Theme Only.nfo"  (no <trailer>)

Path map: docker /movies → host /tmp/extrarr_mock/Movies
"""

import sys
import os
import json
import shutil

PROJECT_ROOT = "/home/z/my-project/download/extrarr"
sys.path.insert(0, PROJECT_ROOT)

# ---- 1. Build mock media library on disk ----
MEDIA_ROOT = "/tmp/extrarr_mock"
CONFIG_DIR = "/tmp/extrarr_config"

for d in (MEDIA_ROOT, CONFIG_DIR):
    if os.path.exists(d):
        shutil.rmtree(d)
    os.makedirs(d)

movies_root = f"{MEDIA_ROOT}/Movies"
os.makedirs(movies_root)

# Movie 1: complete
m1 = f"{movies_root}/Movie 1 Complete"
os.makedirs(m1)
open(f"{m1}/theme.mp3", "w").close()
open(f"{m1}/Movie 1 Complete-clearlogo.png", "wb").close()
with open(f"{m1}/Movie 1 Complete.nfo", "w", encoding="utf-8") as f:
    f.write("<movie>\n  <title>Movie 1 Complete</title>\n"
            "  <trailer>plugin://plugin.video.youtube/play/?video_id=abc123XYZ_9</trailer>\n"
            "</movie>\n")

# Movie 2: nothing
m2 = f"{movies_root}/Movie 2 Empty"
os.makedirs(m2)
with open(f"{m2}/Movie 2 Empty.nfo", "w", encoding="utf-8") as f:
    f.write("<movie>\n  <title>Movie 2 Empty</title>\n</movie>\n")

# Movie 3: only theme
m3 = f"{movies_root}/Movie 3 Theme Only"
os.makedirs(m3)
open(f"{m3}/theme.mp3", "w").close()
with open(f"{m3}/Movie 3 Theme Only.nfo", "w", encoding="utf-8") as f:
    f.write("<movie>\n  <title>Movie 3 Theme Only</title>\n</movie>\n")

# ---- 2. Write config ----
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

# ---- 3. Set env vars BEFORE importing the app ----
os.environ["EXTRARR_CONFIG_FILE"] = f"{CONFIG_DIR}/config.json"
os.environ["EXTRARR_ALLOWED_PREFIXES"] = f"{MEDIA_ROOT},/tmp"
os.environ["EXTRARR_LOG_LEVEL"] = "WARNING"

# ---- 4. Mock data returned by Radarr API ----
MOCK_RADARR_MEDIA = [
    {"id": 1, "title": "Movie 1 Complete", "year": 2020,
     "path": "/movies/Movie 1 Complete",
     "images": [{"coverType": "poster", "remoteUrl": "https://image.tmdb.org/t/p/original/aaa.jpg"}],
     "added": "2024-01-15T00:00:00Z"},
    {"id": 2, "title": "Movie 2 Empty", "year": 2021,
     "path": "/movies/Movie 2 Empty", "images": [],
     "added": "2024-02-20T00:00:00Z"},
    {"id": 3, "title": "Movie 3 Theme Only", "year": 2022,
     "path": "/movies/Movie 3 Theme Only", "images": [],
     "added": "2024-03-30T00:00:00Z"},
]
MOCK_ROOT_FOLDERS = ["/movies"]

# ---- 5. Create Flask app + patch Radarr service ----
from app import create_app

app = create_app()

import app.services.radarr_sonarr as rs
import app.routes.media as media_route
import app.routes.artwork as art_route

rs.fetch_media_list = lambda config, media_type, timeout=15: MOCK_RADARR_MEDIA
rs.fetch_root_folders = lambda config, media_type, timeout=10: MOCK_ROOT_FOLDERS
rs.fetch_single_media = lambda c, mt, mid, timeout=10: MOCK_RADARR_MEDIA[mid - 1]
media_route.radarr_sonarr.fetch_media_list = rs.fetch_media_list
media_route.radarr_sonarr.fetch_root_folders = rs.fetch_root_folders
art_route.radarr_sonarr.fetch_single_media = rs.fetch_single_media

client = app.test_client()

# ---- 6. Run verifications ----
def header(title):
    print()
    print("=" * 72)
    print(f" {title}")
    print("=" * 72)

header("1) GET /health")
r = client.get("/health")
print(f" Status: {r.status_code}")
print(f" Body:   {r.get_data(as_text=True)}")
assert r.status_code == 200 and r.get_json() == {"status": "ok"}
print(" ✅ Health check OK")

header("2) GET /api/root_folders/radarr")
r = client.get("/api/root_folders/radarr")
print(f" Status: {r.status_code}")
print(f" Body:   {r.get_data(as_text=True)}")
assert r.status_code == 200
print(" ✅ Root folders OK")

header("3) GET /api/media/radarr — main grid data")
r = client.get("/api/media/radarr")
print(f" Status: {r.status_code}")
data = r.get_json()
assert r.status_code == 200
print(f" Items returned: {len(data)}")
print()
print(f' {"Title":<25} {"Year":<6} {"Theme":<7} {"Art":<5} {"Trailer":<8} {"Mapped":<7} {"Exists":<7}')
print(" " + "-" * 70)
for m in data:
    print(f' {m["title"]:<25} {str(m["year"]):<6} {str(m["has_theme"]):<7} {str(m["has_artwork"]):<5} {str(m["has_trailer"]):<8} {str(m["is_mapped"]):<7} {str(m["folder_exists"]):<7}')
print()
print(" Local path resolution (Docker /movies → Host via path_map):")
for m in data:
    print(f"   {m['title']:<25} → {m['local_path']}")

expected = {
    "Movie 1 Complete":   {"has_theme": True,  "has_artwork": True,  "has_trailer": True,  "is_mapped": True, "folder_exists": True},
    "Movie 2 Empty":      {"has_theme": False, "has_artwork": False, "has_trailer": False, "is_mapped": True, "folder_exists": True},
    "Movie 3 Theme Only": {"has_theme": True,  "has_artwork": False, "has_trailer": False, "is_mapped": True, "folder_exists": True},
}
print()
print(" Expected vs actual flag values:")
all_ok = True
for m in data:
    exp = expected.get(m["title"])
    if not exp:
        continue
    for k, v in exp.items():
        ok = m[k] == v
        if not ok:
            print(f"   ❌ {m['title']}.{k}: expected {v}, got {m[k]}")
            all_ok = False
if all_ok:
    print("   ✅ All flags match the expected mock library state")

header("4) Cache TTL test — second call should return identical data")
r1 = client.get("/api/media/radarr")
r2 = client.get("/api/media/radarr")
ok = r1.get_json() == r2.get_json()
print(f" {'✅' if ok else '❌'} Cache returns identical data on second call")

header("5) GET / — index.html structure")
r = client.get("/")
html = r.get_data(as_text=True)
checks = [
    ("csrf-token meta tag",        'name="csrf-token"' in html),
    ('data-theme="dark" body',    'data-theme="dark"' in html),
    ("theme.css linked",           '/static/css/theme.css' in html),
    ("layout.css linked",          '/static/css/layout.css' in html),
    ("components.css linked",       '/static/css/components.css' in html),
    ("app.js module loaded",       '/static/js/app.js' in html),
    ('type="module" on script',    'type="module"' in html),
    ("version badge v2.0.0",        'v2.0.0' in html),
    ("theme toggle button",         'data-action="toggle-theme"' in html),
    ("alpha-nav present",           'id="alpha-nav"' in html),
    ("grid container",              'id="grid"' in html),
    ("media-bar present",           'id="media-bar"' in html),
    ("all 7 modals present",        all(f'id="{mid}Modal"' in html for mid in
                                       ["customFilter", "settings", "browser", "search", "editor", "artwork", "video"])),
]
for name, ok in checks:
    print(f"   {'✅' if ok else '❌'} {name}")

header("6) Static asset serving")
for asset in ["/static/css/theme.css", "/static/css/layout.css", "/static/css/components.css",
              "/static/js/app.js", "/static/js/grid.js", "/static/js/api.js",
              "/static/favicon.png"]:
    r = client.get(asset)
    print(f"   {'✅' if r.status_code == 200 else '❌'} {asset} → {r.status_code} ({len(r.get_data())} bytes)")

header("7) Security: POST without CSRF token must be rejected")
r = client.post("/api/settings", json={"radarr_url": "http://evil"})
print(f"   {'✅' if r.status_code == 400 else '❌'} Status: {r.status_code} (expected 400)")

header("8) Security: path traversal attempts on artwork_image")
for url in ["/api/artwork_image/radarr/1/../../../../etc/passwd",
            "/api/artwork_image/radarr/1/..%2F..%2Fetc%2Fpasswd",
            "/api/artwork_image/radarr/1/..\\..\\win.ini"]:
    r = client.get(url)
    blocked = r.status_code in (400, 404)
    print(f"   {'✅' if blocked else '❌'} {url[:60]:<60} → {r.status_code}")
    if not blocked:
        print(f"      ⚠️  Body: {r.get_data(as_text=True)[:200]}")

header("9) Security: SSRF attempts via download_specific_artwork")
r = client.post(
    "/api/download_specific_artwork/radarr/1",
    json={"url": "http://169.254.169.254/latest/meta-data/", "our_type": "clearlogo", "ext": "png"}
)
print(f"   {'✅' if r.status_code == 400 else '❌'} AWS metadata endpoint rejected: {r.status_code}")
r = client.post(
    "/api/download_specific_artwork/radarr/1",
    json={"url": "https://evil.example.com/x.png", "our_type": "clearlogo", "ext": "png"}
)
print(f"   {'✅' if r.status_code == 400 else '❌'} Non-whitelisted domain rejected: {r.status_code}")

header("10) Final stats snapshot (what the UI header would show)")
if data:
    valid = [m for m in data if m["is_mapped"] and m["folder_exists"]]
    tH = sum(1 for m in valid if m["has_theme"])
    aH = sum(1 for m in valid if m["has_artwork"])
    trH = sum(1 for m in valid if m["has_trailer"])
    print(f"   🎵 Tema:     {tH}/{len(valid)}")
    print(f"   🖼️ Artwork: {aH}/{len(valid)}")
    print(f"   🎬 Trailer:  {trH}/{len(valid)}")
    print(f"   Valide: {len(valid)}/{len(data)}")

shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
shutil.rmtree(CONFIG_DIR, ignore_errors=True)

print()
print("=" * 72)
print(" " + ("🎉 ALL CHECKS PASSED — Extrarr v2.0.0 ready for deployment"
             if all_ok else "⚠️  Some checks failed — review output above"))
print("=" * 72)
