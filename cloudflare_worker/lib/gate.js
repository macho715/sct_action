// HVDC SCT Ontology — Gate Check (Phase 4, v2.3.0)
//
// Purpose:
// - checkGate(input): invoice-audit / cost-guard final validation
//   Returns PASS / AMBER / ZERO with per-gate status and pass_allowed flag.
//
// Gate semantics (per design §8, FR-015 to FR-019, SC-009 to SC-013):
//   - final_subtotal    MISSING or CONFLICT → ZERO
//   - rate_basis        MISSING or CONFLICT (invoice-audit/cost-guard) → ZERO
//   - evidence_status   CONFLICT → ZERO, MISSING/PARTIAL/NOT_CHECKED → AMBER
//   - evidence_gaps     Any categorical gap flag → ZERO (gate blocker)
//   - type_b_tie_out    BROKEN → ZERO, PARTIAL → AMBER, TIED → no demote
//
// Evidence gap flags (categorical, any single flag blocks final PASS):
//   HS_UAE_CODE_MISSING         — HS code / UAE customs code not cross-referenced
//   EVIDENCE_GAP_DEM_DET        — demurrage/detention events incomplete
//   OOG_STOWAGE_NOTES_MISSING   — out-of-gauge stowage notes absent
//   FINAL_RECON_NOT_DONE        — final reconciliation not completed
//   APPROVAL_NOT_LINKED         — approval evidence not linked to invoice line
//
// Verdict ranking (highest to lowest): ZERO > FAIL > AMBER > PASS WITH WARNINGS > PASS
// pass_allowed = true ⇔ gate_result === 'PASS'

export const RESULT_PASS = "PASS";
export const RESULT_PASS_WITH_WARNINGS = "PASS WITH WARNINGS";
export const RESULT_AMBER = "AMBER";
export const RESULT_FAIL = "FAIL";
export const RESULT_ZERO = "ZERO";

export const RULE_GATE_CHECK = "GATE_CHECK";

const VERDICT_RANK = Object.freeze({
  PASS: 0,
  "PASS WITH WARNINGS": 1,
  AMBER: 2,
  FAIL: 3,
  ZERO: 4,
});

// Categorical evidence-gap flags that always block final PASS.
// Any single flag escalates the verdict to ZERO and lists the gate as blocking.
const BLOCKING_GAP_FLAGS = Object.freeze([
  "HS_UAE_CODE_MISSING",
  "EVIDENCE_GAP_DEM_DET",
  "OOG_STOWAGE_NOTES_MISSING",
  "FINAL_RECON_NOT_DONE",
  "APPROVAL_NOT_LINKED",
]);

function maxVerdict(a, b) {
  return VERDICT_RANK[b] > VERDICT_RANK[a] ? b : a;
}

function normalizeStatus(s) {
  return String(s ?? "").trim().toUpperCase();
}

function normalizeGapList(gaps) {
  if (!Array.isArray(gaps)) return [];
  return gaps
    .map((g) => normalizeStatus(g))
    .filter((g) => BLOCKING_GAP_FLAGS.includes(g));
}

function evaluateSubtotalGate(subtotal) {
  const status = normalizeStatus(subtotal?.status);
  if (status === "CONFLICT") {
    return { gate: "final_subtotal", status: "CONFLICT", note: "Final subtotal before VAT conflicts with source documents.", verdict: RESULT_ZERO, blocking: true };
  }
  if (status === "MISSING" || status === "") {
    return { gate: "final_subtotal", status: "MISSING", note: "Final subtotal before VAT is missing. Final PASS is blocked.", verdict: RESULT_ZERO, blocking: true };
  }
  return { gate: "final_subtotal", status, note: "Final subtotal before VAT validated.", verdict: RESULT_PASS, blocking: false };
}

