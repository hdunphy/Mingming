#!/bin/bash
cd /tmp/mm2
for arm in SHIPPED SINGLE_ALL; do
  echo "=== $arm ref_solo_a $(date)"
  npx vite-node scratch/t149_width.ts -- --width 3 --arm $arm --iter 5 --opps ref_solo_a --out results/t149_width/w3.jsonl
done
echo "=== done $(date)"
