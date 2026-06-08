// HVDC SCT Ontology GPT Actions REST Wrapper
// Version: 1.0.0
// Runtime: Cloudflare Workers, module syntax
//
// Purpose:
// - Expose REST routes that GPT Actions can call through OpenAPI.
// - Support both /ontology/* and /mcp/ontology/* aliases.
// - Dry-run/read-only only.
// - No invoice approval, payment, ERP/TMS/WMS mutation, or raw contract-rate disclosure.
//
// Optional authentication:
// - If env.SCT_ACTION_API_KEY is set, requests must include X-API-Key: <value>
//   or Authorization: Bearer <value>.
// - If env.SCT_ACTION_API_KEY is not set, the worker runs in no-auth smoke-test mode.

// HVDC SCT Ontology GPT Actions REST Wrapper
// Version: 2.0.0
// Runtime: Cloudflare Workers, module syntax
//
// Purpose:
// - Expose REST routes that GPT Actions can call through OpenAPI.
// - Support both /ontology/* and /mcp/ontology/* aliases.
// - Dry-run/read-only only.
// - No invoice approval, payment, ERP/TMS/WMS mutation, or raw contract-rate disclosure.
//
// Optional authentication:
// - If env.SCT_ACTION_API_KEY is set, requests must include X-API-Key: <value>
//   or Authorization: Bearer <value>.
// - If env.SCT_ACTION_API_KEY is not set, the worker runs in no-auth smoke-test mode.
//
// v2.0.0 (Phase 1):
// - Module split: lib/ontology-data.js (constants) + lib/ontology.js (resolution)
// - New ontology classes: DocumentType (BOE, CI/PL, POD, DO, STORAGE_INVOICE, etc.)
//   and RateBasis (AT_COST, AS_PER_OFFER, TARIFF, MISSING, CONFLICT)
// - Backward compatible: existing charge classifier logic preserved.
//
// v2.1.0 (Phase 2):
// - Customs Inspection override priority: OVERRIDE > FALLBACK_KEYWORD
// - Bill of Entry Fee modeled as SCT.CHARGE.BOE_FEE (separate from CUSTOMS_CLEARANCE)
//
// v2.2.0 (Phase 3):
// - Evidence Map extracted to lib/evidence.js
// - Extended rules: Customs/Inspection/AT_COST/AS_PER_OFFER/DO/THC/INLAND/DETENTION/STORAGE/BL
// - New fields: required_evidence_codes, rule_source, reviewer_action
// - validateEvidence(pack) helper for MATCHED_EXACT / PARTIAL / MISSING
//
// v2.3.0 (Phase 4):
// - Gate Check extracted to lib/gate.js
// - checkGate({subtotal, rate_basis, evidence_status, evidence_gaps, type_b_tie_out})
//   returns {gate_result, pass_allowed, gates, blocking, reviewer_action}
// - Final subtotal missing now blocks PASS (was AMBER in v2.2.0)
// - Rate basis MISSING/CONFLICT blocks PASS (was AMBER for non-invoice modules)
// - Categorical evidence gaps (HS_UAE_CODE_MISSING, EVIDENCE_GAP_DEM_DET,
//   OOG_STOWAGE_NOTES_MISSING, FINAL_RECON_NOT_DONE, APPROVAL_NOT_LINKED) → ZERO
// - TYPE-B tie-out gate added (BROKEN → ZERO, PARTIAL → AMBER)
// - Backward compatible: legacy flat input shape still accepted.

import { resolveDocumentType, resolveRateBasis, explainOntologyNode } from "./lib/ontology.js";
import { classifyTypeB } from "./lib/type-b-classifier.js";
import { getEvidenceRequirements, validateEvidence } from "./lib/evidence.js";
import { checkGate } from "./lib/gate.js";

const DEFAULT_ONTOLOGY_VERSION = "SCT-LOGI-2026.06-v2.3";
const PACKAGE_VERSION = "HVDC-SCT-ONTOLOGY-GPT-ACTIONS-REST-v2.3.0";

