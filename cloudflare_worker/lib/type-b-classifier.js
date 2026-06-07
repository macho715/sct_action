// HVDC SCT Ontology — TYPE-B classifier
// Phase 2 (v2.1.0): Customs Inspection override priority
//
// Purpose:
// - classifyTypeB(description): charge description → TYPE-B with priority rules
// - crosswalkSctToTypeB(sctCode): SCT code → TYPE-B crosswalk
//
// Priority order (highest to lowest):
//   1. OVERRIDE          — Customs Inspection keywords always beat generic Customs
//   2. FALLBACK_KEYWORD  — Bill of Entry Fee (BOE_FEE), Customs Clearance, DO, THC, INLAND, etc.
//   3. (no match)        — return null (caller decides OTHERS default)
//
// FR-008 to FR-010: Customs Inspection override, generic Customs preservation
// SC-006, SC-007, SC-015: TC-OVR-001, TC-OVR-002, no regression

export const RULE_OVERRIDE = "OVERRIDE";
export const RULE_FALLBACK_KEYWORD = "FALLBACK_KEYWORD";

// Classify a charge description into a TYPE-B with rule traceability.
// Returns:
//   { type_b, sct_code, sct_class, confidence, rule_source, canonical_label, reviewer_action }
// or null when no rule matches.
export function classifyTypeB(description) {
  const normalized = String(description ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  // 1️⃣ OVERRIDE (highest priority) — Customs Inspection beats generic Customs
  //    Pattern: "CUSTOMS INSPECTION", "CUSTOMS INSPECTION FEE", "INSPECTION FEE"
  if (/CUSTOMS?\s*INSPECTION|INSPECTION\s*FEE/.test(normalized)) {
    return {
      type_b: "Inspection",
      sct_code: "SCT.CHARGE.CUSTOMS_INSPECTION",
      sct_class: "ChargeType",
      confidence: 0.95,
      rule_source: RULE_OVERRIDE,
      canonical_label: "Customs Inspection Fee",
      reviewer_action: "Verify inspection approval document (SCT.DOC.APPROVAL) and broker/customs invoice. BOE remark required when applicable.",
    };
  }

  // 2️⃣ FALLBACK_KEYWORD — Bill of Entry Fee (separate code from CUSTOMS_CLEARANCE per D-03)
  //    Pattern: "BILL OF ENTRY", "BILL OF ENTRY FEE", "BOE FEE"
  if (/BILL\s*OF\s*ENTRY|BOE\s*FEE/.test(normalized)) {
    return {
      type_b: "Customs",
      sct_code: "SCT.CHARGE.BOE_FEE",
      sct_class: "ChargeType",
      confidence: 0.92,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Bill of Entry Fee",
      reviewer_action: "Cross-check BOE number, issue date, consignee, HS code, and amount if applicable.",
    };
  }

  // 3️⃣ FALLBACK_KEYWORD — Customs Clearance / Duty
  //    Pattern: "CUSTOMS CLEARANCE", "CUSTOMS DUTY", "CUSTOMS" alone
  if (/CUSTOMS?\s*CLEARANCE|CUSTOMS?\s*DUTY|CUSTOMS/.test(normalized)) {
    return {
      type_b: "Customs",
      sct_code: "SCT.CHARGE.CUSTOMS_CLEARANCE",
      sct_class: "ChargeType",
      confidence: 0.98,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Customs Clearance Fee",
      reviewer_action: "Check BOE and customs clearance approval evidence.",
    };
  }

  // 4️⃣ FALLBACK_KEYWORD — Delivery Order
  //    Pattern: "MASTER DO", "DELIVERY ORDER", "DO" alone, " DO FEE" suffix
  if (/MASTER\s*DO|DELIVERY\s*ORDER|^\s*DO\s*$|\sDO\sFEE/.test(normalized)) {
    return {
      type_b: "DO",
      sct_code: "SCT.CHARGE.MASTER_DO",
      sct_class: "ChargeType",
      confidence: 0.94,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Master Delivery Order Fee",
      reviewer_action: "Check DO document and invoice approval evidence.",
    };
  }

  // 5️⃣ FALLBACK_KEYWORD — Terminal Handling Charge
  //    Pattern: "THC", "TERMINAL HANDLING"
  if (/THC|TERMINAL\s*HANDLING/.test(normalized)) {
    return {
      type_b: "THC",
      sct_code: "SCT.CHARGE.THC",
      sct_class: "ChargeType",
      confidence: 0.95,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Terminal Handling Charge",
      reviewer_action: "Check terminal invoice or port tariff evidence.",
    };
  }

  // 6️⃣ FALLBACK_KEYWORD — Inland Transport
  //    Pattern: "INLAND", "TRUCK", "TRANSPORT", "DELIVERY"
  if (/INLAND|TRUCK|TRANSPORT|DELIVERY/.test(normalized)) {
    return {
      type_b: "INLAND",
      sct_code: "SCT.CHARGE.INLAND_TRANSPORT",
      sct_class: "ChargeType",
      confidence: 0.90,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Inland Transport Charge",
      reviewer_action: "Check lane map, POD, trip evidence, and approved rate basis.",
    };
  }

  // 7️⃣ FALLBACK_KEYWORD — Detention / Demurrage
  //    Pattern: "DETENTION", "DEMURRAGE", "DEM/DET", "DET"
  if (/DETENTION|DEMURRAGE|DEM\s*\/\s*DET|DET/.test(normalized)) {
    return {
      type_b: "Detention",
      sct_code: "SCT.CHARGE.DETENTION",
      sct_class: "ChargeType",
      confidence: 0.90,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Detention/Demurrage Charge",
      reviewer_action: "Check free time, container event dates, carrier invoice, and approval.",
    };
  }

  // 8️⃣ FALLBACK_KEYWORD — Storage
  //    Pattern: "STORAGE", "STROAGE", "WAREHOUSE"
  if (/STORAGE|STROAGE|WAREHOUSE/.test(normalized)) {
    return {
      type_b: "STROAGE",
      sct_code: "SCT.CHARGE.STORAGE",
      sct_class: "ChargeType",
      confidence: 0.90,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Storage Charge",
      reviewer_action: "Check storage period, warehouse evidence, and approved rate basis.",
    };
  }

  // 9️⃣ FALLBACK_KEYWORD — Bill of Lading (document, not charge)
  //    Pattern: "BL" alone, "HBL", "MBL", "BILL OF LADING"
  if (/^BL$|\sHBL\s|\sMBL\s|BILL\s*OF\s*LADING/.test(normalized)) {
    return {
      type_b: "OTHERS",
      sct_code: "SCT.DOC.BL",
      sct_class: "DocumentType",
      confidence: 0.95,
      rule_source: RULE_FALLBACK_KEYWORD,
      canonical_label: "Bill of Lading",
      reviewer_action: "Match BL with CI/PL, BOE, and shipment reference.",
    };
  }

  // No match
  return null;
}

// Crosswalk an SCT code to TYPE-B.
// Returns TYPE_B string or null when no crosswalk exists.
export function crosswalkSctToTypeB(sctCode) {
  if (sctCode == null) return null;
  const code = String(sctCode).trim().toUpperCase();
  if (!code) return null;

  if (code.includes("CUSTOMS") || code.includes("BOE")) return "Customs";
  if (code.includes("MASTER_DO") || code.endsWith(".DO")) return "DO";
  if (code.includes("INLAND") || code.includes("POD")) return "INLAND";
  if (code.includes("THC")) return "THC";
  if (code.includes("INSPECTION")) return "Inspection";
  if (code.includes("DETENTION") || code.includes("DEM")) return "Detention";
  if (code.includes("STORAGE") || code.includes("STROAGE")) return "STROAGE";
  return null;
}
