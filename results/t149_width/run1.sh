#!/bin/bash
cd /tmp/mm2
for arm in SHIPPED SINGLE_ALL SINGLE:frost_bite SINGLE:numbing_gale SINGLE:killing_frost SINGLE:rimefrost SINGLE:ice_spear; do
  echo "=== $arm $(date)"
  npx vite-node scratch/t149_width.ts -- --width 1 --arm $arm --iter 20 --out results/t149_width/w1.jsonl
done
for arm in SHIPPED SINGLE:ice_spear; do
  echo "=== ymir $arm $(date)"
  npx vite-node scratch/t149_width.ts -- --width 1 --owner ymir_v1 --arm $arm --iter 20 --out results/t149_width/w1_ymir.jsonl
done
echo "=== done $(date)"