const TYPE_B = Object.freeze({
  CUSTOMS: "Customs",
  DO: "DO",
  INLAND: "INLAND",
  THC: "THC",
  INSPECTION: "Inspection",
  DETENTION: "Detention",
  STROAGE: "STROAGE",
  OTHERS: "OTHERS",
});

const ROUTES = Object.freeze({
  "/ontology/resolve": handleResolve,
  "/ontology/explain": handleExplain,
  "/ontology/evidence-map": handleEvidenceMap,
  "/ontology/gate-check": handleGateCheck,
  "/ontology/crosswalk": handleCrosswalk,
  "/ontology/audit-trace": handleAuditTrace,
  "/dry-run/validate": handleDryRunValidate,
  "/dry-run/type-b-classify": handleTypeBClassify,
  "/dry-run/rate-lookup": handleRateLookup,
});

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const originalPath = normalizePath(url.pathname);
    const routePath = stripMcpPrefix(originalPath);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return preflightResponse(request);
    }

    if (method === "GET" && (originalPath === "/" || originalPath === "/health" || originalPath === "/mcp" || originalPath === "/mcp/health")) {
      return jsonResponse(request, {
        dry_run: true,
        status: "OK",
        package_version: PACKAGE_VERSION,
        ontology_version: DEFAULT_ONTOLOGY_VERSION,
        message: "HVDC SCT Ontology GPT Actions REST wrapper is online.",
        supported_route_count: Object.keys(ROUTES).length,
        supported_routes: Object.keys(ROUTES),
        aliases: "All routes also support /mcp prefix, e.g. /mcp/ontology/resolve.",
        elapsed_ms: Date.now() - startedAt,
      }, 200);
    }

    if (method !== "POST") {
      return jsonResponse(request, errorPayload(
        "METHOD_NOT_ALLOWED",
        "Only POST is supported for GPT Actions REST operations.",
        ["Use POST", "Use valid JSON body", "Use one of the supported OpenAPI paths"]
      ), 405);
    }

    const auth = checkAuth(request, env);
    if (!auth.ok) {
      return jsonResponse(request, errorPayload(
        "UNAUTHORIZED",
        "Missing or invalid API key.",
        ["Set GPT Builder authentication", "Send X-API-Key header", "Or unset SCT_ACTION_API_KEY for smoke-test mode"]
      ), 401);
    }

    const handler = ROUTES[routePath];
    if (!handler) {
      return jsonResponse(request, errorPayload(
        "ROUTE_NOT_FOUND",
        `Route not found: ${originalPath}`,
        ["Check OpenAPI servers.url", "Check OpenAPI path", "Deploy REST wrapper route"]
      ), 404);
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return jsonResponse(request, errorPayload(
        "INVALID_JSON",
        "Request body must be valid JSON.",
        ["Valid JSON payload", "Content-Type: application/json"]
      ), 400);
    }

    try {
      const result = await handler(body, { request, env, ctx, originalPath, routePath, auth, startedAt });
      const status = Number.isInteger(result?.status) ? result.status : 200;
      const payload = result?.payload ?? result;
      return jsonResponse(request, addMeta(payload, startedAt, auth.mode, originalPath, routePath), status);
    } catch (err) {
      return jsonResponse(request, errorPayload(
        "INTERNAL_ERROR",
        safeMessage(err),
        ["Check Worker logs", "Validate request payload", "Retest with smoke payload"]
      ), 500);
    }
  },
};

function handleResolve(body) {
  const ontologyVersion = body.ontology_version || DEFAULT_ONTOLOGY_VERSION;
  const terms = Array.isArray(body.terms) ? body.terms : [];
  const context = isPlainObject(body.context) ? body.context : {};

  if (terms.length === 0) {
    return {
      status: 400,
      payload: errorPayload(
        "MISSING_TERMS",
        "terms array is required and must contain at least one term.",
        ["terms", "context.module"]
      ),
    };
  }

  const mappings = terms.map((term) => resolveTerm(term, context));

  return {
    dry_run: true,
    ontology_version: ontologyVersion,
    mappings,
  };
}

