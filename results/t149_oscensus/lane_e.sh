#!/bin/bash
# lane E (2026-09-09): the 3d owners lane A never reached, 20 games/opponent like lane B; then the 3c 3v3 cells lane C never reached
cd /tmp/mm2
for d in ratatoskr_v1 gullinbursti_v2 kraken_v2 hraesvelgr_v2 audhumbla_v1 skoll_v1 sleipnir_v1 sleipnir_v2 control_v1; do
  npx vite-node scratch/t149_castprobe.ts -- --width 1 --owner $d --iter 10 --out results/t149_oscensus/w1_$d.jsonl
done
echo LANE_E_1V1_DONE
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp control --owner jormungandr_v2 --cards contagion --opps zoo,ink_loop --iter 5 --out results/t149_consume/w3_jormungandr_v2.jsonl
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp ink_loop --owner jormungandr_v1 --cards corrosive_leak,serpents_coil --opps control,zoo --iter 5 --out results/t149_consume/w3_jormungandr_v1.jsonl
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp zoo --owner huldra_v1 --cards hexbloom --opps ink_loop,fire_pair --iter 5 --out results/t149_consume/w3_huldra_v1_b.jsonl
echo LANE_E_DONE
