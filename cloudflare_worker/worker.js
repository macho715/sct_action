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

const DEFAULT_ONTOLOGY_VERSION = "SCT-LOGI-2026.06-v2.1";
const PACKAGE_VERSION = "HVDC-SCT-ONTOLOGY-GPT-ACTIONS-REST-v1.0.0";

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

  return {
    dry_run: true,
    evidence_requirements: codes.map((code) => evidenceRequirementFor(String(code))),
  };
}

function handleGateCheck(body) {
  const moduleName = body.module || body.context?.module || "invoice-audit";
  const evidenceStatus = Array.isArray(body.evidence_status) ? body.evidence_status : [];
  const rateBasisStatus = body.rate_basis_status || "NOT_CHECKED";
  const finalSubtotalStatus = body.final_subtotal_status || "NOT_APPLICABLE";
  const sctCodes = Array.isArray(body.sct_codes) ? body.sct_codes : [];

  const gate = evaluateGate({
    moduleName,
    sctCodes,
    evidenceStatus,
    rateBasisStatus,
    finalSubtotalStatus,
  });

  return gate;
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

  return evaluateGate({
    moduleName: "invoice-audit",
    sctCodes: lines.map((line) => line.sct_code || sctCodeFromTypeB(line.type_b)).filter(Boolean),
    evidenceStatus,
    rateBasisStatus: body.rate_basis_status || "NOT_CHECKED",
    finalSubtotalStatus: body.final_subtotal_before_vat == null ? "MISSING" : "MATCH",
  });
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
        confidence: resolved.confidence,
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

  if (normalized.includes("CUSTOMS") || normalized.includes("CLEARANCE")) {
    return mapping(input, "SCT.CHARGE.CUSTOMS_CLEARANCE", "Customs Clearance Fee", "Charge", TYPE_B.CUSTOMS, 0.98, "AMBER", "Check BOE and customs clearance approval evidence.", "NOT_CHECKED");
  }

  if (normalized.includes("MASTER DO") || normalized.includes("D/O") || normalized.includes("DELIVERY ORDER") || normalized === "DO" || normalized.endsWith(" DO FEE")) {
    return mapping(input, "SCT.CHARGE.MASTER_DO", "Master Delivery Order Fee", "Charge", TYPE_B.DO, 0.94, "AMBER", "Check DO document and invoice approval evidence.", "NOT_CHECKED");
  }

  if (normalized.includes("THC") || normalized.includes("TERMINAL HANDLING")) {
    return mapping(input, "SCT.CHARGE.THC", "Terminal Handling Charge", "Charge", TYPE_B.THC, 0.95, "AMBER", "Check terminal invoice or port tariff evidence.", "NOT_CHECKED");
  }

  if (normalized.includes("INLAND") || normalized.includes("TRUCK") || normalized.includes("TRANSPORT") || normalized.includes("DELIVERY")) {
    return mapping(input, "SCT.CHARGE.INLAND_TRANSPORT", "Inland Transport Charge", "Charge", TYPE_B.INLAND, 0.90, "AMBER", "Check lane map, POD, trip evidence, and approved rate basis.", "NOT_CHECKED");
  }

  if (normalized.includes("INSPECTION") || normalized.includes("ADMIN")) {
    return mapping(input, "SCT.CHARGE.INSPECTION_ADMIN", "Inspection/Admin Charge", "Charge", TYPE_B.INSPECTION, 0.88, "AMBER", "Check inspection report/admin charge evidence.", "NOT_CHECKED");
  }

  if (normalized.includes("DETENTION") || normalized.includes("DEMURRAGE") || normalized.includes("DEM/DET") || normalized.includes("DET")) {
    return mapping(input, "SCT.CHARGE.DETENTION", "Detention/Demurrage Charge", "Charge", TYPE_B.DETENTION, 0.90, "HIGH", "Check free time, container event dates, carrier invoice, and approval.", "NOT_CHECKED");
  }

  if (normalized.includes("STORAGE") || normalized.includes("STROAGE") || normalized.includes("WAREHOUSE")) {
    return mapping(input, "SCT.CHARGE.STORAGE", "Storage Charge", "Charge", TYPE_B.STROAGE, 0.90, "AMBER", "Check storage period, warehouse evidence, and approved rate basis.", "NOT_CHECKED");
  }

  if (normalized.includes("BOE") || normalized.includes("BILL OF ENTRY")) {
    return mapping(input, "SCT.DOC.BOE", "Bill of Entry", "Document", TYPE_B.CUSTOMS, 0.95, "AMBER", "Match BOE number, issue date, consignee, HS code, and amount if applicable.", "NOT_CHECKED");
  }

  if (normalized === "BL" || normalized.includes("HBL") || normalized.includes("MBL") || normalized.includes("BILL OF LADING")) {
    return mapping(input, "SCT.DOC.BL", "Bill of Lading", "Document", TYPE_B.OTHERS, 0.95, "AMBER", "Match BL with CI/PL, BOE, and shipment reference.", "NOT_CHECKED");
  }

  if (normalized.includes("POD") || normalized.includes("PROOF OF DELIVERY")) {
    return mapping(input, "SCT.DOC.POD", "Proof of Delivery", "Document", TYPE_B.INLAND, 0.94, "AMBER", "Match POD with lane, vehicle type, trip count, and delivery date.", "NOT_CHECKED");
  }

  return mapping(input, "SCT.UNKNOWN", "Unresolved Term", "Unknown", TYPE_B.OTHERS, 0.30, "AMBER", "Manual review required. Provide shipment reference, charge description, or document reference.", "MISSING");
}