function handleExplain(body) {
  const sctCode = String(body.sct_code || "").trim();
  if (!sctCode) {
    return {
      status: 400,
      payload: errorPayload("MISSING_SCT_CODE", "sct_code is required.", ["sct_code"]),
    };
  }

  const node = explainNode(sctCode);
  const relations = body.include_relations === false ? [] : relationEdgesFor(sctCode);

  return {
    dry_run: true,
    node,
    relations,
  };
}

function handleEvidenceMap(body) {
  const codes = Array.isArray(body.sct_codes) ? body.sct_codes : [];
  if (codes.length === 0) {
    return {
      status: 400,
      payload: errorPayload("MISSING_SCT_CODES", "sct_codes array is required.", ["sct_codes", "context.module"]),
    };
  }

  // Phase 3 (v2.2.0): optional per-code validation when `provided_evidence` is supplied
  // alongside `sct_codes` (paired by index). Returns MATCHED_EXACT / PARTIAL / MISSING.
  const provided = Array.isArray(body.provided_evidence) ? body.provided_evidence : [];
  let evidence_validation = null;
  if (provided.length > 0) {
    evidence_validation = codes.map((code, idx) =>
      validateEvidence({
        sct_code: String(code),
        provided_evidence: Array.isArray(provided[idx]) ? provided[idx] : [],
      }),
    );
  }

  return {
    dry_run: true,
    evidence_requirements: codes.map((code) => getEvidenceRequirements(String(code))),
    ...(evidence_validation ? { evidence_validation } : {}),
  };
}

function handleGateCheck(body) {
  const gate = checkGate({
    module: body.module || body.context?.module,
    sct_codes: body.sct_codes,
    evidence_status: body.evidence_status,
    subtotal: body.subtotal,
    rate_basis: body.rate_basis,
    rate_basis_status: body.rate_basis_status,
    final_subtotal_status: body.final_subtotal_status,
    evidence_gaps: body.evidence_gaps,
    type_b_tie_out: body.type_b_tie_out,
    context: body.context,
  });

  return bridgeGateResult(gate);
}

function handleCrosswalk(body) {
  const codes = Array.isArray(body.sct_codes) ? body.sct_codes : [];
  if (codes.length === 0) {
    return {
      status: 400,
      payload: errorPayload("MISSING_SCT_CODES", "sct_codes array is required.", ["sct_codes"]),
    };
  }

  const target = body.target || "TYPE_B";
  return {
    dry_run: true,
    crosswalk: codes.map((code) => crosswalkLine(String(code), target)),
  };
}

function handleAuditTrace(body) {
  const requestId = body.request_id || makeId("REQ");
  const verdict = body.verdict || "AMBER";
  const moduleName = body.module || "invoice-audit";

  return {
    dry_run: true,
    audit_trace_id: makeId("TRACE"),
    retained_payload: "MASKED_ONLY",
    request_id: maskText(requestId),
    module: moduleName,
    verdict,
  };
}

function handleDryRunValidate(body) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const evidenceStatus = lines.map((line) => ({
    sct_code: line.sct_code || sctCodeFromTypeB(line.type_b),
    status: line.evidence_status || "NOT_APPLICABLE",
    document_ref_masked: line.dsv_draft_invoice_ref_masked || line.shipment_no_masked || "MASKED",
    note: "Derived from invoice audit payload line.",
  }));

  const subtotalStatus = body.final_subtotal_before_vat == null ? "MISSING" : "MATCH";
  const rateBasisStatus = body.rate_basis_status || "NOT_CHECKED";

  const gate = checkGate({
    module: "invoice-audit",
    sct_codes: lines.map((line) => line.sct_code || sctCodeFromTypeB(line.type_b)).filter(Boolean),
    evidence_status: evidenceStatus,
    subtotal: { status: subtotalStatus, amount: body.final_subtotal_before_vat ?? null, currency: body.context?.currency || "USD" },
    rate_basis: { status: rateBasisStatus },
    evidence_gaps: body.evidence_gaps,
    type_b_tie_out: body.type_b_tie_out,
    context: body.context,
  });

  return bridgeGateResult(gate);
}

