#!/bin/bash
cd /tmp/mm2
for arm in SINGLE:frost_bite SINGLE:numbing_gale SINGLE:killing_frost SINGLE:rimefrost SINGLE:ice_spear; do
  echo "=== $arm $(date)"
  npx vite-node scratch/t149_width.ts -- --width 3 --arm $arm --iter 5 --opps ink_loop --out results/t149_width/w3_percard.jsonl
done
echo "=== done $(date)"
