// HVDC SCT Ontology — Evidence Map (Phase 3, v2.2.0)
//
// Purpose:
// - getEvidenceRequirements(sctCode): SCT code → required evidence list + status rules
// - validateEvidence(pack): provided evidence → MATCHED_EXACT / PARTIAL / MISSING
//
// Evidence rules per design §7 (FR-011 to FR-014):
//   Customs (CUSTOMS_CLEARANCE / BOE_FEE)  → BOE, broker invoice, CI/PL, customs approval
//   Inspection (CUSTOMS_INSPECTION)         → inspection approval, broker invoice, BOE remark
//   AT_COST (RATE.AT_COST)                  → vendor invoice, approval, amount match
//   AS_PER_OFFER (RATE.AS_PER_OFFER)        → offer approval, client approval, amount match
//   DO (CHARGE.MASTER_DO)                   → Delivery Order
//   THC (CHARGE.THC)                        → Terminal invoice / port tariff
//   INLAND (CHARGE.INLAND_TRANSPORT)        → POD + trip evidence
//   DETENTION / DEMURRAGE                   → free time + container events + carrier invoice
//   STORAGE / STROAGE                       → storage period + warehouse evidence
//   BL (DOC.BL)                             → BL with CI/PL, BOE, shipment reference
//
// Missing status rules (FR-011 to FR-014, SC-008):
//   - Customs / Inspection → PARTIAL or MISSING (no AMBER)
//   - AT_COST / AS_PER_OFFER → AMBER (incomplete but reviewable)
//   - DO / THC / INLAND / STORAGE / BL → MATCHED_EXACT on full match, otherwise AMBER
//   - DETENTION / DEMURRAGE → ZERO candidates (gate blocker)

const EVIDENCE_RULES = [
  {
    key: "INSPECTION",
    pattern: /CUSTOMS_INSPECTION|CHARGE\.INSPECTION|\bINSPECTION\b/,
    required_codes: [
      "SCT.DOC.APPROVAL",
      "SCT.DOC.VENDOR_INVOICE",
      "SCT.DOC.BOE_REMARK",
    ],
    human_readable: [
      "Inspection approval document",
      "Broker or customs invoice",
      "BOE remark (if applicable)",
    ],
    missing_status: "PARTIAL",
    reviewer_action: "Verify inspection approval before invoice approval; confirm BOE remark when required.",
  },
  {
    key: "CUSTOMS",
    pattern: /CUSTOMS|BOE_FEE|CHARGE\.BOE|CHARGE\.CUSTOMS_CLEARANCE/,
    required_codes: [
      "SCT.DOC.BOE",
      "SCT.DOC.VENDOR_INVOICE",
      "SCT.DOC.CI_PL",
      "SCT.DOC.APPROVAL",
    ],
    human_readable: [
      "Bill of Entry (BOE)",
      "Broker or vendor invoice",
      "CI/PL",
      "Customs clearance approval",
    ],
    missing_status: "PARTIAL",
    reviewer_action: "Cross-check BOE number, HS code, broker invoice amount, and customs approval.",
  },
  {
    key: "AT_COST",
    pattern: /RATE\.AT_COST|\bAT\s*COST\b/,
    required_codes: [
      "SCT.DOC.VENDOR_INVOICE",
      "SCT.DOC.APPROVAL",
      "AMOUNT_MATCH",
    ],
    human_readable: [
      "Vendor or broker invoice",
      "Approval evidence (AT COST)",
      "Line amount match with supporting invoice",
    ],
    missing_status: "AMBER",
    reviewer_action: "Verify AT COST is approved; cross-check invoice amount equals line amount (±0.01).",
  },
  {
    key: "AS_PER_OFFER",
    pattern: /RATE\.AS_PER_OFFER|AS\s*PER\s*OFFER/,
    required_codes: [
      "SCT.DOC.APPROVAL_OFFER",
      "SCT.DOC.APPROVAL_CLIENT",
      "AMOUNT_MATCH",
    ],
    human_readable: [
      "Offer approval",
      "Client approval",
      "Line amount match with approved offer",
    ],
    missing_status: "AMBER",
    reviewer_action: "Verify both offer and client approvals are present; line amount must match approved offer.",
  },
  {
    key: "DO",
    pattern: /MASTER_DO|CHARGE\.DO|\bDO\s*FEE|\bDELIVERY\s*ORDER\b/,
    required_codes: [
      "SCT.DOC.DO",
      "SCT.DOC.VENDOR_INVOICE",
    ],
    human_readable: [
      "Delivery Order (DO)",
      "DO fee support / invoice line reference",
    ],
    missing_status: "AMBER",
    reviewer_action: "Match DO with shipment reference, consignee, and DO fee invoice line.",
  },
  {
    key: "THC",
    pattern: /CHARGE\.THC|\bTHC\b|TERMINAL\s*HANDLING/,
    required_codes: [
      "SCT.DOC.TERMINAL_INVOICE",
      "AMOUNT_MATCH",
    ],
    human_readable: [
      "Terminal invoice or port tariff",
      "Line amount match with tariff",
    ],
    missing_status: "AMBER",
    reviewer_action: "Verify terminal invoice and confirm line amount matches the port tariff.",
  },
  {
    key: "INLAND",
    pattern: /INLAND_TRANSPORT|CHARGE\.INLAND|\bINLAND\b|\bTRUCK\b|\bTRANSPORT\b/,
    required_codes: [
      "SCT.DOC.POD",
      "SCT.DOC.APPROVAL",
    ],
    human_readable: [
      "POD / signed delivery note",
      "Approved lane map and rate basis",
    ],
    missing_status: "AMBER",
    reviewer_action: "Verify POD signature, lane map, and approved rate basis (AT COST / AS PER OFFER).",
  },
  {
    key: "DETENTION",
    pattern: /DETENTION|DEMURRAGE|\bDEM\b|\bDET\b/,
    required_codes: [
      "FREE_TIME",
      "CONTAINER_EVENTS",
      "SCT.DOC.VENDOR_INVOICE",
    ],
    human_readable: [
      "Free time basis",
      "Container event timeline",
      "Carrier or terminal invoice",
    ],
    missing_status: "ZERO",
    reviewer_action: "Verify free time, demurrage/detention events, and approval. Gate candidate (EVIDENCE_GAP_DEM_DET).",
  },
  {
    key: "STORAGE",
    pattern: /STORAGE|STROAGE|CHARGE\.STORAGE/,
    required_codes: [
      "SCT.DOC.STORAGE_INVOICE",
      "SCT.DOC.TERMINAL_INVOICE",
    ],
    human_readable: [
      "Storage period evidence",
      "Warehouse or terminal invoice",
    ],
    missing_status: "AMBER",
    reviewer_action: "Verify storage period, warehouse evidence, and approved rate basis.",
  },
  {
    key: "BL",
    pattern: /DOC\.BL|^BL$|BILL\s*OF\s*LADING/,
    required_codes: [
      "SCT.DOC.BL",
      "SCT.DOC.CI_PL",
    ],
    human_readable: [
      "Bill of Lading",
      "CI/PL match with BL",
    ],
    missing_status: "AMBER",
    reviewer_action: "Match BL with CI/PL, BOE, and shipment reference.",
  },
];