function handleTypeBClassify(body) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return {
      status: 400,
      payload: errorPayload("MISSING_LINES", "lines array is required.", ["lines"]),
    };
  }

  return {
    dry_run: true,
    classifications: lines.map((line) => {
      const resolved = resolveTerm(line.description || "", {});
      return {
        line_id: String(line.line_id || makeId("LINE")),
        type_b: resolved.type_b || TYPE_B.OTHERS,
        sct_code: resolved.sct_code,
        sct_class: resolved.class || "Unknown",
        confidence: resolved.confidence,
        type_b_rule_source: resolved.type_b_rule_source || "FALLBACK_DEFAULT",
        reviewer_action: resolved.required_next_action || "Manual review required.",
      };
    }),
  };
}

function handleRateLookup(body) {
  const charge = String(body.charge || "").trim();
  const unit = String(body.unit || "").trim();

  if (!charge || !unit) {
    return {
      status: 400,
      payload: errorPayload("MISSING_RATE_LOOKUP_KEYS", "charge and unit are required.", ["charge", "unit"]),
    };
  }

  // This endpoint intentionally never returns raw contract rates.
  // It only returns status so GPT can decide AMBER/ZERO and request human evidence.
  return {
    dry_run: true,
    status: "MISSING",
    contract_row_id_masked: "MASKED",
    private_rate_masked: true,
    reviewer_action: "Private rate lookup requires approved internal rate table binding. Do not disclose raw contract rate.",
  };
}

function resolveTerm(term, context) {
  const input = String(term ?? "").trim();
  const normalized = input.toUpperCase().replace(/\s+/g, " ");

  if (!input) {
    return mapping(input, "SCT.UNKNOWN", "Empty Term", "Unknown", TYPE_B.OTHERS, 0.10, "AMBER", "Provide a valid term.", "MISSING");
  }

  if (/^HVDC-[A-Z0-9-]+$/i.test(input)) {
    return mapping(input, "SCT.ENTITY.SHIPMENT_REFERENCE", "Shipment Reference", "Shipment", TYPE_B.OTHERS, 0.95, "AMBER", "Map required shipment evidence and validate invoice line linkage.", "NOT_CHECKED");
  }

  if (/^(BAMF|SAMF)[A-Z0-9-]+$/i.test(input)) {
    return mapping(input, "SCT.ENTITY.DSV_DRAFT_INVOICE_REF", "DSV Draft Invoice Reference", "InvoiceReference", TYPE_B.OTHERS, 0.92, "AMBER", "Cross-check draft invoice reference against evidence package.", "NOT_CHECKED");
  }

  // Phase 1 (v2.0.0): DocumentType ontology match (FR-001 to FR-004)
  const docMatch = resolveDocumentType(input);
  if (docMatch) {
    return mapping(input, docMatch.code, docMatch.label, docMatch.sct_class, null, docMatch.confidence, "AMBER", `Verify ${docMatch.code} document and required evidence.`, "PARTIAL");
  }

  // Phase 1 (v2.0.0): RateBasis ontology match (FR-005 to FR-007)
  const rateMatch = resolveRateBasis(input);
  if (rateMatch) {
    return mapping(input, rateMatch.code, rateMatch.label, rateMatch.sct_class, null, rateMatch.confidence, "AMBER", `Verify rate basis ${rateMatch.code} with supporting evidence.`, "MISSING");
  }

  // Phase 2 (v2.1.0): Type-B classifier with override priority
  //   1. OVERRIDE — Customs Inspection beats generic Customs (FR-008, FR-009, SC-006)
  //   2. FALLBACK_KEYWORD — BOE_FEE, CUSTOMS_CLEARANCE, DO, THC, INLAND, etc.
  const typeBResult = classifyTypeB(input);
  if (typeBResult) {
    // Map type_b string to TYPE_B enum value
    const typeBEnum = Object.values(TYPE_B).find((v) => v === typeBResult.type_b) || TYPE_B.OTHERS;
    return mapping(
      input,
      typeBResult.sct_code,
      typeBResult.canonical_label,
      typeBResult.sct_class,
      typeBEnum,
      typeBResult.confidence,
      "AMBER",
      typeBResult.reviewer_action,
      "NOT_CHECKED",
      typeBResult.rule_source
    );
  }

  return mapping(input, "SCT.UNKNOWN", "Unresolved Term", "Unknown", TYPE_B.OTHERS, 0.30, "AMBER", "Manual review required. Provide shipment reference, charge description, or document reference.", "MISSING");
}

