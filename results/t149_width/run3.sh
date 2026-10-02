#!/bin/bash
cd /tmp/mm2
for arm in SHIPPED SINGLE_ALL; do
  echo "=== $arm $(date)"
  npx vite-node scratch/t149_width.ts -- --width 3 --arm $arm --iter 5 --opps ink_loop,zoo,fire_pair --out results/t149_width/w3.jsonl
done
echo "=== done $(date)"
