#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

echo "[1/3] Git remotes"
if git remote -v | grep -q .; then
  git remote -v
else
  echo "(no git remotes configured)"
fi

echo ""
echo "[2/3] Working tree status"
git status -sb

echo ""
echo "[3/3] Conflict markers"
if rg -n "<<<<<<<|=======|>>>>>>>" -S . --glob '!scripts/check-conflicts.sh'; then
  echo "(conflict markers detected above)"
else
  echo "(no conflict markers found)"
fi