function mapping(inputTerm, sctCode, canonicalLabel, cls, typeB, confidence, risk, nextAction, evidenceStatus, ruleSource) {
  return {
    input_term: maskText(inputTerm),
    sct_code: sctCode,
    canonical_label: canonicalLabel,
    class: cls,
    type_b: typeB,
    confidence,
    risk,
    required_next_action: nextAction,
    evidence_status: evidenceStatus,
    type_b_rule_source: ruleSource || null,
    audit_trace_id: makeId("TRACE"),
  };
}

function explainNode(sctCode) {
  // Phase 1 (v2.0.0): delegate to lib/ontology.js for DOC_TYPE/RATE_BASIS/CHARGE_TYPE
  const libNode = explainOntologyNode(sctCode);
  if (libNode) {
    // Map lib type_b to TYPE_B enum (CHARGE_TYPE entries have type_b set)
    const typeBValue = libNode.type_b;
    let resolvedTypeB = TYPE_B.OTHERS;
    if (typeBValue) {
      const match = Object.values(TYPE_B).find((v) => v === typeBValue);
      if (match) resolvedTypeB = match;
    }
    return {
      sct_code: libNode.sct_code,
      class: libNode.class,
      canonical_label: libNode.canonical_label,
      synonyms: libNode.synonyms,
      type_b: resolvedTypeB,
      risk_default: libNode.risk_default,
    };
  }

  // Backward-compat fallbacks for legacy charge codes not in CHARGE_TYPE
  const code = String(sctCode).toUpperCase();

  if (code.includes("CUSTOMS_CLEARANCE")) {
    return {
      sct_code: "SCT.CHARGE.CUSTOMS_CLEARANCE",
      class: "Charge",
      canonical_label: "Customs Clearance Fee",
      synonyms: ["CUSTOMS CLEARANCE FEE", "CUSTOMS CLEARANCE"],
      type_b: TYPE_B.CUSTOMS,
      risk_default: "AMBER",
    };
  }

  if (code.includes("MASTER_DO")) {
    return {
      sct_code: "SCT.CHARGE.MASTER_DO",
      class: "Charge",
      canonical_label: "Master Delivery Order Fee",
      synonyms: ["MASTER DO FEE", "DELIVERY ORDER FEE", "D/O FEE"],
      type_b: TYPE_B.DO,
      risk_default: "AMBER",
    };
  }

  if (code.includes("INLAND_TRANSPORT")) {
    return {
      sct_code: "SCT.CHARGE.INLAND_TRANSPORT",
      class: "Charge",
      canonical_label: "Inland Transport Charge",
      synonyms: ["INLAND TRANSPORT", "TRUCKING", "DELIVERY"],
      type_b: TYPE_B.INLAND,
      risk_default: "AMBER",
    };
  }

  return {
    sct_code: sctCode,
    class: "OntologyNode",
    canonical_label: sctCode,
    synonyms: [],
    type_b: TYPE_B.OTHERS,
    risk_default: "AMBER",
  };
}

