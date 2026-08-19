#!/bin/bash
# Ticket 99: the decision census across all 32 decks, two at a time (this box has 2 cores).
cd /root/mm
DECKS=$(node -e "
const {MingmingRegistry:R}=require('/root/mm/node_modules/.bin/../../src/engine/data/mingmingRegistry.ts');
" 2>/dev/null)
: > /tmp/dd_all.csv
for d in "$@"; do
  DECK=$d ITER=4 OPPONENTS=8 timeout 900 npx tsx scratch/decisions.ts 2>&1 | grep "^CSV," >> /tmp/dd_all.csv &
  while [ "$(jobs -r | wc -l)" -ge 2 ]; do sleep 5; done
done
wait
echo DD-COMPLETE
