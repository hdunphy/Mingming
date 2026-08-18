#!/bin/bash
# Ticket 82: BUFF sweeps for the bottom four. OS knobs first, then the dead cards.
cd /root/mm
run(){ DECK=$1 ARM=$2 ITER=15 timeout 900 npx tsx scratch/offenders.ts 2>&1 \
  | grep -E "^RESULT|^  field|^  ragnarok|^  berserk|^  maelstrom|^  hydro|^  deep_vein|^  hoardbreaker|^  veinburst|^  boulder"; }

# fenrir_v1 - the OS is a WASH (+0.9). Cut the recoil it charges on every attack.
for a in recoil=0 recoil=1 str=2 swap=ember_mend:crimson_draw; do run fenrir_v1 "$a"; done

# kraken_v2 - the payoff is unaffordable: 3e cards on a 2-Energy frame, 0.5-0.7 casts a game.
for a in tidalcost=2 tidalpct=0.30 swap=maelstrom:pressure_point; do run kraken_v2 "$a"; done

# fafnir_v1 - slag_shed is 72% dead and measures 0.0. hoard recoil is his OS's price.
for a in hoardpct=0.005 swap=slag_shed:motherlode attack=72; do run fafnir_v1 "$a"; done

# fafnir_v2 - his OS works (+12.1); he is closest to the line.
for a in strper=3 attack=72; do run fafnir_v2 "$a"; done
echo SWEEP4-COMPLETE