function relationEdgesFor(sctCode) {
  const code = String(sctCode).toUpperCase();
  if (code.includes("CUSTOMS_CLEARANCE")) {
    return [
      { from: "SCT.CHARGE.CUSTOMS_CLEARANCE", relation: "requiresEvidence", to: "SCT.DOC.BOE" },
      { from: "SCT.CHARGE.CUSTOMS_CLEARANCE", relation: "belongsToTypeB", to: "TYPE_B.Customs" },
    ];
  }
  if (code.includes("MASTER_DO")) {
    return [
      { from: "SCT.CHARGE.MASTER_DO", relation: "requiresEvidence", to: "SCT.DOC.DO" },
      { from: "SCT.CHARGE.MASTER_DO", relation: "belongsToTypeB", to: "TYPE_B.DO" },
    ];
  }
  if (code.includes("INLAND_TRANSPORT")) {
    return [
      { from: "SCT.CHARGE.INLAND_TRANSPORT", relation: "requiresEvidence", to: "SCT.DOC.POD" },
      { from: "SCT.CHARGE.INLAND_TRANSPORT", relation: "belongsToTypeB", to: "TYPE_B.INLAND" },
    ];
  }
  return [];
}

function bridgeGateResult(gate) {
  // Backward-compatible wrapper around lib/gate.js checkGate() output.
  // Adds dry_run, ontology_version, legacy `verdict` field, and audit_trace_id
  // so existing GPT Instructions referencing `verdict` keep working.
  return {
    dry_run: true,
    ontology_version: DEFAULT_ONTOLOGY_VERSION,
    verdict: gate.gate_result,            // legacy alias (v2.2.0 and earlier)
    gate_result: gate.gate_result,        // canonical v2.3.0+
    pass_allowed: gate.pass_allowed,
    gates: gate.gates,
    blocking: gate.blocking,
    reviewer_action: gate.reviewer_action,
    required_inputs_max_3: gate.required_inputs_max_3,
    rule_source: gate.rule_source,
    audit_trace_id: makeId("TRACE"),
  };
}

function crosswalkLine(sctCode, target) {
  const typeB = typeBFromSctCode(sctCode);
  let value = typeB;

  if (target === "DOCUMENT_TYPE") {
    value = documentTypeFromSctCode(sctCode);
  } else if (target === "RATE_BASIS") {
    value = rateBasisFromSctCode(sctCode);
  } else if (target === "COST_CENTER_HINT") {
    value = costCenterHintFromTypeB(typeB);
  }

  return {
    sct_code: sctCode,
    target,
    value,
    confidence: typeB === TYPE_B.OTHERS ? 0.60 : 0.95,
  };
}

function typeBFromSctCode(sctCode) {
  const code = String(sctCode).toUpperCase();
  if (code.includes("CUSTOMS") || code.includes("BOE")) return TYPE_B.CUSTOMS;
  if (code.includes("MASTER_DO") || code.endsWith(".DO")) return TYPE_B.DO;
  if (code.includes("INLAND") || code.includes("POD")) return TYPE_B.INLAND;
  if (code.includes("THC")) return TYPE_B.THC;
  if (code.includes("INSPECTION")) return TYPE_B.INSPECTION;
  if (code.includes("DETENTION") || code.includes("DEM")) return TYPE_B.DETENTION;
  if (code.includes("STORAGE")) return TYPE_B.STROAGE;
  return TYPE_B.OTHERS;
}

function sctCodeFromTypeB(typeB) {
  const t = String(typeB || "").toUpperCase();
  if (t === "CUSTOMS") return "SCT.CHARGE.CUSTOMS_CLEARANCE";
  if (t === "DO") return "SCT.CHARGE.MASTER_DO";
  if (t === "INLAND") return "SCT.CHARGE.INLAND_TRANSPORT";
  if (t === "THC") return "SCT.CHARGE.THC";
  if (t === "INSPECTION") return "SCT.CHARGE.INSPECTION_ADMIN";
  if (t === "DETENTION") return "SCT.CHARGE.DETENTION";
  if (t === "STROAGE" || t === "STORAGE") return "SCT.CHARGE.STORAGE";
  return "SCT.UNKNOWN";
}

