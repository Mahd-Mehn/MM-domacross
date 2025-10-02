#!/usr/bin/env bash
# Simple stress harness: simulate valuation batches & placeholder trade events.
# NOTE: Extend with real signed requests or WS interactions as integration matures.
set -euo pipefail
API_BASE=${API_BASE:-http://localhost:8000/api/v1}
DOMAINS=(alpha.one bravo.one charlie.one delta.one echo.one)
ITERATIONS=${ITERATIONS:-50}
SLEEP_MS=${SLEEP_MS:-150}

function valuation_batch() {
  local slice=(${DOMAINS[@]:0:3})
  curl -s -X POST "$API_BASE/valuation/batch" -H 'Content-Type: application/json' \
    -d "{\"domains\":[\"${slice[0]}\",\"${slice[1]}\",\"${slice[2]}\"]}" >/dev/null || true
}

echo "Starting stress run: iterations=$ITERATIONS sleep_ms=$SLEEP_MS"
start=$(date +%s%3N)
for ((i=1;i<=ITERATIONS;i++)); do
  valuation_batch &
  if (( i % 10 == 0 )); then
    echo "Iteration $i"
  fi
  perl -e 'select(undef,undef,undef,'"$SLEEP_MS"'/1000)'
  wait || true
done
end=$(date +%s%3N)
duration_ms=$((end-start))
echo "Completed in ${duration_ms}ms (avg per batch: $((duration_ms/ITERATIONS))ms)"
