#!/bin/sh
# Downloads the 2-frame demo images (public domain, github.com/yuhonas/free-exercise-db)
# for every `demo:` id referenced in src/program/exercises.ts and finishers.ts into public/exercises/.
set -e
cd "$(dirname "$0")/.."
BASE=https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises
for id in $(grep -ho "demo: '[^']*'" src/program/exercises.ts src/program/finishers.ts | cut -d"'" -f2 | sort -u); do
  mkdir -p "public/exercises/$id"
  for f in 0 1; do
    [ -s "public/exercises/$id/$f.jpg" ] || curl -sfL -o "public/exercises/$id/$f.jpg" "$BASE/$id/$f.jpg" || echo "missing $id/$f"
  done
done
