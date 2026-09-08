#!/bin/bash
cd /tmp/mm2
for d in ratatoskr_v1 ratatoskr_v2 sleipnir_v1 kraken_v1 fenrir_v1; do
  echo "=== $d $(date)"
  npx vite-node scratch/t149_daemon_procs.ts -- --width 1 --owner $d --iter 20 --out results/t149_daemons/w1_$d.jsonl
done
echo "=== done $(date)"
