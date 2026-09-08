#!/bin/bash
# lane A: the 3c owners + named 3d owners, 40 games/opponent (20 paired iterations)
cd /tmp/mm2
for d in nidhoggr_v2 jormungandr_v2 huldra_v1 jormungandr_v1 fenrir_v2 valkyrie_v2 hel_v2 hraesvelgr_v1 jormungandr_v2_dup; do
  [ "$d" = jormungandr_v2_dup ] && continue
  npx vite-node scratch/t149_castprobe.ts -- --width 1 --owner $d --iter 20 --out results/t149_consume/w1_$d.jsonl
done
npx vite-node scratch/t149_castprobe.ts -- --width 1 --owner fenrir_v2 --swap water_slap:fire_punch_v2 --cards fire_punch_v2 --iter 20 --out results/t149_oscensus/w1_fenrir_v2_firepunch.jsonl
for d in control_v1 sleipnir_v1 sleipnir_v2 ratatoskr_v1 hraesvelgr_v2 audhumbla_v1 gullinbursti_v2 kraken_v2 skoll_v1; do
  npx vite-node scratch/t149_castprobe.ts -- --width 1 --owner $d --iter 20 --out results/t149_oscensus/w1_$d.jsonl
done
echo LANE_A_DONE