function evaluateRateBasisGate(rateBasis, moduleName) {
  const status = normalizeStatus(rateBasis?.status);
  const invoiceLikeModule = ["invoice-audit", "cost-guard"].includes(moduleName);

  if (status === "CONFLICT") {
    return { gate: "rate_basis", status: "CONFLICT", note: "Rate basis conflict detected. Do not approve.", verdict: RESULT_ZERO, blocking: true };
  }
  if (status === "MISSING" && invoiceLikeModule) {
    return { gate: "rate_basis", status: "MISSING", note: "Rate basis missing for invoice-audit/cost-guard. Final PASS is blocked.", verdict: RESULT_ZERO, blocking: true };
  }
  if (status === "MISSING") {
    return { gate: "rate_basis", status: "MISSING", note: "Rate basis missing. Reviewer action required.", verdict: RESULT_AMBER, blocking: false };
  }
  return { gate: "rate_basis", status: status || "NOT_CHECKED", note: "Rate basis dry-run check completed.", verdict: RESULT_PASS, blocking: false };
}

function evaluateEvidenceGate(evidenceStatus) {
  const list = Array.isArray(evidenceStatus) ? evidenceStatus : [];
  const statuses = list.map((x) => normalizeStatus(x?.status));

  if (statuses.includes("CONFLICT")) {
    return { gate: "evidence_status", status: "CONFLICT", note: "Evidence conflict found. Human review required.", verdict: RESULT_ZERO, blocking: true };
  }
  if (statuses.includes("MISSING")) {
    return { gate: "evidence_status", status: "MISSING", note: "Required evidence is missing.", verdict: RESULT_AMBER, blocking: false };
  }
  if (statuses.length === 0 || statuses.every((s) => ["PARTIAL", "NOT_APPLICABLE", "NOT_CHECKED", ""].includes(s))) {
    return { gate: "evidence_status", status: "PARTIAL_OR_NOT_CHECKED", note: "Evidence is partial or not checked.", verdict: RESULT_AMBER, blocking: false };
  }
  return { gate: "evidence_status", status: "MATCHED", note: "Evidence status indicates matched support.", verdict: RESULT_PASS, blocking: false };
}

function evaluateEvidenceGapsGate(rawGaps) {
  const gaps = normalizeGapList(rawGaps);
  if (gaps.length === 0) {
    return { gate: "evidence_gaps", status: "NONE", note: "No categorical evidence gaps flagged.", verdict: RESULT_PASS, blocking: false, gaps: [] };
  }
  return {
    gate: "evidence_gaps",
    status: "BLOCKING",
    note: `Categorical evidence gaps detected: ${gaps.join(", ")}. Final PASS is blocked.`,
    verdict: RESULT_ZERO,
    blocking: true,
    gaps,
  };
}

function evaluateTypeBTieOutGate(tieOut) {
  const status = normalizeStatus(tieOut?.status);
  if (status === "BROKEN") {
    return { gate: "type_b_tie_out", status: "BROKEN", note: "TYPE-B classifier tie-out broken. Re-classify before approval.", verdict: RESULT_ZERO, blocking: true };
  }
  if (status === "PARTIAL") {
    return { gate: "type_b_tie_out", status: "PARTIAL", note: "TYPE-B tie-out partial. Review classification confidence.", verdict: RESULT_AMBER, blocking: false };
  }
  if (status === "TIED") {
    return { gate: "type_b_tie_out", status: "TIED", note: "TYPE-B classifier tie-out matches expected TYPE-B.", verdict: RESULT_PASS, blocking: false };
  }
  // NOT_CHECKED / empty — only demote to AMBER for invoice-like modules.
  return { gate: "type_b_tie_out", status: status || "NOT_CHECKED", note: "TYPE-B tie-out not verified.", verdict: RESULT_AMBER, blocking: false };
}

function reviewerActionFor(gates, blocking) {
  if (blocking.length === 0) {
    return "All gates pass. Final review can proceed.";
  }
  const [first] = blocking;
  const gate = gates.find((g) => g.gate === first);
  return gate?.note
    ? `Final PASS blocked by ${first}. ${gate.note}`
    : `Final PASS blocked by: ${blocking.join(", ")}.`;
}

