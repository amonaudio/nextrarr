#!/bin/bash
# publish.sh — uno-script-fa-tutto per pubblicare una nuova release di
# nEXTrarr su GitHub + Docker Hub dal tuo server Unraid.
#
# USO:
#   cd /path/to/nextrarr-0.7.13/      # la cartella estratta dallo zip
#   chmod +x publish.sh
#   ./publish.sh 0.7.13              # versione da rilasciare
#
# PREREQUISITI:
#   1. Git installato (su Unraid 6.x è di default nel plugin NerdPack
#      oppure scaricabile da https://github.com/unraid/NERDPACK)
#   2. Account GitHub con accesso in scrittura al repo
#      amonaudio/nextrarr (o il tuo fork)
#   3. Personal Access Token (PAT) GitHub con scope:
#      - repo (per pushare codice + tag)
#      - write:packages (per il push dell'immagine a GHCR)
#      Crealo su https://github.com/settings/tokens
#   4. Sul server Unraid, configura git credential helper per evitare
#      di inserire il PAT ogni volta:
#        git config --global credential.helper store
#      Al primo push ti verrà chiesto username + password (inserisci
#      il PAT come password). Saranno salvati in ~/.git-credentials.
#   5. Sul repo GitHub, configura i secrets per la GitHub Action:
#      Settings → Secrets and variables → Actions → New repository secret
#        - DOCKERHUB_USERNAME = il tuo username Docker Hub (es. amonaudio)
#        - DOCKERHUB_TOKEN    = un Access Token di Docker Hub
#                               (https://hub.docker.com/settings/security)
#
# COSA FA LO SCRIPT:
#   1. Verifica di essere in una directory con package.json di nextrarr
#   2. Se non esiste .git/, lo inizializza e aggiunge il remote
#   3. git add -A (include le modifiche ai file)
#   4. git commit con messaggio "Release vX.Y.Z"
#   5. git push origin main (o forzato se il remote è già aggiornato)
#   6. git tag vX.Y.Z (annotated)
#   7. git push origin vX.Y.Z → triggera la GitHub Action
#   8. Stampa l'URL per seguire la build su GitHub Actions
#
# DOPO LO SCRIPT:
#   - Vai su https://github.com/amonaudio/nextrarr/actions
#   - Attendi che la build "Build & Publish Docker Image" diventi verde
#     (di solito 5-15 min per amd64+arm64 multi-arch)
#   - Verifica che l'immagine sia pubblicata:
#       docker pull amonaudio/nextrarr:latest
#       docker pull amonaudio/nextrarr:v0.7.13
#   - In Unraid webUI → Apps → cerca nEXTrarr → Update
#     (oppure semplicemente: click sul container esistente → Update)

set -euo pipefail

# --- 0. Argomenti e validazione ---
VERSION="${1:-}"
if [[ -z "${VERSION}" ]]; then
  echo "❌ Uso: $0 <versione>"
  echo "   Esempio: $0 0.7.13"
  exit 1
fi

# Normalizza: rimuovi 'v' iniziale se presente
VERSION="${VERSION#v}"
TAG="v${VERSION}"

# Verifica di essere nella directory giusta
if [[ ! -f package.json ]] || ! grep -q '"nextrarr"' package.json 2>/dev/null; then
  echo "❌ Non sono nella directory del progetto nextrarr."
  echo "   Esegui: cd /path/to/nextrarr-${VERSION}/"
  exit 1
fi

# Verifica che la versione in package.json match
PKG_VERSION=$(grep -oE '"version":\s*"[^"]+"' package.json | head -1 | sed -E 's/.*"version":\s*"([^"]+)".*/\1/')
if [[ "${PKG_VERSION}" != "${VERSION}" ]]; then
  echo "❌ La versione in package.json (${PKG_VERSION}) non matcha la versione richiesta (${VERSION})."
  echo "   Aggiorna package.json + README.md + Dockerfile + entrypoint.sh + header.tsx"
  echo "   prima di eseguire questo script."
  exit 1
fi

# GitHub repo (default: amonaudio/nextrarr — cambialo se hai un fork)
GITHUB_REPO="${GITHUB_REPO:-amonaudio/nextrarr}"
REMOTE_URL="https://github.com/${GITHUB_REPO}.git"

echo "🎬 nEXTrarr release publisher"
echo "   Versione:  ${VERSION}"
echo "   Tag:       ${TAG}"
echo "   Repository: ${GITHUB_REPO}"
echo ""

# --- 1. Git init se necessario ---
if [[ ! -d .git ]]; then
  echo "📁 Inizializzo repository git..."
  git init -b main
  git remote add origin "${REMOTE_URL}"
  echo "✅ Repository inizializzato. Remote: ${REMOTE_URL}"
