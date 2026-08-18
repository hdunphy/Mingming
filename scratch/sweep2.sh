#!/bin/bash
# Ticket 79: stat + OS-knob sweeps for the remaining three offenders.
cd /root/mm
run(){ DECK=$1 ARM=$2 ITER=15 timeout 900 npx tsx scratch/offenders.ts 2>&1 \
  | grep -E "^RESULT|^  field|^  glacial|^  wither|^  blight|^  rend|^  leech|^  she crosses"; }
for a in ice=0.15 ice=0.10 ice=0 maxcards=1 hp=104 attack=80 defense=72; do run ymir_v2 "$a"; done
for a in rootmin=2 rootmin=3 rootmin=4 hp=90 attack=85 defense=68; do run nidhoggr_v1 "$a"; done
for a in oppsonly=1 drop=draw drop=energy hp=90 attack=85 defense=68; do run nidhoggr_v2 "$a"; done
echo SWEEP-COMPLETE
