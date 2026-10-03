#!/usr/bin/env bash
# Vercel Lean Mode: skip non-runtime main-branch changes.
# Exit 0 = skip build; exit 1 = build.
set -u

log(){ printf '[vercel-lean] %s\n' "$*"; }
build(){ log "BUILD: $*"; exit 1; }
skip(){ log "SKIP: $*"; exit 0; }

branch="${VERCEL_GIT_COMMIT_REF:-}"
[ -z "$branch" ] || [ "$branch" = "main" ] || skip "non-main branch $branch"
current_sha="${VERCEL_GIT_COMMIT_SHA:-}"
previous_sha="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$current_sha" ] || current_sha="$(git rev-parse HEAD 2>/dev/null || true)"
[ -n "$current_sha" ] || build 'current commit SHA unavailable'
git cat-file -e "${current_sha}^{commit}" 2>/dev/null || build 'current commit unavailable locally'
[ -n "$previous_sha" ] || build 'previous deployment SHA unavailable'
if ! git cat-file -e "${previous_sha}^{commit}" 2>/dev/null; then
  log "Previous deployed commit $previous_sha is not local; fetching it"
  git fetch --no-tags --depth=1 origin "$previous_sha" >/dev/null 2>&1 || true
fi
git cat-file -e "${previous_sha}^{commit}" 2>/dev/null || build 'previous deployed commit unavailable after targeted fetch'
changed_files="$(git diff --name-only --no-renames "$previous_sha" "$current_sha" -- 2>/dev/null)" || build 'git diff failed'
[ -n "$changed_files" ] || skip 'no file changes'

safe_to_skip(){
  case "$1" in
    README.md|README.*|*.md|*.mdx) return 0 ;;
    docs/*|.github/*|tests/*|test/*|__tests__/*|*/__tests__/*) return 0 ;;
    coverage/*|*/coverage/*|reports/*|*/reports/*|artifacts/*|*/artifacts/*) return 0 ;;
    scripts/vercel-ignore-build.sh) return 0 ;;
    *.test.js|*.test.jsx|*.test.ts|*.test.tsx|*.spec.js|*.spec.jsx|*.spec.ts|*.spec.tsx) return 0 ;;
    *) return 1 ;;
  esac
}
while IFS= read -r file; do
  [ -n "$file" ] || continue
  safe_to_skip "$file" || build "runtime-impacting or unknown path changed: $file"
done <<EOF_CHANGED
$changed_files
EOF_CHANGED
skip 'all changes are docs/CI/tests/reports/ignore-policy only'
