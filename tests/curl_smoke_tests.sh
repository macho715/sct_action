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
echo "8a) Golden TC-EVM-001: CUSTOMS_CLEARANCE + full evidence → MATCHED_EXACT"
response=$(curl -sS -X POST "$BASE_URL/ontology/evidence-map" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/evidence-customs.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.evidence_validation[0].evidence_status // empty')
assert_golden_tc "TC-EVM-001" "MATCHED_EXACT" "$actual"

echo
echo "8b) Golden TC-EVM-002: CUSTOMS_INSPECTION + partial evidence → PARTIAL"
response=$(curl -sS -X POST "$BASE_URL/ontology/evidence-map" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/evidence-inspection.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.evidence_validation[0].evidence_status // empty')
assert_golden_tc "TC-EVM-002" "PARTIAL" "$actual"

echo
echo "8c) Golden TC-EVM-003: AT_COST + full evidence → MATCHED_EXACT"
response=$(curl -sS -X POST "$BASE_URL/ontology/evidence-map" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/evidence-at-cost.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.evidence_validation[0].evidence_status // empty')
assert_golden_tc "TC-EVM-003" "MATCHED_EXACT" "$actual"

echo
echo "8d) Golden TC-EVM-004: AS_PER_OFFER + missing client approval → PARTIAL"
response=$(curl -sS -X POST "$BASE_URL/ontology/evidence-map" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/evidence-as-per-offer.payload.json)
echo "$response" | jq .
actual=$(echo "$response" | jq -r '.evidence_validation[0].evidence_status // empty')
assert_golden_tc "TC-EVM-004" "PARTIAL" "$actual"

echo
echo "9) checkSctOntologyGate"
curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-check.payload.json | jq .

echo
echo "9a) Golden TC-GATE-001: missing final subtotal → ZERO, pass_allowed=false"
response=$(curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-missing-subtotal.payload.json)
echo "$response" | jq .
actual_gate=$(echo "$response" | jq -r '.gate_result // empty')
actual_pass=$(echo "$response" | jq -r '.pass_allowed // empty')
assert_golden_tc "TC-GATE-001 gate_result" "ZERO" "$actual_gate"
assert_golden_tc "TC-GATE-001 pass_allowed" "false" "$actual_pass"

echo
echo "9b) Golden TC-GATE-002: rate basis CONFLICT → ZERO"
response=$(curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-rate-basis-conflict.payload.json)
echo "$response" | jq .
actual_gate=$(echo "$response" | jq -r '.gate_result // empty')
assert_golden_tc "TC-GATE-002 gate_result" "ZERO" "$actual_gate"

echo
echo "9c) Golden TC-GATE-003: DEM/DET evidence gap → ZERO"
response=$(curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-evidence-gap-dem-det.payload.json)
echo "$response" | jq .
actual_gate=$(echo "$response" | jq -r '.gate_result // empty')
assert_golden_tc "TC-GATE-003 gate_result" "ZERO" "$actual_gate"

echo
echo "9d) Golden TC-GATE-004: happy path (full match) → PASS, pass_allowed=true"
response=$(curl -sS -X POST "$BASE_URL/ontology/gate-check" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/gate-pass.payload.json)
echo "$response" | jq .
actual_gate=$(echo "$response" | jq -r '.gate_result // empty')
actual_pass=$(echo "$response" | jq -r '.pass_allowed // empty')
assert_golden_tc "TC-GATE-004 gate_result" "PASS" "$actual_gate"
assert_golden_tc "TC-GATE-004 pass_allowed" "true" "$actual_pass"

echo
echo "10) dryRunClassifyTypeB"
curl -sS -X POST "$BASE_URL/dry-run/type-b-classify" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/type-b-classify.payload.json | jq .

echo
echo "10a) Golden TC-OVR-001: CUSTOMS INSPECTION FEE → TYPE-B Inspection (OVERRIDE)"
response=$(curl -sS -X POST "$BASE_URL/dry-run/type-b-classify" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/classify-inspection-fee.payload.json)
echo "$response" | jq .
actual_type_b=$(echo "$response" | jq -r '.classifications[0].type_b // empty')
actual_sct=$(echo "$response" | jq -r '.classifications[0].sct_code // empty')
actual_rule=$(echo "$response" | jq -r '.classifications[0].type_b_rule_source // empty')
assert_golden_tc "TC-OVR-001 type_b" "Inspection" "$actual_type_b"
assert_golden_tc "TC-OVR-001 sct_code" "SCT.CHARGE.CUSTOMS_INSPECTION" "$actual_sct"
assert_golden_tc "TC-OVR-001 rule_source" "OVERRIDE" "$actual_rule"

echo
echo "10b) Golden TC-OVR-002: BILL OF ENTRY FEE → TYPE-B Customs + SCT.CHARGE.BOE_FEE"
response=$(curl -sS -X POST "$BASE_URL/dry-run/type-b-classify" \
  -H "Content-Type: application/json" \
  "${auth_args[@]}" \
  --data @tests/classify-boe-fee.payload.json)
echo "$response" | jq .
actual_type_b=$(echo "$response" | jq -r '.classifications[0].type_b // empty')
actual_sct=$(echo "$response" | jq -r '.classifications[0].sct_code // empty')
actual_rule=$(echo "$response" | jq -r '.classifications[0].type_b_rule_source // empty')
assert_golden_tc "TC-OVR-002 type_b" "Customs" "$actual_type_b"
assert_golden_tc "TC-OVR-002 sct_code" "SCT.CHARGE.BOE_FEE" "$actual_sct"
assert_golden_tc "TC-OVR-002 rule_source" "FALLBACK_KEYWORD" "$actual_rule"

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
echo "Phase 1 + 2 + 3 + 4 smoke tests complete. (15 Golden TC assertions + 10 routes)"
