#!/bin/bash
set -e
cd "$(dirname "$0")/.."
for arm in base a1 a2 b a1b a2b; do
  python3 scratch/row143.py $arm > /dev/null
  node scratch/rebaseline.mjs --only fenrir_v1 --lanes 2 --iter 30 --outdir results/t143_$arm 2>&1 \
    | grep fenrir_v1 | sed "s/^/[$arm] /"
done
python3 scratch/row143.py base > /dev/null
echo "SWEEP DONE"
