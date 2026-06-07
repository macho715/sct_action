#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://hvdc-ontology-chatgpt-app.mscho715.workers.dev}"
API_KEY="${SCT_ACTION_API_KEY:-}"

auth_args=()
if [ -n "$API_KEY" ]; then
  auth_args=(-H "X-API-Key: $API_KEY")
fi

assert_golden_tc() {
  local label="$1"
  local expected_code="$2"
  local actual_code="$3"
  if [ "$actual_code" = "$expected_code" ]; then
    echo "  ✓ ${label}: ${actual_code}"
  else
    echo "  ✗ ${label}: expected ${expected_code}, got ${actual_code}"
    return 1
  fi
}

echo "1) Health"
curl -sS "$BASE_URL/health" | jq .

echo
echo "2) resolveSctOntologyTerm (regression: HVDC/BAMF/CUSTOMS)"
curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve.payload.json | jq .

echo
echo "3) Golden TC-DOC-001: BOE → SCT.DOC.BOE"
response=$(curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve-boe.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.mappings[0].sct_code // empty')
assert_golden_tc "TC-DOC-001" "SCT.DOC.BOE" "$actual"

echo
echo "4) Golden TC-DOC-002: CI/PL → SCT.DOC.CI_PL"
response=$(curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve-cipl.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.mappings[0].sct_code // empty')
assert_golden_tc "TC-DOC-002" "SCT.DOC.CI_PL" "$actual"

echo
echo "5) Golden TC-DOC-003: POD → SCT.DOC.POD"
response=$(curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve-pod.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.mappings[0].sct_code // empty')
assert_golden_tc "TC-DOC-003" "SCT.DOC.POD" "$actual"

echo
echo "6) Golden TC-RATE-001: AT COST → SCT.RATE.AT_COST"
response=$(curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve-at-cost.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.mappings[0].sct_code // empty')
assert_golden_tc "TC-RATE-001" "SCT.RATE.AT_COST" "$actual"

echo
echo "7) Golden TC-RATE-002: AS PER OFFER → SCT.RATE.AS_PER_OFFER"
response=$(curl -sS -X POST "$BASE_URL/ontology/resolve" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/resolve-as-per-offer.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.mappings[0].sct_code // empty')
assert_golden_tc "TC-RATE-002" "SCT.RATE.AS_PER_OFFER" "$actual"

echo
echo "8) mapRequiredEvidence"
curl -sS -X POST "$BASE_URL/ontology/evidence-map" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/evidence-map.payload.json | jq .

echo
echo "9) checkSctOntologyGate"
curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-check.payload.json | jq .

echo
echo "10) dryRunClassifyTypeB"
curl -sS -X POST "$BASE_URL/dry-run/type-b-classify" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/type-b-classify.payload.json | jq .

echo
echo "11) dryRunRateLookup"
curl -sS -X POST "$BASE_URL/dry-run/rate-lookup" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/rate-lookup.payload.json | jq .

echo
echo "12) explainSctOntologyNode: SCT.DOC.BOE"
curl -sS -X POST "$BASE_URL/ontology/explain" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  -d '{"sct_code":"SCT.DOC.BOE"}' | jq .

echo
echo "13) dryRunValidateInvoicePack"
curl -sS -X POST "$BASE_URL/dry-run/validate" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  -d '{
    "lines": [
      {"sct_code":"SCT.CHARGE.CUSTOMS_CLEARANCE","evidence_status":"PARTIAL"},
      {"sct_code":"SCT.CHARGE.DO","evidence_status":"MATCHED_EXACT"}
    ],
    "rate_basis_status":"NOT_CHECKED",
    "final_subtotal_before_vat":12345.67
  }' | jq .

echo
echo "14) crosswalkSctToTypeB"
curl -sS -X POST "$BASE_URL/ontology/crosswalk" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  -d '{"sct_codes":["SCT.CHARGE.CUSTOMS_CLEARANCE","SCT.CHARGE.MASTER_DO"],"target":"TYPE_B"}' | jq .

echo
echo "15) createOntologyAuditTrace"
curl -sS -X POST "$BASE_URL/ontology/audit-trace" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  -d '{"request_id":"REQ-TEST","verdict":"AMBER","module":"invoice-audit"}' | jq .

echo
echo "Phase 1 smoke tests complete. (5 Golden TC assertions + 10 routes)"
