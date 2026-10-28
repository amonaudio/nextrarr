#!/usr/bin/env bash
# purge-extrarr-db-history.sh
#
# Removes extrarr.db (and its journal) from the ENTIRE git history, then
# force-pushes the rewritten branches and tags to origin.
#
# WHY:
#   extrarr.db is a runtime SQLite database containing Radarr/Sonarr/Fanart/
#   TMDB API keys and local paths. It was mistakenly committed and is still
#   reachable in the public GitHub history even after being untracked.
#
# ⚠️  THIS REWRITES HISTORY. Before running:
#   1. Rotate every API key that was stored in extrarr.db. Rewriting history
#      removes the data from the latest refs, but old objects can remain in
#      GitHub caches and in forks/clones. Rotation is the only real fix.
#   2. Coordinate with any other clone/contributor. Everyone must re-clone
#      (or hard-reset) after the force-push.
#   3. Optionally ask GitHub Support to purge cached views of the old commits
#      after the push.
#
# USAGE:
#   ./scripts/purge-extrarr-db-history.sh
#   REMOTE=origin ./scripts/purge-extrarr-db-history.sh
#
# The script creates a bundle backup outside the repo before doing anything.
# The backup CONTAINS THE SECRETS: delete it once you have verified the purge.

set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
BACKUP="${BACKUP:-$(pwd)/../nextrarr-pre-purge-$(date +%Y%m%d-%H%M%S).bundle}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Not inside a git repository."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit or stash your changes first."
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "❌ Remote '$REMOTE' not found."
  exit 1
fi

echo "This will rewrite ALL commits and tags to remove extrarr.db."
echo "Remote:  $REMOTE ($(git remote get-url "$REMOTE"))"
echo "Branch:  $BRANCH"
echo "Backup:  $BACKUP"
echo ""
read -r -p "Type PURGE to continue: " ANSWER
if [[ "$ANSWER" != "PURGE" ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "💾 Creating backup bundle..."
git bundle create "$BACKUP" --all
echo "✅ Backup written to $BACKUP"
echo ""

echo "🧹 Rewriting history (git filter-branch)..."
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --prune-empty \
  --index-filter 'git rm --cached --ignore-unmatch extrarr.db extrarr.db-journal' \
  --tag-name-filter cat -- --branches --tags

echo ""
echo "🧽 Removing backup refs and expiring reflogs..."
for ref in $(git for-each-ref --format='%(refname)' refs/original); do
  git update-ref -d "$ref"
done
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Check ONLY local branches/tags here: the remote-tracking refs still point to
# the old (unrewritten) history until we force-push and prune them below.
if git rev-list --branches --tags --objects | grep -qE ' extrarr\.db(-journal)?$'; then
  echo "❌ extrarr.db is still present in local branches/tags. Aborting before push."
  echo "   Restore if needed with: git bundle unbundle \"$BACKUP\""
  exit 1
fi
echo "✅ extrarr.db no longer referenced by any local branch or tag."

echo ""
echo "🚀 Force-pushing rewritten history..."
git push --force-with-lease "$REMOTE" "$BRANCH"
git push --force "$REMOTE" --tags

echo ""
echo "🔄 Pruning stale remote-tracking refs and old objects..."
git fetch --prune "$REMOTE"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

if git rev-list --all --objects | grep -qE ' extrarr\.db(-journal)?$'; then
  echo "⚠️  extrarr.db still reachable from a local ref; inspect with:"
  echo "   git rev-list --all --objects | grep extrarr.db"
else
  echo "✅ extrarr.db is gone from all local refs."
fi

echo ""
echo "✅ Done. History purge pushed to $REMOTE."
echo ""
echo "Next steps:"
echo "  1. Verify: git rev-list --all --objects | grep extrarr.db   # no output"
echo "  2. Other collaborators must re-clone or run:"
echo "       git fetch --all && git reset --hard $REMOTE/$BRANCH"
echo "  3. Ask GitHub Support to purge cached views of the old commits."
echo "  4. Delete the backup once verified (it contains the leaked keys):"
echo "       rm -f \"$BACKUP\""
echo "  5. Rotate all API keys that were stored in extrarr.db."
