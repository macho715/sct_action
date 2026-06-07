// HVDC SCT Ontology — Resolution & explanation logic
// Phase 1 (v2.0.0): DocumentType + RateBasis matching
//
// Purpose:
// - resolveDocumentType(input): term → SCT.DOC.* mapping (FR-001 to FR-004)
// - resolveRateBasis(input): term → SCT.RATE.* mapping (FR-005 to FR-007)
// - explainOntologyNode(sctCode): node explanation without private data
//
// All functions are pure: no I/O, no mutation, no network.
// Read-only, dry-run, no rate disclosure.

import { DOC_TYPE, RATE_BASIS, CHARGE_TYPE } from "./ontology-data.js";

// Resolve term to a DocumentType ontology node.
// Returns DOC_TYPE entry or null.
// Match rule: case-insensitive exact match against synonyms (normalized = synonym).
// This is intentionally strict to avoid misclassifying multi-word charge descriptions
// like "BILL OF ENTRY FEE" as a document (those remain in charge classifier).
export function resolveDocumentType(input) {
  if (input == null) return null;
  const normalized = String(input).trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) return null;

  for (const key of Object.keys(DOC_TYPE)) {
    const entry = DOC_TYPE[key];
    if (entry.synonyms.some((syn) => syn.toUpperCase() === normalized)) {
      return entry;
    }
  }
  return null;
}

// Resolve term to a RateBasis ontology node.
// Returns RATE_BASIS entry or null.
// Same strict matching rule as resolveDocumentType.
export function resolveRateBasis(input) {
  if (input == null) return null;
  const normalized = String(input).trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) return null;

  for (const key of Object.keys(RATE_BASIS)) {
    const entry = RATE_BASIS[key];
    if (entry.synonyms.some((syn) => syn.toUpperCase() === normalized)) {
      return entry;
    }
  }
  return null;
}

// Explain an SCT code without exposing private data.
// Supports DOC_TYPE, RATE_BASIS, CHARGE_TYPE codes.
export function explainOntologyNode(sctCode) {
  if (sctCode == null) return null;
  const code = String(sctCode).trim().toUpperCase();
  if (!code) return null;

  // Search DOC_TYPE codes
  for (const key of Object.keys(DOC_TYPE)) {
    const entry = DOC_TYPE[key];
    if (entry.code.toUpperCase() === code) {
      return {
        sct_code: entry.code,
        class: entry.sct_class,
        canonical_label: entry.label,
        synonyms: entry.synonyms.slice(),
        type_b: null,
        risk_default: "AMBER",
      };
    }
  }

  // Search RATE_BASIS codes
  for (const key of Object.keys(RATE_BASIS)) {
    const entry = RATE_BASIS[key];
    if (entry.code.toUpperCase() === code) {
      return {
        sct_code: entry.code,
        class: entry.sct_class,
        canonical_label: entry.label,
        synonyms: entry.synonyms.slice(),
        type_b: null,
        risk_default: "AMBER",
      };
    }
  }

  // Search CHARGE_TYPE codes
  for (const key of Object.keys(CHARGE_TYPE)) {
    const entry = CHARGE_TYPE[key];
    if (entry.code.toUpperCase() === code) {
      return {
        sct_code: entry.code,
        class: entry.sct_class,
        canonical_label: entry.label,
        synonyms: [],
        type_b: entry.type_b,
        risk_default: "AMBER",
      };
    }
  }

  return null;
}
