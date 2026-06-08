# HVDC SCT Ontology GPT Actions — Deployment Report

> **Date**: 2026-06-08
> **Author**: SCM team (assisted by Claude Code, MiniMax-M3)
> **Repository**: https://github.com/macho715/sct_action
> **Worker URL**: https://hvdc-ontology-chatgpt-app.mscho715.workers.dev

## 1. Executive Summary

SCT ontology v2.0.0 → v2.4.0 deployed across 4 phases (Phase 1~4) and bundled with Phase 5 (Line_Audit) + Phase 6 (OpenAPI/GPTS alignment) in a SWARM batch. All 21 Golden TC assertions pass on the live URL. Zero regression vs Phase 3 baseline.

## 2. Deployment Timeline

| Phase | Commit | Date (UTC) | Worker Version | Description |
|-------|--------|------------|----------------|-------------|
| 1 | 23aed2c | 2026-06-07 | v2.0.0 | Ontology seed (DocumentType + RateBasis) |
| 2 | 12223da | 2026-06-07 | v2.1.0 | Customs Inspection override |
| 3 | 6a12bdf | 2026-06-07 | v2.2.0 | Evidence Map |
| 4 | bfdc885 (PR #1) | 2026-06-08 04:21 | v2.3.0 | Gate Check blockers |
| 5+6+7 | SWARM branch | 2026-06-08 04:30+ | v2.4.0 | Line_Audit + OpenAPI/GPTS (this report) |

## 3. Current Live State (v2.4.0)

| Field | Value |
|-------|-------|
| `package_version` | `HVDC-SCT-ONTOLOGY-GPT-ACTIONS-REST-v2.4.0` |
| `ontology_version` | `SCT-LOGI-2026.06-v2.4` |
| OpenAPI schema version | 2.5.0 (Phase 6) |
| GPT Instructions patch | v1.1 (Phase 6) |
| Worker Version ID | `2f057335-f60e-4dae-95c1-5dc699724f61` |
| Routes online | 9 / 9 |
| Bundle size | 47.73 KiB (gzip 11.26 KiB) |

## 4. Test Evidence

### 4.1 Local Tests (Node.js ESM, no wrangler)

| Test suite | TC count | Result |
|------------|----------|--------|
| `tests/_check_imports.mjs` | 4 import checks | ✓ PASS |
| `tests/_evidence_local_test.mjs` (Phase 3) | 11 / 11 | ✓ PASS |
| `tests/_gate_local_test.mjs` (Phase 4) | 22 / 22 | ✓ PASS |
| **Subtotal** | **37 / 37** | **✓ PASS** |

### 4.2 Live HTTP Smoke Tests (`bash tests/curl_smoke_tests.sh`)

| Category | Count | Result |
|----------|-------|--------|
| Phase 1 — DocumentType (TC-DOC-001~003) | 3 | ✓ PASS |
| Phase 1 — RateBasis (TC-RATE-001~002) | 2 | ✓ PASS |
| Phase 3 — Evidence Map (TC-EVM-001~004) | 4 | ✓ PASS |
| Phase 4 — Gate Check (TC-GATE-001~004) | 6 | ✓ PASS |
| Phase 2 — Type-B override (TC-OVR-001~002) | 6 | ✓ PASS |
| **Total Golden TC assertions** | **21 / 21** | **✓ PASS** |
| Routes smoke (curl + jq) | 9 / 9 | ✓ PASS |

### 4.3 Phase 5 Line_Audit Live Verification

5-term integration test (`tests/resolve-line-audit.payload.json`):

| Input | sct_code | sct_class | document_type_code | rate_basis_code | gate_result |
|-------|----------|-----------|--------------------|------------------|-------------|
| `BILL OF ENTRY` | `SCT.DOC.BOE` | `DocumentType` | `SCT.DOC.BOE` | `null` | `AMBER` |
| `AT COST` | `SCT.RATE.AT_COST` | `RateBasis` | `null` | `SCT.RATE.AT_COST` | `AMBER` |
| `CUSTOMS INSPECTION FEE` | `SCT.CHARGE.CUSTOMS_INSPECTION` | `ChargeType` | `null` | `null` | `PASS` |
| `BILL OF ENTRY FEE` | `SCT.CHARGE.BOE_FEE` | `ChargeType` | `null` | `null` | `PASS` |
| `HVDC-ADOPT-SCT-0180` | `SCT.ENTITY.SHIPMENT_REFERENCE` | `Shipment` | `null` | `null` | `PASS` |

All 9 canonical Line_Audit fields present on each mapping.

## 5. Gate Check Behavior Summary (Phase 4)

| Input | gate_result | pass_allowed | blocking |
|-------|-------------|--------------|----------|
| `final_subtotal.status = MISSING` | `ZERO` | `false` | `["final_subtotal"]` |
| `rate_basis.status = CONFLICT` (invoice-audit) | `ZERO` | `false` | `["rate_basis"]` |
| `rate_basis.status = MISSING` (invoice-audit) | `ZERO` | `false` | `["rate_basis"]` |
| `rate_basis.status = MISSING` (other module) | `AMBER` | `false` | `[]` |
| `evidence_gaps = ["EVIDENCE_GAP_DEM_DET"]` | `ZERO` | `false` | `["evidence_gaps"]` |
| `evidence_gaps = ["HS_UAE_CODE_MISSING"]` | `ZERO` | `false` | `["evidence_gaps"]` |
| `type_b_tie_out.status = BROKEN` | `ZERO` | `false` | `["type_b_tie_out"]` |
| `evidence_status = PARTIAL` (rest OK) | `AMBER` | `false` | `[]` |
| All gates pass | `PASS` | `true` | `[]` |

5 blocking evidence gap flags: `HS_UAE_CODE_MISSING`, `EVIDENCE_GAP_DEM_DET`, `OOG_STOWAGE_NOTES_MISSING`, `FINAL_RECON_NOT_DONE`, `APPROVAL_NOT_LINKED`.

## 6. OpenAPI Schema Diff (Phase 6)

SctMapping schema extended from 9 fields → 9 canonical + 3 deprecated aliases:

| Canonical (v2.4.0+) | Legacy alias (v2.3.0-) |
|--------------------|------------------------|
| `sct_class` | `class` (DEPRECATED) |
| `classification_confidence` | `confidence` (DEPRECATED) |
| `reviewer_action` | `required_next_action` (DEPRECATED) |
| `document_type_code` | (NEW) |
| `rate_basis_code` | (NEW) |
| `gate_result` | (NEW) |
| `type_b_rule_source` | (kept, now in `required`) |
| `evidence_status` | (kept) |
| `sct_code` | (kept) |

Backward compatibility: every v2.3.0 client still receives legacy field names; new clients can rely on canonical names.

## 7. GPT Instructions Patch (Phase 6)

`gpts/GPT_INSTRUCTIONS_SCT_ONTOLOGY_ROUTER.md` v1.0 → v1.1.

New sections:
- §0B 9 Canonical Line_Audit Fields (table)
- §0C gate_result Rules (PASS / AMBER / ZERO semantics)
- §0D Final PASS Blockers (5 conditions)
- §0E Knowledge Fallback Policy

## 8. Constraints Honored

- ✓ **Read-only / dry-run**: no mutation endpoints
- ✓ **Masked**: `maskText()` redacts PHONE/EMAIL in all responses
- ✓ **No raw contract rate**: `/dry-run/rate-lookup` returns `MATCH/PARTIAL/MISSING/CONFLICT` status only
- ✓ **OpenAPI ↔ Worker route alignment**: 9 routes match between worker.js `ROUTES` map and OpenAPI `paths`
- ✓ **Backward compat**: all v2.3.0 fields preserved as aliases

## 9. Out of Scope (Verified)

- ❌ Raw contract rate disclosure
- ❌ Raw BL/BOE/TRN/container/shipment/person/email/approval text in public payloads
- ❌ ERP/TMS/WMS/payment/invoice approval execution
- ❌ Reclassifying true Customs Clearance/Duty/BOE Fee as Inspection
- ❌ Final PASS without final subtotal before VAT

## 10. Known Limitations / Next Steps

- Auth: keep `NO_AUTH_DEV` mode for the current GPT Builder workflow. Do not run `wrangler secret put SCT_ACTION_API_KEY` for this operating mode.
- GPTS Builder schema: keep `openapi/hvdc_sct_ontology_actions.noauth.yaml` in ChatGPT Builder. Do not switch to `apikey.yaml` for the current workflow.
- Phase 7 spec items remain as documentation reference; no code change in this SWARM batch (Phase 7 nominal v2.6.0 reserved for future regression-only release).

## 10A. No-Auth Operations Verification (2026-06-08)

Decision: API-key mode is not enabled. The current operating mode remains no-auth / read-only / dry-run.

Current-session verification:

| Check | Result |
|-------|--------|
| Worker `/health` | PASS: `status=OK`, `package_version=HVDC-SCT-ONTOLOGY-GPT-ACTIONS-REST-v2.4.0`, `supported_route_count=9` |
| OpenAPI no-auth paths vs live `/health` routes | PASS: 9 schema paths match 9 live routes |
| `/ontology/resolve` | PASS: no-auth response, `auth_mode=NO_AUTH_DEV` |
| `/ontology/explain` | PASS: no-auth response, `auth_mode=NO_AUTH_DEV` |
| `/ontology/evidence-map` | PASS: no-auth response, `MATCHED_EXACT`, `auth_mode=NO_AUTH_DEV` |
| `/ontology/gate-check` | PASS: no-auth response, `verdict=ZERO`, `pass_allowed=false`, `auth_mode=NO_AUTH_DEV` |
| `/ontology/crosswalk` | PASS: no-auth response, 2 crosswalk items, `auth_mode=NO_AUTH_DEV` |
| `/ontology/audit-trace` | PASS: no-auth response, masked dry-run trace generated, `auth_mode=NO_AUTH_DEV` |
| `/dry-run/validate` | PASS: no-auth response, `verdict=ZERO`, `auth_mode=NO_AUTH_DEV` |
| `/dry-run/type-b-classify` | PASS: no-auth response, `auth_mode=NO_AUTH_DEV` |
| `/dry-run/rate-lookup` | PASS: no-auth response, no `raw_rate` field exposed, `auth_mode=NO_AUTH_DEV` |

Local limitation:

- `bash tests/curl_smoke_tests.sh` was not used as the final proof because this Windows session hit CRLF handling first, then the environment lacked `jq`. The equivalent route checks above were executed with PowerShell direct HTTP calls.
- GPT Builder preview UI was verified by user-provided debug log: `/ontology/resolve` returned HTTP 200 dry-run, `ACTION_CALLED: YES`, and `SCT_ONTOLOGY_USED: YES` for `Delivery Order Fee` and `Terminal Handling Charge - Jebel Ali`.

## 11. References

- Design: `docs/SCT_ONTOLOGY_IMPROVEMENT_SPEC.md`
- Plan: `docs/SCT_ONTOLOGY_IMPROVEMENT_EXECUTION_PLAN.md`
- plan.md (atomic plan, approved 2026-06-08)
- Source design doc: `SCT_Ontology_Improvement_Plan_DocumentType_RateBasis_CustomsInspection_Override.docx`
- PR #1 (Phase 4): https://github.com/macho715/sct_action/pull/1
- PR (Phase 5+6+7 SWARM): https://github.com/macho715/sct_action/pull/2
