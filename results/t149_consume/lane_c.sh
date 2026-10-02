#!/bin/bash
# lane C (relaunched lighter - the box is at load 6 on 2 cores): 3v3 panel cells for the consume family, 10 battles a cell
cd /tmp/mm2
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp zoo --owner huldra_v1 --cards hexbloom --opps control --iter 5 --out results/t149_consume/w3_huldra_v1.jsonl
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp control --owner jormungandr_v2 --cards contagion --opps zoo --iter 5 --out results/t149_consume/w3_jormungandr_v2.jsonl
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp ink_loop --owner jormungandr_v1 --cards corrosive_leak,serpents_coil --opps control --iter 5 --out results/t149_consume/w3_jormungandr_v1.jsonl
npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp zoo --owner huldra_v1 --cards hexbloom --opps ink_loop --iter 5 --out results/t149_consume/w3_huldra_v1.jsonl
echo LANE_C_DONE