else
  # Verifica/aggiungi il remote se non esiste
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "${REMOTE_URL}"
    echo "✅ Remote aggiunto: ${REMOTE_URL}"
  else
    CURRENT_REMOTE=$(git remote get-url origin)
    if [[ "${CURRENT_REMOTE}" != "${REMOTE_URL}" ]]; then
      echo "⚠️  Remote attuale: ${CURRENT_REMOTE}"
      echo "   Voglio impostarlo a: ${REMOTE_URL}"
      read -p "   Sovrascrivo? [y/N] " -n 1 -r
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote set-url origin "${REMOTE_URL}"
        echo "✅ Remote aggiornato."
      fi
    else
      echo "✅ Remote già configurato: ${REMOTE_URL}"
    fi
  fi
fi

# --- 2. Configura utente git se non lo è ---
if [[ -z "$(git config user.name)" ]]; then
  echo "⚙️  Configuro utente git di default (cambialo con git config user.name/email se vuoi)..."
  git config user.name "nEXTrarr Maintainer"
  git config user.email "nextrarr@users.noreply.github.com"
fi

# --- 3. Stage di tutti i cambiamenti ---
echo ""
echo "📦 Aggiungo i cambiamenti allo stage..."
git add -A

# Verifica che ci sia qualcosa da committare
if git diff --cached --quiet; then
  echo "ℹ️  Nessun cambiamento da committare (working tree pulito)."
else
  # Mostra un summary
  echo "   Modifiche da committare:"
  git diff --cached --stat | head -20
fi

# --- 4. Commit ---
echo ""
echo "💾 Committo..."
# Usa --allow-empty perché potremmo voler creare un commit solo per il tag
# (se i cambiamenti sono già stati committati)
git commit --allow-empty -m "Release ${TAG}

Changes in ${VERSION}:
- ArtworkModal width fix: max-w-6xl → full viewport width (100vw)
- Inside each section: grid-cols-2 → grid-cols-1 (each thumb takes full section width)
- Thumbnail height: h-48 (200px) → h-64 (256px)
- Thumbnails now ~3.5x wider than v0.8.0 — user can actually see artwork detail

See CHANGELOG.md for the full list of changes."
echo "✅ Commit creato."

# --- 5. Push su main ---
echo ""
echo "🚀 Push su main (potrebbe chiedere credenziali la prima volta)..."
git push -u origin main || {
  echo "❌ Push su main fallito. Possibili cause:"
  echo "   - Non sei autenticato (configura git credential.helper store)"
  echo "   - Il remote ha commit che non hai in locale (fai git pull --rebase origin main)"
  echo "   - Non hai accesso in scrittura al repo ${GITHUB_REPO}"
  exit 1
}
echo "✅ Push su main completato."

# --- 6. Tag ---
echo ""
echo "🏷️  Creo tag annotato ${TAG}..."
# Forza il tag (se già esiste lo sovrascrive)
git tag -a "${TAG}" -m "Release ${TAG}" -f || {
  echo "❌ Creazione del tag fallita."
  exit 1
}

# --- 7. Push del tag (triggera la CI) ---
echo ""
echo "🚀 Push del tag ${TAG} (triggera la GitHub Action)..."
git push origin "${TAG}" --force || {
  echo "❌ Push del tag fallito. Possibili cause:"
  echo "   - Non sei autenticato"
  echo "   - Il tag esiste già sul remote (uso --force per sovrascriverlo)"
  exit 1
}
echo "✅ Tag pushato."

# --- 8. Riepilogo ---
echo ""
echo "🎉 Release ${TAG} pubblicata con successo!"
echo ""
echo "📋 Prossimi passi:"
echo ""
echo "   1. Apri https://github.com/${GITHUB_REPO}/actions"
echo "      Verifica che il workflow 'Build & Publish Docker Image' sia"
echo "      in esecuzione. Attendi che diventi verde (~5-15 min per"
echo "      multi-arch amd64+arm64)."
echo ""
echo "   2. Quando la build è completa, verifica che l'immagine sia"
echo "      stata pubblicata su Docker Hub:"
echo "        docker pull amonaudio/nextrarr:${TAG}"
echo "        docker pull amonaudio/nextrarr:latest"
echo ""
echo "   3. In Unraid webUI:"
echo "      - Apps → cerca 'nEXTrarr' → click sul container esistente"
echo "      - Update → seleziona 'amonaudio/nextrarr:latest' come tag"
echo "      - Apply → il container si riavvia con la nuova versione"
echo ""
echo "   4. Verifica il badge versione nell'header della webui:"
echo "      http://TUO_UNRAID_IP:3000/ → deve mostrare 'v${VERSION}'"
echo ""
echo "🔊 That's all folks."