function requiredInputsFor(verdict, moduleName) {
  if (verdict === RESULT_ZERO) {
    return ["Contract/rate basis source", "Final approver decision", "Evidence document reference"];
  }
  if (moduleName === "invoice-audit" || moduleName === "cost-guard") {
    return ["Final invoice subtotal before VAT", "BOE/DO/BL/POD evidence", "Contract/rate basis source"];
  }
  return ["Valid SCT code", "Evidence status", "Module context"];
}

// checkGate — main entry point.
//
// Accepts BOTH the legacy flat shape (rate_basis_status, final_subtotal_status
// strings) and the new structured shape (subtotal {status,...}, rate_basis
// {status,source}, evidence_gaps [], type_b_tie_out {status,confidence_min}).
// The structured shape takes precedence when both are supplied.
export function checkGate(input) {
  if (!isPlainObject(input)) {
    throw new Error("checkGate(input): input must be an object.");
  }

  const moduleName = input.module || input.context?.module || "invoice-audit";
  const evidenceStatus = Array.isArray(input.evidence_status) ? input.evidence_status : [];

  // Subtotal: prefer structured `subtotal.status`, fall back to legacy `final_subtotal_status`.
  const subtotalInput = isPlainObject(input.subtotal)
    ? input.subtotal
    : { status: input.final_subtotal_status ?? null };

  // Rate basis: prefer structured `rate_basis.status`, fall back to legacy `rate_basis_status`.
  const rateBasisInput = isPlainObject(input.rate_basis)
    ? input.rate_basis
    : { status: input.rate_basis_status ?? null };

  // Evidence gaps: accept array of strings (categorical flags) or array of
  // {flag, status} objects. Only known flags contribute to blocking.
  const evidenceGaps = input.evidence_gaps;

  // TYPE-B tie-out: optional.
  const typeBTieOut = isPlainObject(input.type_b_tie_out) ? input.type_b_tie_out : null;

  const subtotalGate = evaluateSubtotalGate(subtotalInput);
  const rateBasisGate = evaluateRateBasisGate(rateBasisInput, moduleName);
  const evidenceGate = evaluateEvidenceGate(evidenceStatus);
  const gapsGate = evaluateEvidenceGapsGate(evidenceGaps);
  const typeBGate = typeBTieOut ? evaluateTypeBTieOutGate(typeBTieOut) : null;

  const gates = typeBGate
    ? [subtotalGate, rateBasisGate, evidenceGate, gapsGate, typeBGate]
    : [subtotalGate, rateBasisGate, evidenceGate, gapsGate];

  // Final verdict: MAX of all gate verdicts.
  let verdict = RESULT_PASS;
  for (const g of gates) {
    verdict = maxVerdict(verdict, g.verdict);
  }

  // PASS WITH WARNINGS — only if verdict stays PASS but some gate is NOT_CHECKED.
  if (verdict === RESULT_PASS) {
    const hasUnchecked = gates.some((g) => normalizeStatus(g.status).includes("NOT_CHECKED"));
    if (hasUnchecked) verdict = RESULT_PASS_WITH_WARNINGS;
  }

  const blocking = gates.filter((g) => g.blocking).map((g) => g.gate);

  return {
    gate_result: verdict,
    pass_allowed: verdict === RESULT_PASS,
    gates: gates.map((g) => ({
      gate: g.gate,
      status: g.status,
      note: g.note,
      ...(g.gaps ? { gaps: g.gaps } : {}),
      ...(g.blocking ? { blocking: true } : {}),
    })),
    blocking,
    reviewer_action: reviewerActionFor(gates, blocking),
    required_inputs_max_3: requiredInputsFor(verdict, moduleName),
    rule_source: RULE_GATE_CHECK,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export const BLOCKING_EVIDENCE_GAP_FLAGS = BLOCKING_GAP_FLAGS.slice();
