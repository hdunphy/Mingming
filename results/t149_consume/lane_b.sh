#!/bin/bash
# lane B: the rest of the roster, 20 games/opponent (10 paired iterations) - OS census only
cd /tmp/mm2
for d in skoll_v2 fenrir_v1 ymir_v1 ymir_v2 huldra_v2 draugr_v1 draugr_v2 fafnir_v1 fafnir_v2 audhumbla_v2 nidhoggr_v1 kraken_v1 ratatoskr_v2 hel_v1 valkyrie_v1 gullinbursti_v1; do
  npx vite-node scratch/t149_castprobe.ts -- --width 1 --owner $d --iter 10 --out results/t149_oscensus/w1_$d.jsonl
done
echo LANE_B_DONE
