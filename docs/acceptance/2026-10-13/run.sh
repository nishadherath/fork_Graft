#!/bin/bash
# usage: run.sh <worktree-dir> <label>
set -o pipefail
WT=$1; L=$2; SP=/c/Users/Bob/AppData/Local/Temp/claude/D--Code-Claude-fork-graft/b2ef0e79-7158-44b2-b9b8-981968ffed60/scratchpad/gate
KOT="/c/nvm4w/nodejs/node_modules/@nanonets/graft/node_modules/tree-sitter-kotlin/build"
cd "$WT" || exit 2
echo "tip $(git rev-parse --short HEAD) $(date -u +%H:%M:%S)" > $SP/$L.status
npm ci --ignore-scripts > $SP/$L.install.log 2>&1; echo "install exit $? $(date -u +%H:%M:%S)" >> $SP/$L.status
mkdir -p node_modules/tree-sitter-kotlin/build && cp -r "$KOT/Release" node_modules/tree-sitter-kotlin/build/ ; echo "kotlin copy exit $?" >> $SP/$L.status
npm run build > $SP/$L.build.log 2>&1; echo "build exit $? $(date -u +%H:%M:%S)" >> $SP/$L.status
npm test > $SP/$L.test.log 2>&1; echo "test exit $? $(date -u +%H:%M:%S)" >> $SP/$L.status
grep -E '^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)' $SP/$L.test.log >> $SP/$L.status
cat $SP/$L.status
