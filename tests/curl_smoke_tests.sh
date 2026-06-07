#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://hvdc-ontology-chatgpt-app.mscho715.workers.dev}"
API_KEY="${SCT_ACTION_API_KEY:-}"

auth_args=()
if [ -n "$API_KEY" ]; then
  auth_args=(-H "X-API-Key: $API_KEY")
fi

echo "1) Health"
curl -sS "$BASE_URL/health" | jq .

echo "2) resolveSctOntologyTerm"
curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve.payload.json | jq .

echo "3) mapRequiredEvidence"
curl -sS -X POST "$BASE_URL/ontology/evidence-map" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/evidence-map.payload.json | jq .

echo "4) checkSctOntologyGate"
curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-check.payload.json | jq .

echo "5) dryRunClassifyTypeB"
curl -sS -X POST "$BASE_URL/dry-run/type-b-classify" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/type-b-classify.payload.json | jq .
