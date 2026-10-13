#!/bin/bash
SP=/c/Users/Bob/AppData/Local/Temp/claude/D--Code-Claude-fork-graft/b2ef0e79-7158-44b2-b9b8-981968ffed60/scratchpad/gate
run() { # label dir shell
  L=$1; WT=$2; SH=$3
  cd "$WT" || exit 2
  echo "tip $(git rev-parse --short HEAD) start $(date -u +%H:%M:%S) shell=$SH" > $SP/$L.seq.status
  if [ "$SH" = cmd ]; then
    cmd //c "npm run build && npm test" > $SP/$L.seq.log 2>&1
  else
    npm run build > $SP/$L.seq.log 2>&1 && npm test >> $SP/$L.seq.log 2>&1
  fi
  echo "gate exit $? end $(date -u +%H:%M:%S)" >> $SP/$L.seq.status
  grep -E '^ℹ (tests|pass|fail|skipped|duration_ms)' $SP/$L.seq.log | tr '\n' ' ' >> $SP/$L.seq.status; echo >> $SP/$L.seq.status
  grep "^✖" $SP/$L.seq.log | sort -u >> $SP/$L.seq.status
}
run crux /d/Code/Claude/fork_graft-accept-crux npm
run core /d/Code/Claude/fork_graft-accept-core npm
run markup /d/Code/Claude/fork_graft-accept-markup npm
run edges /d/Code/Claude/fork_graft-accept-edges npm
run docs /d/Code/Claude/fork_graft-accept-docs cmd
cat $SP/*.seq.status
