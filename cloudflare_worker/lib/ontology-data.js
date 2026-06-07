// HVDC SCT Ontology — Static data dictionaries
// Phase 1 (v2.0.0): DocumentType + RateBasis ontology nodes
//
// Purpose:
// - Hold immutable ontology seed data (no mutation, no I/O).
// - Provide lookup tables for resolveDocumentType() and resolveRateBasis().
// - Read-only, dry-run, no secrets, no rate disclosure.
//
// Reference:
// - SPEC §FR-001 to FR-007 (DocumentType + RateBasis functional requirements)
// - Design doc §5 (data model)

const RAW = {
  // DocumentType — ontology class for documents (BOE, CI/PL, POD, etc.)
  DOC_TYPE: {
    BOE: {
      code: "SCT.DOC.BOE",
      label: "Bill of Entry",
      sct_class: "DocumentType",
      synonyms: ["BOE", "Bill of Entry", "BILL OF ENTRY", "Customs Declaration"],
      confidence: 0.92,
    },
    CI_PL: {
      code: "SCT.DOC.CI_PL",
      label: "Commercial Invoice & Packing List",
      sct_class: "DocumentType",
      synonyms: ["CI/PL", "CIPL", "Invoice and Packing List", "INVOICE AND PACKING LIST"],
      confidence: 0.90,
    },
    POD: {
      code: "SCT.DOC.POD",
      label: "Proof of Delivery",
      sct_class: "DocumentType",
      synonyms: ["POD", "Proof of Delivery", "PROOF OF DELIVERY", "delivery proof", "DELIVERY PROOF"],
      confidence: 0.88,
    },
    DO: {
      code: "SCT.DOC.DO",
      label: "Delivery Order",
      sct_class: "DocumentType",
      synonyms: ["DO", "Delivery Order", "DELIVERY ORDER"],
      confidence: 0.90,
    },
    STORAGE_INVOICE: {
      code: "SCT.DOC.STORAGE_INVOICE",
      label: "Storage Invoice",
      sct_class: "DocumentType",
      synonyms: ["storage invoice", "STORAGE INVOICE", "warehouse invoice", "WAREHOUSE INVOICE"],
      confidence: 0.85,
    },
    TERMINAL_INVOICE: {
      code: "SCT.DOC.TERMINAL_INVOICE",
      label: "Terminal Invoice",
      sct_class: "DocumentType",
      synonyms: ["terminal invoice", "TERMINAL INVOICE"],
      confidence: 0.85,
    },
    APPROVAL: {
      code: "SCT.DOC.APPROVAL",
      label: "Approval Evidence",
      sct_class: "DocumentType",
      synonyms: ["approval", "APPROVAL", "client approval", "CLIENT APPROVAL", "offer approval", "OFFER APPROVAL"],
      confidence: 0.85,
    },
    VENDOR_INVOICE: {
      code: "SCT.DOC.VENDOR_INVOICE",
      label: "Vendor or Broker Invoice",
      sct_class: "DocumentType",
      synonyms: ["vendor invoice", "VENDOR INVOICE", "broker invoice", "BROKER INVOICE"],
      confidence: 0.87,
    },
  },

  // RateBasis — ontology class for rate source (AT COST, AS PER OFFER, etc.)
  RATE_BASIS: {
    AT_COST: {
      code: "SCT.RATE.AT_COST",
      label: "At Cost",
      sct_class: "RateBasis",
      synonyms: ["AT COST", "at cost", "at actuals", "AT ACTUALS", "as per actuals", "AS PER ACTUALS"],
      confidence: 0.90,
    },
    AS_PER_OFFER: {
      code: "SCT.RATE.AS_PER_OFFER",
      label: "As Per Offer",
      sct_class: "RateBasis",
      synonyms: ["AS PER OFFER", "as per offer", "per offer", "PER OFFER"],
      confidence: 0.88,
    },
    TARIFF: {
      code: "SCT.RATE.TARIFF",
      label: "Tariff",
      sct_class: "RateBasis",
      synonyms: ["TARIFF", "tariff", "tariff rate", "TARIFF RATE"],
      confidence: 0.85,
    },
    CONTRACT_NUMERIC: {
      code: "SCT.RATE.CONTRACT_NUMERIC",
      label: "Contract Numeric",
      sct_class: "RateBasis",
      synonyms: ["contract rate", "CONTRACT RATE", "contract numeric", "CONTRACT NUMERIC"],
      confidence: 0.85,
    },
    MISSING: {
      code: "SCT.RATE.MISSING",
      label: "Rate Basis Missing",
      sct_class: "RateBasis",
      synonyms: [],
      confidence: 1.0,
    },
    CONFLICT: {
      code: "SCT.RATE.CONFLICT",
      label: "Rate Basis Conflict",
      sct_class: "RateBasis",
      synonyms: [],
      confidence: 1.0,
    },
  },

  // CHARGE_TYPE — TYPE-B tie-out reference (used by Phase 2 classifier)
  CHARGE_TYPE: {
    CUSTOMS_INSPECTION: {
      code: "SCT.CHARGE.CUSTOMS_INSPECTION",
      label: "Customs Inspection",
      sct_class: "ChargeType",
      type_b: "Inspection",
      priority: 1,
    },
    CUSTOMS_CLEARANCE: {
      code: "SCT.CHARGE.CUSTOMS_CLEARANCE",
      label: "Customs Clearance",
      sct_class: "ChargeType",
      type_b: "Customs",
      priority: 10,
    },
    BOE_FEE: {
      code: "SCT.CHARGE.BOE_FEE",
      label: "Bill of Entry Fee",
      sct_class: "ChargeType",
      type_b: "Customs",
      priority: 10,
    },
    DO: {
      code: "SCT.CHARGE.DO",
      label: "Delivery Order",
      sct_class: "ChargeType",
      type_b: "DO",
      priority: 10,
    },
    THC: {
      code: "SCT.CHARGE.THC",
      label: "Terminal Handling Charge",
      sct_class: "ChargeType",
      type_b: "THC",
      priority: 10,
    },
    INLAND: {
      code: "SCT.CHARGE.INLAND",
      label: "Inland Transport",
      sct_class: "ChargeType",
      type_b: "INLAND",
      priority: 10,
    },
    DETENTION: {
      code: "SCT.CHARGE.DETENTION",
      label: "Detention",
      sct_class: "ChargeType",
      type_b: "Detention",
      priority: 10,
    },
    STROAGE: {
      code: "SCT.CHARGE.STROAGE",
      label: "Storage",
      sct_class: "ChargeType",
      type_b: "STROAGE",
      priority: 10,
    },
    OTHERS: {
      code: "SCT.CHARGE.OTHERS",
      label: "Others",
      sct_class: "ChargeType",
      type_b: "OTHERS",
      priority: 99,
    },
  },
};

export const DOC_TYPE = Object.freeze(RAW.DOC_TYPE);
export const RATE_BASIS = Object.freeze(RAW.RATE_BASIS);
export const CHARGE_TYPE = Object.freeze(RAW.CHARGE_TYPE);
