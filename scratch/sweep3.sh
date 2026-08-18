#!/bin/bash
# Ticket 81: knob + stat sweeps for ymir_v1, hraesvelgr_v2, valkyrie_v2, plus hel_v2's healing.
cd /root/mm
run(){ DECK=$1 ARM=$2 ITER=15 timeout 900 npx tsx scratch/offenders.ts 2>&1 \
  | grep -E "^RESULT|^  field|^  Bark|^  avalanche|^  thermal|^  firestorm|^  starfall|^  ascension|^  soul"; }
for a in shield=3 shield=2 card=avalanche:6 card=avalanche:7 hp=104 defense=72; do run ymir_v1 "$a"; done
for a in shuffles=2 shuffles=3 hp=60 attack=72 defense=55; do run hraesvelgr_v2 "$a"; done
for a in rebirth=10 rebirth=8 noheal=1 hp=74 attack=72 defense=68; do run valkyrie_v2 "$a"; done
for a in heal=1.25 heal=1.0; do run hel_v2 "$a"; done
echo SWEEP3-COMPLETE
