# nEXTrarr — Stato del progetto

Ultimo aggiornamento: 2026-10-26
Workspace: `/config/workspace/nextrarr/nextrarr-0.8.2`
Repo: `https://github.com/amonaudio/nextrarr`
Docker Hub: `amonaudio/nextrarr`
Versione: `0.8.3`
Branch: `main`
Ultimo commit pubblicato: `2613a37 Release v0.8.2`
Tag pubblicato: `v0.8.2`
Stato: `v0.8.3` implementata e verificata localmente; commit/tag/push da eseguire.

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

## 2. Cosa contiene v0.8.3

### Tooltip — 3 secondi uniformi (T1)
- Un unico `TooltipProvider` nel root layout con
  `delayDuration={3000}` e `skipDelayDuration={0}`.
- Rimosso il provider interno al componente base `Tooltip`, che aveva
  `delayDuration=0` e annullava i provider esterni.
- Rimossi i provider locali da header, media-card e media-player.
- Sidebar allineata a 3000 ms.
- File: `src/app/layout.tsx`, `src/components/ui/tooltip.tsx`,
  `src/components/ui/sidebar.tsx`, `header.tsx`, `media-card.tsx`,
  `media-player.tsx`.

### Badge NEW — B3 / C2 / D1
- Pallino pulsante in basso a sinistra sul poster.
- Visibile solo per titoli aggiunti negli ultimi **14 giorni** e con almeno
  un'azione mancante: mapping, cartella, tema, artwork o trailer.
- Testo visibile solo "NEW" tramite tooltip al passaggio del mouse.
- Logica pura in `src/lib/media-badge.ts` (`isRecentlyAdded`,
  `needsMediaAction`), usata da `media-card.tsx`.
- Mock aggiornati con date relative per mostrare il badge in demo mode;
  TV mock con `tmdbId` per i link esterni.

### Filtri artwork — F1 / P1 / Z1
- Barra filtro globale unica sopra i tre pannelli della ArtworkModal.
- Tipi: Tutti, Poster, Clearlogo, Clearart, Banner, Landscape/Fanart,
  Discart, Keyart.
- Conteggi globali su locale + Fanart + TMDB.
- Reset a "Tutti" a ogni apertura.
- Tipi con 0 elementi visibili ma disabilitati.
- Tipo locale dedotto dal filename; tipo online da `our_type`.
- Helper condiviso client/server: `src/lib/artwork-types.ts`.
- Messaggi vuoti specifici per filtro e sezione.
- File: `src/components/extrarr/artwork-modal.tsx`.

### Cartella locale — L1
- Click su "Artwork Locali" apre una modale in-app read-only.
- Mostra path, file, directory e symlink, con dimensioni dei file.
- Nessuna navigazione, upload o delete nella modale cartella.
- Endpoint: `GET /api/local-folder/[type]/[id]`.
- Sicurezza: tipo/id validati, path da Radarr/Sonarr risolto con path map,
  controllo prefissi consentiti, nessun path utente, nessuna ricorsione,
  symlink elencati ma non seguiti, limite 500 elementi.
- File: `src/app/api/local-folder/[type]/[id]/route.ts`,
  `src/components/extrarr/local-folder-modal.tsx`.
- `.gitignore`: aggiunte eccezioni perché la regola `local-*` ignorava
  per errore i nuovi file.

### Link Fanart.tv / TMDB — X1
- Titoli delle colonne online cliccabili.
- Endpoint: `GET /api/external-links/[type]/[id]?title=...`.
- Fanart: TMDB ID per film, TVDB ID per serie.
- TMDB: `tmdbId`; per Sonarr senza `tmdbId` usa `resolveTmdbId`.
- Se l'ID manca o Radarr/Sonarr non risponde, restituisce URL di ricerca.
- `resolveTmdbId` ora esportata da `src/lib/services/tmdb.ts`.
- I link vengono prefetchati all'apertura della modale; il client ha un
  fallback di ricerca immediato per evitare popup bloccati.

### Version bump
Aggiornati: `package.json`, badge header, `README.md`, `CHANGELOG.md`,
`Dockerfile`, `entrypoint.sh`, `STATO.md`.

## 3. File chiave

| File | Ruolo |
|---|---|
| `src/components/extrarr/artwork-modal.tsx` | Filtri globali, header cliccabili, modale cartella |
| `src/components/extrarr/local-folder-modal.tsx` | Elenco cartella read-only |
| `src/app/api/local-folder/[type]/[id]/route.ts` | API cartella locale |
| `src/app/api/external-links/[type]/[id]/route.ts` | URL Fanart/TMDB + fallback |
| `src/lib/artwork-types.ts` | Tipi artwork, label, classificazione filename |
| `src/lib/media-badge.ts` | Logica badge NEW (14 giorni + azioni mancanti) |
| `src/lib/services/tmdb.ts` | `resolveTmdbId` esportata |
| `src/app/layout.tsx` | `TooltipProvider` globale 3000 ms |
| `src/components/ui/tooltip.tsx` | Tooltip senza provider interno |
| `src/components/extrarr/media-card.tsx` | Pallino NEW B3 |
| `src/lib/mock-data.ts` | Date relative + TMDB ID TV |
| `mockup-v0.8.3.html` | Mockup approvato (T1, B3/C2/D1, F1/P1/Z1, L1, X1) |
| `CHANGELOG.md` | Dettaglio modifiche 0.8.3 |

## 4. Cache

