# nEXTrarr — Stato del progetto

Ultimo aggiornamento: 2026-10-30
Workspace: directory `nextrarr-0.8.32`
Repo: `https://github.com/amonaudio/nextrarr`
Docker Hub: `amonaudio/nextrarr`
Versione: `0.8.32`
Branch: `main`
Stato: **pubblicata** su GitHub (tag `v0.8.32`), Docker Hub e GHCR
(`linux/amd64`); `latest` allineato.

Questo file serve a ripartire da un context nuovo senza perdere le decisioni
importanti. Leggerlo prima di modificare codice; poi controllare `git status`
e `CHANGELOG.md`.

## 1. Panoramica

nEXTrarr è un tool per completare metadati/artwork di librerie Radarr e Sonarr.

Stack:

- Next.js 16 (App Router), React 19, TypeScript
- Zustand per lo stato client
- shadcn/ui + Tailwind
- Prisma + SQLite (`extrarr.db`) per impostazioni/filtri
- API route Next.js per Radarr/Sonarr, Fanart.tv, TMDB, YouTube/yt-dlp, filesystem locale

Modalità demo: `EXTRARR_DEMO_MODE=1` oppure API key non configurate.
In demo mode le API restituiscono dati mock.

## 2. Cosa contiene v0.8.32

### Nuova shell editoriale
- Design derivato dal mockup approvato `mockup-v0.8.32.html`.
- Palette calda chiaro/scuro, tipografia serif per i titoli, accento tangerine.
- Rail sinistro persistente con viste rapide, cartelle e stato connessione.
- Topbar sticky con ricerca, sorgente Film/Serie, refresh e azioni.
- Drawer mobile per la navigazione.
- File: `src/app/globals.css`, `src/app/page.tsx`,
  `src/components/extrarr/library-sidebar.tsx`,
  `src/components/extrarr/library-topbar.tsx`.

### Hero copertura libreria
- Anello di copertura live, barre tema/artwork/trailer, conteggi titoli
  validi e avvisi percorso.
- Scorciatoie “Completa i mancanti”.
- File: `src/components/extrarr/library-overview.tsx`.

### Toolbar e viste
- Filtri principali, cartella root, ordinamento, ricerca locale e toggle
  griglia/lista in un'unica toolbar.
- Vista lista compatta con contatore completamento e azioni rapide per riga.
- File: `src/components/extrarr/library-toolbar.tsx`,
  `src/components/extrarr/media-grid.tsx`.

### Command palette (⌘K)
- Ricerca locale dei titoli, filtri rapidi, switch Radarr/Sonarr, refresh,
  impostazioni, tema e ricerca YouTube globale.
- File: `src/components/extrarr/command-palette.tsx`.

### Card e player
- Card con overlay poster, badge NEW, chip qualità, stati di avviso e footer
  completamento 0/3.
- Player trasformato in dock flottante visibile solo durante la riproduzione.
- File: `src/components/extrarr/media-card.tsx`,
  `src/components/extrarr/media-player.tsx`.

### Logica condivisa
- Filtri, ordinamento e statistiche estratti in `src/lib/library.ts`, così
  griglia, lista, hero e toolbar usano gli stessi conteggi.
- Semantica esistente preservata: filtri, sort, cartella, ricerca e filtri
  personalizzati.

### Ereditato da v0.8.3 (ancora attivo)
- Tooltip uniformi a 3 secondi (`TooltipProvider` globale).
- Badge NEW: ultimi 14 giorni + almeno un'azione mancante
  (`src/lib/media-badge.ts`).
- Filtri artwork globali per tipo (`src/lib/artwork-types.ts`).
- Cartella locale read-only (`/api/local-folder/[type]/[id]`).
- Link esterni Fanart.tv/TMDB (`/api/external-links/[type]/[id]`).

### Version bump
Aggiornati: `package.json`, `README.md`, `CHANGELOG.md`, `Dockerfile`,
`entrypoint.sh`, badge header, `STATO.md`.

## 3. File chiave

