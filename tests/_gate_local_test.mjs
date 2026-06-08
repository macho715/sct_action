// Local regression test for lib/gate.js — Phase 4 (v2.3.0)
//
// Runs without wrangler / Workers runtime. Pure ESM import of checkGate().
// Verifies gate_result, pass_allowed, blocking, and reviewer_action semantics.

import { checkGate, BLOCKING_EVIDENCE_GAP_FLAGS } from "../cloudflare_worker/lib/gate.js";

let pass = 0, fail = 0;

function expect(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}: ${JSON.stringify(actual)}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectContains(name, actual, expected) {
  const ok = Array.isArray(actual) && actual.includes(expected);
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}: [${actual.join(", ")}] contains ${expected}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}: expected to contain ${expected}, got [${(actual || []).join(", ")}]`);
  }
}

// ─── TC-GATE-001: missing final subtotal → ZERO, pass_allowed=false ───
{
  const r = checkGate({
    module: "invoice-audit",
    sct_codes: ["SCT.CHARGE.CUSTOMS_CLEARANCE", "SCT.CHARGE.MASTER_DO"],
    subtotal: { status: "MISSING", amount: null, currency: "USD" },
    rate_basis: { status: "MATCH", source: "CONTRACT_NUMERIC" },
    evidence_status: [
      { sct_code: "SCT.CHARGE.CUSTOMS_CLEARANCE", status: "MATCHED_EXACT" },
      { sct_code: "SCT.CHARGE.MASTER_DO", status: "MATCHED_EXACT" },
    ],
    evidence_gaps: [],
    type_b_tie_out: { status: "TIED", confidence_min: 0.90 },
  });
  expect("TC-GATE-001 gate_result", r.gate_result, "ZERO");
  expect("TC-GATE-001 pass_allowed", r.pass_allowed, false);
  expectContains("TC-GATE-001 blocking", r.blocking, "final_subtotal");
}

// ─── TC-GATE-002: rate basis CONFLICT → ZERO ───
{
  const r = checkGate({
    module: "invoice-audit",
    subtotal: { status: "MATCH", amount: 12345.67, currency: "USD" },
    rate_basis: { status: "CONFLICT", source: "AS_PER_OFFER" },
    evidence_status: [
      { sct_code: "SCT.CHARGE.CUSTOMS_CLEARANCE", status: "MATCHED_EXACT" },
    ],
    type_b_tie_out: { status: "TIED", confidence_min: 0.90 },
  });
  expect("TC-GATE-002 gate_result", r.gate_result, "ZERO");
  expectContains("TC-GATE-002 blocking", r.blocking, "rate_basis");
}

// ─── TC-GATE-003: rate basis MISSING in invoice-audit → ZERO ───
{
  const r = checkGate({
    module: "invoice-audit",
    subtotal: { status: "MATCH", amount: 100, currency: "USD" },
    rate_basis: { status: "MISSING" },
    evidence_status: [
      { sct_code: "SCT.CHARGE.MASTER_DO", status: "MATCHED_EXACT" },
    ],
    type_b_tie_out: { status: "TIED", confidence_min: 0.90 },
  });
  expect("TC-GATE-003 gate_result", r.gate_result, "ZERO");
  expectContains("TC-GATE-003 blocking", r.blocking, "rate_basis");
}

// ─── TC-GATE-004: rate basis MISSING in non-invoice module → AMBER (not zero) ───
{
  const r = checkGate({
    module: "ontology-explainer",
    subtotal: { status: "MATCH" },
    rate_basis: { status: "MISSING" },
    evidence_status: [],
  });
  expect("TC-GATE-004 gate_result (non-invoice MISSING → AMBER)", r.gate_result, "AMBER");
  expect("TC-GATE-004 pass_allowed (false on AMBER)", r.pass_allowed, false);
}

// ─── TC-GATE-005: categorical evidence gap (DEM/DET) → ZERO ───
{
  const r = checkGate({
    module: "invoice-audit",
    subtotal: { status: "MATCH", amount: 500, currency: "USD" },
    rate_basis: { status: "MATCH", source: "TARIFF" },
    evidence_status: [
      { sct_code: "SCT.CHARGE.DETENTION", status: "PARTIAL" },
    ],
    evidence_gaps: ["EVIDENCE_GAP_DEM_DET"],
    type_b_tie_out: { status: "TIED", confidence_min: 0.85 },
  });
  expect("TC-GATE-005 gate_result (DEM/DET gap → ZERO)", r.gate_result, "ZERO");
  expectContains("TC-GATE-005 blocking", r.blocking, "evidence_gaps");
}

// ─── TC-GATE-006: HS/UAE code missing → ZERO ───
{
  const r = checkGate({
    module: "invoice-audit",
    subtotal: { status: "MATCH" },
    rate_basis: { status: "MATCH" },
    evidence_status: [{ sct_code: "SCT.CHARGE.CUSTOMS_CLEARANCE", status: "MATCHED_EXACT" }],
    evidence_gaps: ["HS_UAE_CODE_MISSING"],
    type_b_tie_out: { status: "TIED" },
  });
  expect("TC-GATE-006 gate_result (HS/UAE gap → ZERO)", r.gate_result, "ZERO");
  expectContains("TC-GATE-006 blocking", r.blocking, "evidence_gaps");
}

// ─── TC-GATE-007: happy path → PASS, pass_allowed=true ───
{
  const r = checkGate({
    module: "invoice-audit",
    sct_codes: ["SCT.CHARGE.MASTER_DO"],
    subtotal: { status: "MATCH", amount: 250, currency: "USD" },
    rate_basis: { status: "MATCH", source: "CONTRACT_NUMERIC" },
    evidence_status: [{ sct_code: "SCT.CHARGE.MASTER_DO", status: "MATCHED_EXACT" }],
    evidence_gaps: [],
    type_b_tie_out: { status: "TIED", confidence_min: 0.95 },
  });
  expect("TC-GATE-007 gate_result (happy path → PASS)", r.gate_result, "PASS");
  expect("TC-GATE-007 pass_allowed (true on PASS)", r.pass_allowed, true);
  expect("TC-GATE-007 blocking (empty)", r.blocking, []);
}

// ─── TC-GATE-008: legacy flat input still works ───
{
  const r = checkGate({
    module: "invoice-audit",
    final_subtotal_status: "MISSING",
    rate_basis_status: "MATCH",
    evidence_status: [],
  });
  expect("TC-GATE-008 legacy flat subtotal MISSING → ZERO", r.gate_result, "ZERO");
}

// ─── TC-GATE-009: evidence PARTIAL → AMBER (not zero) ───
{
  const r = checkGate({
    module: "invoice-audit",
    subtotal: { status: "MATCH" },
    rate_basis: { status: "MATCH" },
    evidence_status: [{ sct_code: "SCT.CHARGE.CUSTOMS_INSPECTION", status: "PARTIAL" }],
    type_b_tie_out: { status: "TIED" },
  });
  expect("TC-GATE-009 PARTIAL evidence → AMBER", r.gate_result, "AMBER");
  expect("TC-GATE-009 pass_allowed (false on AMBER)", r.pass_allowed, false);
}

// ─── TC-GATE-010: TYPE-B tie-out BROKEN → ZERO ───
{
  const r = checkGate({
    module: "invoice-audit",
    subtotal: { status: "MATCH" },
    rate_basis: { status: "MATCH" },
    evidence_status: [{ sct_code: "SCT.CHARGE.CUSTOMS_CLEARANCE", status: "MATCHED_EXACT" }],
    type_b_tie_out: { status: "BROKEN" },
  });
  expect("TC-GATE-010 tie-out BROKEN → ZERO", r.gate_result, "ZERO");
  expectContains("TC-GATE-010 blocking", r.blocking, "type_b_tie_out");
}

// ─── Sanity check: blocking gap flags list ───
{
  expect("BLOCKING_EVIDENCE_GAP_FLAGS length", BLOCKING_EVIDENCE_GAP_FLAGS.length, 5);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