function documentTypeFromSctCode(sctCode) {
  const typeB = typeBFromSctCode(sctCode);
  if (typeB === TYPE_B.CUSTOMS) return "BOE";
  if (typeB === TYPE_B.DO) return "DO";
  if (typeB === TYPE_B.INLAND) return "POD";
  if (typeB === TYPE_B.THC) return "Terminal invoice / Port support";
  if (typeB === TYPE_B.DETENTION) return "Carrier/terminal event invoice";
  if (typeB === TYPE_B.STROAGE) return "Warehouse/storage support";
  return "Supporting document";
}

function rateBasisFromSctCode(sctCode) {
  const typeB = typeBFromSctCode(sctCode);
  if ([TYPE_B.CUSTOMS, TYPE_B.DO, TYPE_B.THC].includes(typeB)) return "CONTRACT_OR_TARIFF";
  if ([TYPE_B.INLAND, TYPE_B.STROAGE].includes(typeB)) return "CONTRACT_LANE_OR_PERIOD";
  if (typeB === TYPE_B.DETENTION) return "CARRIER_TERMINAL_FREE_TIME";
  return "AT_COST_OR_APPROVAL";
}

function costCenterHintFromTypeB(typeB) {
  if (typeB === TYPE_B.CUSTOMS) return "CUSTOMS";
  if (typeB === TYPE_B.DO) return "DO";
  if (typeB === TYPE_B.INLAND) return "INLAND";
  if (typeB === TYPE_B.THC) return "THC";
  if (typeB === TYPE_B.DETENTION) return "DEM_DET";
  if (typeB === TYPE_B.STROAGE) return "STORAGE";
  return "OTHERS";
}

function normalizePath(pathname) {
  const p = String(pathname || "/").trim();
  if (!p || p === "") return "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function stripMcpPrefix(pathname) {
  if (pathname === "/mcp") return "/";
  if (pathname.startsWith("/mcp/")) return pathname.slice(4);
  return pathname;
}

function checkAuth(request, env) {
  const expected = env && env.SCT_ACTION_API_KEY;
  if (!expected) return { ok: true, mode: "NO_AUTH_DEV" };

  const apiKey = request.headers.get("X-API-Key");
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();

  if (apiKey === expected || bearer === expected) return { ok: true, mode: "API_KEY" };
  return { ok: false, mode: "API_KEY" };
}

function jsonResponse(request, data, status = 200) {
  const origin = request.headers.get("Origin") || "*";
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-api-key",
      "access-control-max-age": "86400",
      "vary": "Origin",
    },
  });
}

function preflightResponse(request) {
  const origin = request.headers.get("Origin") || "*";
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-api-key",
      "access-control-max-age": "86400",
      "vary": "Origin",
    },
  });
}

function errorPayload(error, message, requiredInputs = []) {
  return {
    dry_run: true,
    error,
    message,
    required_inputs_max_3: requiredInputs.slice(0, 3),
  };
}

function addMeta(payload, startedAt, authMode, originalPath, routePath) {
  if (!isPlainObject(payload)) return payload;
  return {
    ...payload,
    _meta: {
      package_version: PACKAGE_VERSION,
      action_mode: "DRY_RUN_READ_ONLY",
      auth_mode: authMode,
      original_path: originalPath,
      route_path: routePath,
      elapsed_ms: Date.now() - startedAt,
      timestamp_utc: new Date().toISOString(),
    },
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeMessage(err) {
  if (!err) return "Unknown error";
  return String(err.message || err).slice(0, 300);
}

function makeId(prefix) {
  const suffix = (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    ? globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()
    : `${Date.now()}`;
  return `${prefix}-${suffix}`;
}

function maskText(value) {
  let text = String(value ?? "");
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_MASKED]");
  text = text.replace(/\+?\d[\d\s().-]{7,}\d/g, "[PHONE_MASKED]");
  return text;
}
