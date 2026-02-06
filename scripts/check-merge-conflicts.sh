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

merge_output=$(git merge-tree --write-tree --messages HEAD "$target_ref")

if printf '%s\n' "$merge_output" | rg -q "CONFLICT"; then
  echo "Merge conflicts detected between HEAD and $target_ref."
  echo ""
  echo "[Conflict details]"
  printf '%s\n' "$merge_output" | rg "CONFLICT"
  echo ""
  echo "[Likely conflicted files]"
  conflicted_files=$(printf '%s\n' "$merge_output" | rg "CONFLICT" | sed -E "s#^CONFLICT \([^)]*\): Merge conflict in ##" | sort -u)
  if [[ -n "$conflicted_files" ]]; then
    printf '%s\n' "$conflicted_files"
  else
    echo "(could not infer files from merge-tree output)"
  fi
  exit 2
fi

echo "No merge conflicts detected between HEAD and $target_ref."