| File | Ruolo |
|---|---|
| `src/app/page.tsx` | Orchestrazione shell, stato, modali e azioni |
| `src/app/globals.css` | Design tokens chiari/scuri, utility e tipografia |
| `src/lib/library.ts` | Filtri, ordinamento e statistiche libreria |
| `src/components/extrarr/library-sidebar.tsx` | Rail, viste, cartelle, connessione |
| `src/components/extrarr/library-topbar.tsx` | Topbar sticky, ricerca, sorgente |
| `src/components/extrarr/library-overview.tsx` | Hero copertura e scorciatoie |
| `src/components/extrarr/library-toolbar.tsx` | Toolbar filtri e vista griglia/lista |
| `src/components/extrarr/command-palette.tsx` | Palette comandi e ricerca YouTube |
| `src/components/extrarr/media-grid.tsx` | Griglia/lista e stato vuoto |
| `src/components/extrarr/media-card.tsx` | Card, badge NEW, azioni rapide |
| `src/components/extrarr/media-player.tsx` | Player dock flottante |
| `src/components/extrarr/artwork-modal.tsx` | Filtri artwork e modale cartella |
| `src/components/extrarr/local-folder-modal.tsx` | Elenco cartella read-only |
| `src/lib/artwork-types.ts` | Tipi artwork e classificazione filename |
| `src/lib/media-badge.ts` | Logica badge NEW |
| `src/lib/services/tmdb.ts` | `resolveTmdbId` esportata |
| `mockup-v0.8.32.html` | Mockup approvato del redesign |
| `CHANGELOG.md` | Dettaglio modifiche e verifiche 0.8.32 |

## 4. Cache

- `mediaCache`: lista completa per tipo, TTL 5 minuti (`src/lib/cache.ts`).
- `folderCache`: scansione cartella media, TTL 60 secondi (`src/lib/folder-cache.ts`).
- `/api/refresh` pulisce le cache server.
- Il refresh manuale ricarica media e root folders.
- La cache HTTP è bypassata con `no-store` + URL poster versionate.

## 5. Ambiente e verifiche

- Node di default nel container: **18.19.1**; Next.js 16 richiede **>= 20.9**.
- Node 22.14.0 usato per build/test:
  `/tmp/node-v22.14.0-linux-x64/bin` (directory temporanea; in un nuovo
  ambiente verificare che esista o installare Node 20+).
- `.env` incluso nel pacchetto usa `DATABASE_URL=file:../db/custom.db`
  (relativo a `prisma/schema.prisma`). `db/custom.db` è vuoto e senza segreti.
- Build verificata in `nextrarr-0.8.32`:
  ```bash
  cd nextrarr-0.8.32
  PATH=/tmp/node-v22.14.0-linux-x64/bin:$PATH npm run build
  ```
  La build genera `.next/standalone` e copia `static` e `public`.
- Se la build fallisce con `ENOTEMPTY` su `.next/standalone/node_modules/.prisma`,
  assicurarsi che non ci siano `next-server` attivi e rimuovere `.next`.
- Typecheck: restano **2 errori preesistenti**, non introdotti in 0.8.32:
  - `src/lib/security.ts:74` (`name` unknown)
  - `src/lib/settings-store.ts:62` (type predicate)
- ESLint sui componenti/helper nuovi o toccati: **pulito**.
- `npm run lint` completo: restano errori preesistenti
  `react-hooks/set-state-in-effect` in `page.tsx`, `editor-modal.tsx`,
  `settings-modal.tsx`, `carousel.tsx`, `use-mobile.ts`.
- Smoke test demo su build standalone (porta 3123):
  - `/` → 200
  - `/api/media/radarr` → 200
  - `/api/media/sonarr` → 200
  - `/api/settings` → 200
  - nessun errore runtime nel log del server.
- Nessun browser headless disponibile: test visivo manuale ancora consigliato.
- Non ci sono CLI `docker` o `gh`; usare Git + GitHub Actions.

## 6. Release v0.8.32 pubblicata

- Git: `main` aggiornato al commit `dd5f285` (`Release v0.8.32 - Editorial
  library redesign`); tag annotato `v0.8.32` (oggetto `30d7b70`, commit
  `dd5f285`) pushato su `origin`.
- Docker Hub: `amonaudio/nextrarr:v0.8.32` e `:latest`, `linux/amd64`.
- GHCR: `ghcr.io/amonaudio/nextrarr:v0.8.32` e `:latest`, `linux/amd64`.
- Digest immagine: `sha256:de9d23e4767d6af36dcaf1b00beb08ee446debab664e82452b926a602c15520a`.
- Run GitHub Actions tag `v0.8.32`: `41009098236`, conclusa con successo
  (login Docker Hub/GHCR e build+push OK).
- Run GitHub Actions push `main`: `41009089877`, conclusa con successo
  (solo build, nessun push immagine).
