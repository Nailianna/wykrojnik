#!/bin/sh
# Składa interfejs z części i sprawdza całość. Uruchamiaj po każdej zmianie w src/app albo engine.js.
#   src/app/*.js -> app.js  (części łączone w kolejności nazw; razem tworzą jedną funkcję)
# Wymaga Node.js i TypeScript (npm i -g typescript).
set -e
cd "$(dirname "$0")/.."
cat src/app/*.js > app.js
node --check app.js
tsc -p tools
node tools/check.js | tail -1
echo "zbudowano"