- `mediaCache`: lista completa per tipo, TTL 5 minuti (`src/lib/cache.ts`).
- `folderCache`: scansione cartella media, TTL 60 secondi (`src/lib/folder-cache.ts`).
- `/api/refresh` pulisce le cache server.
- Il refresh manuale ricarica media e root folders.
- La cache HTTP è bypassata con `no-store` + URL poster versionate.

## 5. Ambiente e verifiche

- Node di default nel container: **18.19.1**; Next.js 16 richiede **>= 20.9**.
- Node 20.19.0 usato per build/test:
  `/tmp/opencode/node-v20.19.0-linux-x64/bin` (directory temporanea).
- Build verificata dopo `rm -rf .next`:
  ```bash
  cd /config/workspace/nextrarr/nextrarr-0.8.2
  PATH=/tmp/opencode/node-v20.19.0-linux-x64/bin:$PATH npm run build
  ```
- Se la build fallisce con `ENOTEMPTY` su `.next/standalone/node_modules/.prisma`,
  assicurarsi che non ci siano `next-server` attivi e rimuovere `.next`.
- Typecheck: restano **2 errori preesistenti**, non introdotti in 0.8.3:
  - `src/lib/security.ts:74` (`name` unknown)
  - `src/lib/settings-store.ts:62` (type predicate)
- ESLint sui file toccati: **pulito**.
- `npm run lint` completo: restano **5 errori preesistenti**
  `react-hooks/set-state-in-effect` in `page.tsx`, `editor-modal.tsx`,
  `settings-modal.tsx`, `carousel.tsx`, `use-mobile.ts`.
  Il reset della ArtworkModal ha una disable locale documentata.
- Smoke test demo eseguito su build standalone:
  - `/api/health` → 200
  - `/` → 200, badge `v0.8.3` presente
  - `/api/external-links/radarr/1` → pagina Matrix
  - `/api/external-links/sonarr/101` → pagina Breaking Bad
  - `/api/local-folder/radarr/1` e `/sonarr/101` → elenchi mock
  - `/api/artwork-files/radarr/1` → `[]`
- Test helper puri: 15/15 (date badge, azioni mancanti, classificazione
  artwork locale, alias `logo`/`fanart`).
- Nessun browser headless disponibile: test visivo manuale ancora consigliato.
- Non ci sono CLI `docker` o `gh`; usare Git + GitHub Actions.

## 6. Pubblicazione v0.8.3

La GitHub Action `.github/workflows/docker-publish.yml`:

- su push `main`: build amd64, senza push;
- su tag `v*`: build multi-arch amd64+arm64 e push su Docker Hub + GHCR;
- `latest` viene aggiornato solo per tag `v*`.

Comandi previsti:

```bash
cd /config/workspace/nextrarr/nextrarr-0.8.2
git add .gitignore CHANGELOG.md Dockerfile README.md entrypoint.sh package.json \
  STATO.md mockup-v0.8.3.html src/app src/components src/lib
git commit -m "Release v0.8.3"
git tag -a v0.8.3 -m "Release v0.8.3"
GIT_TERMINAL_PROMPT=0 git push origin main
GIT_TERMINAL_PROMPT=0 git push origin v0.8.3
```

Non committare `yarn.lock`. Non usare `publish.sh`: fa `git add -A`, messaggio
vecchio e force-push dei tag.

Verifica CI pubblica:

```bash
curl -s 'https://api.github.com/repos/amonaudio/nextrarr/actions/runs?per_page=5'
curl -s 'https://hub.docker.com/v2/repositories/amonaudio/nextrarr/tags?page_size=10'
```

## 7. Sicurezza e file da non committare

- `extrarr.db` contiene API key e path locali. È ignorato da `.gitignore` e
  `.dockerignore`, ma è rimasto nella storia Git fino alla v0.8.1. Le chiavi
  andrebbero ruotate.
- Script di pulizia storia preparato ma NON eseguito:
  `scripts/purge-extrarr-db-history.sh`.
- `.env` è ignorato: non committarlo e non incollare il contenuto in chat.
- `yarn.lock` è untracked e non va committato (il progetto usa `bun.lock`).
- `public/logo.svg` è il logo usato per header, favicon e Unraid.

## 8. Test manuali consigliati su v0.8.3

- Header, card e player: il tooltip compare dopo ~3 secondi, non subito.
- Card di un titolo aggiunto da meno di 14 giorni con metadati mancanti:
  pallino pulsante in basso a sinistra; sparisce quando tutto è completo.
- ArtworkModal:
  - filtro "Clearlogo" filtra tutte e tre le colonne;
  - ricontrollare i conteggi;
  - chiudere e riaprire: filtro torna "Tutti";
  - un tipo a 0 è visibile ma disabilitato.
- Click su "Artwork Locali": modale read-only con elenco cartella.
- Click su "Online (Fanart.tv)" e "Online (TMDB)": apre la pagina esatta.
- Provare un titolo senza ID / con servizio arr irraggiungibile: deve aprire
  la ricerca, non fallire.
- Verificare su desktop (3 colonne, scroll indipendenti) e mobile.

## 9. Regole per il nuovo agent

- Non rifare le release 0.8.2/0.8.3 già pubblicate; per modifiche nuove usare 0.8.4.
- Non committare, taggare o pushare senza richiesta esplicita.
- Prima di modificare, leggere i file interessati e controllare `git status`.
- Usare Node 20 per build/dev; Node 18 non è compatibile con Next 16.
- Non aggiungere segreti o `extrarr.db` al repository.
- Se si toccano icone: aggiornare `public/logo.svg`, eseguire
  `node scripts/generate-icons.mjs`, verificare i due PNG.
