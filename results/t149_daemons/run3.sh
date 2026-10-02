#!/bin/bash
cd /tmp/mm2
run() { echo "=== $1 vs $2 $(date)"; npx vite-node scratch/t149_daemon_procs.ts -- --width 3 --comp $1 --opps $2 --iter 5 --out results/t149_daemons/w3.jsonl; }
run zoo fire_pair
run control ref_solo_a
run zoo ink_loop
run control fire_pair
run zoo control
echo "=== done $(date)"