const DEFAULT_RULE = {
  key: "DEFAULT",
  pattern: null,
  required_codes: ["SCT.DOC.APPROVAL"],
  human_readable: [
    "Invoice line reference",
    "Supporting document",
    "Approval evidence",
  ],
  missing_status: "AMBER",
  reviewer_action: "General evidence check; verify approval and supporting documents.",
};

function findRule(sctCode) {
  const code = String(sctCode ?? "").toUpperCase();
  for (const rule of EVIDENCE_RULES) {
    if (rule.pattern && rule.pattern.test(code)) return rule;
  }
  return DEFAULT_RULE;
}

export function getEvidenceRequirements(sctCode) {
  const code = String(sctCode ?? "").toUpperCase();
  const rule = findRule(code);
  const required = rule.required_codes.slice();
  const readable = rule.human_readable.slice();
  return {
    sct_code: code,
    required_evidence: readable,
    required_evidence_codes: required,
    missing_status: rule.missing_status,
    max_required_inputs: Math.min(3, required.length),
    rule_source: rule.key,
    reviewer_action: rule.reviewer_action,
  };
}

export function validateEvidence(pack) {
  const sctCode = String(pack?.sct_code ?? "").toUpperCase();
  const provided = Array.isArray(pack?.provided_evidence) ? pack.provided_evidence : [];
  const providedUpper = provided.map((c) => String(c).toUpperCase());
  const req = getEvidenceRequirements(sctCode);

  const missing = req.required_evidence_codes.filter((c) => !providedUpper.includes(c));
  let evidenceStatus;
  if (missing.length === 0) evidenceStatus = "MATCHED_EXACT";
  else if (missing.length === req.required_evidence_codes.length) evidenceStatus = "MISSING";
  else evidenceStatus = "PARTIAL";

  return {
    sct_code: sctCode,
    evidence_status: evidenceStatus,
    missing_evidence: missing,
    required_count: req.required_evidence_codes.length,
    provided_count: providedUpper.length,
    missing_status: req.missing_status,
    rule_source: req.rule_source,
  };
}

export const EVIDENCE_RULE_KEYS = EVIDENCE_RULES.map((r) => r.key);