- La precedente `v0.8.31` resta sul tag `v0.8.31` e sul branch `master`.
- Workflow attuale (`.github/workflows/docker-publish.yml`):
  - su push `main` e PR: build `linux/amd64`, senza push;
  - su tag `v*`: build `linux/amd64` e push su Docker Hub + GHCR;
  - `workflow_dispatch` accetta `release_tag` per ripubblicare un tag già
    esistente senza riscriverlo;
  - QEMU rimosso, `platforms: linux/amd64` (Unraid è solo x86_64);
  - `latest` aggiornato su tag `v*` o dispatch di release;
  - label `revision` presa dal commit effettivamente checkoutato.
- Non committare `yarn.lock`. Non usare `publish.sh`: fa `git add -A`, usa un
  messaggio vecchio e fa force-push dei tag.

## 7. Sicurezza e file da non committare

- `extrarr.db` contiene API key e path locali. È ignorato da `.gitignore` e
  `.dockerignore`, ma è rimasto nella storia Git fino alla v0.8.1. Le chiavi
  andrebbero ruotate.
- Script di pulizia storia preparato ma NON eseguito:
  `scripts/purge-extrarr-db-history.sh`.
- `.env` è ignorato: non committarlo e non incollare il contenuto in chat.
- `yarn.lock` è untracked e non va committato (il progetto usa `bun.lock`).
- `public/logo.svg` è il logo usato per header, favicon e Unraid.

## 8. Test manuali consigliati su v0.8.32

- Desktop: rail persistente, topbar sticky, hero copertura e toolbar allineati;
  nessuno scroll orizzontale indesiderato.
- Mobile: drawer apribile/chiudibile, toolbar leggibile, card a colonna.
- Toggle griglia/lista: stessi titoli, stessi conteggi, azioni rapide corrette.
- `⌘K`/`Ctrl+K`: ricerca titoli, filtri, switch Film/Serie, refresh,
  impostazioni e ricerca YouTube.
- Hero: anello e barre coerenti con i filtri attivi; “Completa i mancanti”
  imposta il filtro corretto.
- Card: badge NEW, chip qualità, avvisi mapping/cartella e footer 0/3.
- Player: il dock appare solo durante la riproduzione e si chiude correttamente.
- ArtworkModal: filtro globale, conteggi, reset a “Tutti”, tipi a 0 disabilitati.
- Cartella locale e link Fanart.tv/TMDB invariati rispetto alla 0.8.3.
- Tooltip: compaiono dopo ~3 secondi, non subito.

## 9. Regole per il nuovo agent

- `0.8.32` è pubblicata: non riscrivere tag né immagini già rilasciate.
- Per modifiche nuove dopo la release usare la versione successiva (0.8.33/0.8.4).
- Non committare, taggare o pushare senza richiesta esplicita.
- Prima di modificare, leggere i file interessati e controllare `git status`.
- Usare Node 20+ per build/dev; Node 18 non è compatibile con Next 16.
- Non aggiungere segreti o `extrarr.db` al repository.
- Il workflow builda solo `linux/amd64`: Unraid è x86_64-only.
- Se si toccano icone: aggiornare `public/logo.svg`, eseguire
  `node scripts/generate-icons.mjs`, verificare i due PNG.

## 10. Pacchetto sviluppo `nextrarr-0.8.32.zip`

Contiene tutto il necessario per ripartire in una nuova chat/sessione:

- sorgenti `src/`, `public/`, `prisma/`, `scripts/`, `.github/`, `unraid/`,
  `mini-services/` e `.zscripts/` (senza PID);
- configurazioni progetto, Docker, Unraid e lockfile `bun.lock`;
- documentazione (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`),
  `STATO.md` e i mockup approvati, incluso `mockup-v0.8.32.html`;
- `.env` di sviluppo con DB relativo e `db/custom.db` vuoto (0 righe).

Esclusi di proposito: `.git` (può contenere il vecchio DB nella storia),
`node_modules`, `.next`, `extrarr.db` (API key), `yarn.lock`, `*.tsbuildinfo`,
`.zscripts/dev.pid` e artifact locali.

Avvio rapido:

```bash
unzip nextrarr-0.8.32.zip
cd nextrarr-0.8.32
bun install
bun run dev
```

In alternativa `npm install` / `npm run dev` con Node 20+. Per la cronologia
Git completa usare il remoto `https://github.com/amonaudio/nextrarr`.