function mapping(inputTerm, sctCode, canonicalLabel, cls, typeB, confidence, risk, nextAction, evidenceStatus) {
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
    audit_trace_id: makeId("TRACE"),
  };
}

function explainNode(sctCode) {
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

function evidenceRequirementFor(sctCode) {
  const code = String(sctCode).toUpperCase();

  if (code.includes("CUSTOMS") || code.includes("BOE")) {
    return {
      sct_code: sctCode,
      required_evidence: ["BOE", "Customs clearance approval", "Invoice line reference"],
      missing_status: "AMBER",
      max_required_inputs: 3,
    };
  }

  if (code.includes("MASTER_DO") || code.endsWith(".DO")) {
    return {
      sct_code: sctCode,
      required_evidence: ["Delivery Order", "DO fee support", "Invoice line reference"],
      missing_status: "AMBER",
      max_required_inputs: 3,
    };
  }

  if (code.includes("INLAND") || code.includes("POD")) {
    return {
      sct_code: sctCode,
      required_evidence: ["Approved lane map", "POD / signed delivery note", "Vehicle/trip evidence"],
      missing_status: "AMBER",
      max_required_inputs: 3,
    };
  }

  if (code.includes("DETENTION") || code.includes("DEM")) {
    return {
      sct_code: sctCode,
      required_evidence: ["Free time basis", "Container event timeline", "Carrier/terminal invoice"],
      missing_status: "ZERO",
      max_required_inputs: 3,
    };
  }

  return {
    sct_code: sctCode,
    required_evidence: ["Invoice line reference", "Supporting document", "Approval evidence"],
    missing_status: "AMBER",
    max_required_inputs: 3,
  };
}

function evaluateGate({ moduleName, sctCodes, evidenceStatus, rateBasisStatus, finalSubtotalStatus }) {
  const gates = [];
  let verdict = "PASS";

  const statusValues = evidenceStatus.map((x) => String(x.status || "").toUpperCase());

  if (statusValues.includes("CONFLICT")) {
    verdict = "ZERO";
    gates.push({ gate: "evidence_status", status: "CONFLICT", note: "Evidence conflict found. Human review required." });
  } else if (statusValues.includes("MISSING")) {
    verdict = maxVerdict(verdict, "AMBER");
    gates.push({ gate: "evidence_status", status: "MISSING", note: "Required evidence is missing." });
  } else if (statusValues.includes("PARTIAL") || statusValues.includes("NOT_APPLICABLE") || statusValues.length === 0) {
    verdict = maxVerdict(verdict, "AMBER");
    gates.push({ gate: "evidence_status", status: "PARTIAL_OR_NOT_CHECKED", note: "Evidence is partial or not checked." });
  } else {
    gates.push({ gate: "evidence_status", status: "MATCHED", note: "Evidence status indicates matched support." });
  }

  if (String(rateBasisStatus).toUpperCase() === "CONFLICT") {
    verdict = "ZERO";
    gates.push({ gate: "rate_basis_status", status: "CONFLICT", note: "Rate basis conflict. Do not approve." });
  } else if (String(rateBasisStatus).toUpperCase() === "MISSING" && ["invoice-audit", "cost-guard"].includes(moduleName)) {
    verdict = "ZERO";
    gates.push({ gate: "rate_basis_status", status: "MISSING", note: "Rate/source missing for invoice or Cost Guard. ZERO gate." });
  } else {
    gates.push({ gate: "rate_basis_status", status: String(rateBasisStatus), note: "Rate basis dry-run check completed." });
  }

  if (String(finalSubtotalStatus).toUpperCase() === "CONFLICT") {
    verdict = maxVerdict(verdict, "FAIL");
    gates.push({ gate: "final_subtotal_status", status: "CONFLICT", note: "Final subtotal conflicts with source." });
  } else if (String(finalSubtotalStatus).toUpperCase() === "MISSING") {
    verdict = maxVerdict(verdict, "AMBER");
    gates.push({ gate: "final_subtotal_status", status: "MISSING", note: "Final subtotal before VAT is missing." });
  } else {
    gates.push({ gate: "final_subtotal_status", status: String(finalSubtotalStatus), note: "Final subtotal status dry-run check completed." });
  }

  if (verdict === "PASS" && gates.some((g) => String(g.status).includes("NOT_CHECKED"))) {
    verdict = "PASS WITH WARNINGS";
  }

  return {
    dry_run: true,
    ontology_version: DEFAULT_ONTOLOGY_VERSION,
    verdict,
    gates,
    required_inputs_max_3: requiredInputsFor(verdict, moduleName),
    audit_trace_id: makeId("TRACE"),
  };
}

function maxVerdict(a, b) {
  const rank = { PASS: 0, "PASS WITH WARNINGS": 1, AMBER: 2, FAIL: 3, ZERO: 4 };
  return (rank[b] > rank[a]) ? b : a;
}

function requiredInputsFor(verdict, moduleName) {
  if (verdict === "ZERO") {
    return ["Contract/rate basis source", "Evidence document reference", "Final approver decision"];
  }
  if (moduleName === "invoice-audit" || moduleName === "cost-guard") {
    return ["Final invoice subtotal before VAT", "BOE/DO/BL/POD evidence", "Contract/rate basis source"];
  }
  return ["Valid SCT code", "Evidence status", "Module context"];
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
