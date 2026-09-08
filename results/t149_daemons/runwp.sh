#!/bin/bash
cd /tmp/mm2
for arm in SHIPPED DRAW2; do
  echo "=== $arm $(date)"
  npx vite-node scratch/t149_whirlpool.ts -- --arm $arm --iter 20 --out results/t149_daemons/whirlpool.jsonl
done
echo "=== done $(date)"
