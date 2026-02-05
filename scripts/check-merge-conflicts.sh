#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

target_ref=${1:-origin/main}

if ! git rev-parse --verify "$target_ref" >/dev/null 2>&1; then
  echo "Target ref '$target_ref' not found."
  echo "Add a remote (e.g. 'git remote add origin <REMOTE_URL>') and fetch,"
  echo "or pass an existing ref like 'main' or a branch name."
  exit 1
fi

base_ref=$(git merge-base HEAD "$target_ref")

if git merge-tree "$base_ref" HEAD "$target_ref" | rg -n "<<<<<<<|=======|>>>>>>>"; then
  echo "Merge conflicts detected between HEAD and $target_ref."
  exit 2
fi

echo "No merge conflicts detected between HEAD and $target_ref."
