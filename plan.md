# SCT Ontology Improvement — Implementation Plan

> **Date**: 2026-06-08
> **Source Design**: `docs/superpowers/specs/2026-06-08-sct-ontology-improvement-design.md`
> **BRAINSTORM**: HARD-GATE 통과, 사용자 승인 완료
> **Strategy**: Option A — 7 Phased Releases (each independently revertible)

## Goal

Extend the HVDC SCT Ontology GPT Actions Worker to support:
1. `DocumentType` ontology nodes (BOE, CI/PL, POD, DO, STORAGE_INVOICE, etc.)
2. `RateBasis` ontology nodes (AT_COST, AS_PER_OFFER, TARIFF, MISSING, CONFLICT)
3. Customs Inspection override (TYPE-B `Inspection` beats generic Customs)
4. Evidence map (charge→doc→rate→evidence relations)
5. Gate-check blockers (subtotal, rate-basis, HS)
6. Line_Audit field mapping
7. OpenAPI & GPTS Instructions alignment
8. Regression test coverage

**Constraints**: read-only, dry-run, masked, non-mutating (NFR-001~008).

## Success Criteria (mapped to SPEC §SC-001~015)

See design doc §13 for full mapping. All 15 SC must be GREEN by Phase 7.

## Tasks (7 phases, 7 commits, 7 wrangler deploys)

### Phase 0: Baseline Freeze (no deploy)

- [ ] Capture current GPTS preview evidence (resolveSctOntologyTerm, mapRequiredEvidence, checkSctOntologyGate)
- [ ] Document baseline unmapped/over-classified terms
- [ ] Snapshot current OpenAPI schema and Worker route list
- [ ] Create `docs/superpowers/baselines/2026-06-08-baseline-gap.md`
- [ ] Golden input term set: BOE, CI/PL, POD, AT COST, AS PER OFFER, CUSTOMS INSPECTION FEE, BILL OF ENTRY FEE
- **Deliverable**: Baseline gap register
- **Commit**: `chore: Phase 0 baseline freeze + gap register`
- **No deploy** (docs only)

### Phase 1: v2.0.0 — Ontology Seed

- [ ] Create `cloudflare_worker/lib/ontology-data.js`
  - `DOC_TYPE` constant (5 nodes: BOE, CI_PL, POD, DO, STORAGE_INVOICE)
  - `RATE_BASIS` constant (5 nodes: AT_COST, AS_PER_OFFER, TARIFF, MISSING, CONFLICT)
  - `CHARGE_TYPE` constant (9 nodes, existing + CUSTOMS_INSPECTION)
- [ ] Create `cloudflare_worker/lib/ontology.js`
  - `resolveTerm(input)` — synonym matching with confidence
  - `explainNode(sctCode)` — node explanation
- [ ] Update `cloudflare_worker/worker.js` to import and delegate to `lib/ontology.js`
- [ ] Add 5 test payloads: `tests/resolve-{boe,cipl,pod,at-cost,as-per-offer}.payload.json`
- [ ] Update `tests/curl_smoke_tests.sh` to invoke new payloads
- [ ] Verify: `node --check cloudflare_worker/worker.js` → 0 errors
- [ ] **Revert checklist**: existing 5 payloads (resolve, evidence-map, gate-check, type-b, rate-lookup) must still pass
- **Tests**:
  - TC-DOC-001: BOE → `SCT.DOC.BOE`, confidence ≥ 0.85
  - TC-DOC-002: CI/PL → `SCT.DOC.CI_PL`
  - TC-DOC-003: POD → `SCT.DOC.POD`
  - TC-RATE-001: AT COST → `SCT.RATE.AT_COST`, AMBER on no support
  - TC-RATE-002: AS PER OFFER → `SCT.RATE.AS_PER_OFFER`, AMBER on no approval
- **Deploy**: `wrangler deploy` (v2.0.0)
- **Commit**: `feat(phase-1): v2.0.0 ontology seed (DocumentType + RateBasis)`

### Phase 2: v2.1.0 — Customs Inspection Override

- [ ] Create `cloudflare_worker/lib/type-b-classifier.js`
  - `classifyTypeB(description)` — priority: OVERRIDE > KEYWORD > FALLBACK
  - `crosswalkSctToTypeB(sctCode)` — SCT code to TYPE-B
- [ ] Update `worker.js` to import and delegate
- [ ] Add 2 test payloads: `tests/classify-{inspection-fee,boe-fee}.payload.json`
- [ ] Verify override beats generic Customs
- [ ] Verify regression: DO, THC, STROAGE, INLAND, 기존 Customs unchanged
- **Tests**:
  - TC-OVR-001: CUSTOMS INSPECTION FEE → TYPE-B `Inspection`, rule_source=`OVERRIDE`
  - TC-OVR-002: BILL OF ENTRY FEE → TYPE-B `Customs`, rule_source=`FALLBACK_KEYWORD`, sct_code=`SCT.CHARGE.BOE_FEE`
- **Deploy**: `wrangler deploy` (v2.1.0)
- **Commit**: `feat(phase-2): v2.1.0 Customs Inspection override priority`

### Phase 3: v2.2.0 — Evidence Map

- [ ] Create `cloudflare_worker/lib/evidence.js`
  - `mapRequiredEvidence(sctCodes)` — returns required evidence list + status
  - `validateEvidence(pack)` — checks evidence status rules
- [ ] Add 4 test payloads: `tests/evidence-{customs,inspection,at-cost,as-per-offer}.payload.json`
- [ ] Update worker.js to delegate
- **Tests**:
  - Customs: BOE + broker invoice + CI/PL + approval required; missing → PARTIAL/MISSING
  - Inspection: inspection approval + broker invoice + BOE remark; missing → PARTIAL
  - AT COST: vendor invoice + approval + amount match; missing → AMBER
  - AS PER OFFER: offer approval + client approval + amount match; missing → AMBER
- **Deploy**: `wrangler deploy` (v2.2.0)
- **Commit**: `feat(phase-3): v2.2.0 evidence map (charge-doc-rate relations)`

### Phase 4: v2.3.0 — Gate Check

- [ ] Create `cloudflare_worker/lib/gate.js`
  - `checkGate({subtotal, rateBasis, evidenceGaps, typeBTieOut})` — returns PASS/AMBER/ZERO
- [ ] Add 1 test payload: `tests/gate-missing-subtotal.payload.json`
- **Tests**:
  - TC-GATE-001: missing final subtotal → `pass_allowed=false`, gate_result=`ZERO`
  - Rate basis MISSING or CONFLICT → ZERO
  - HS/UAE, DEM/DET, OOG/stowage, final recon gaps → ZERO
- **Deploy**: `wrangler deploy` (v2.3.0)
- **Commit**: `feat(phase-4): v2.3.0 gate-check blockers (subtotal, rate-basis, HS)`

### Phase 5: v2.4.0 — Line_Audit Mapping

- [ ] Update `cloudflare_worker/worker.js` `handleResolve` output to include all 9 required fields:
  - `sct_code`, `sct_class`, `document_type_code`, `rate_basis_code`, `type_b_rule_source`, `classification_confidence`, `evidence_status`, `gate_result`, `reviewer_action`
- [ ] Add 1 integration test payload
- [ ] Verify all 9 fields present in response
- **Deploy**: `wrangler deploy` (v2.4.0)
- **Commit**: `feat(phase-5): v2.4.0 Line_Audit field mapping`

### Phase 6: v2.5.0 — OpenAPI & GPTS Alignment

- [ ] Update `openapi/hvdc_sct_ontology_actions.noauth.yaml`
  - 9 operation IDs match (resolveSctOntologyTerm, ..., dryRunRateLookup)
  - Server URL: `https://hvdc-ontology-chatgpt-app.mscho715.workers.dev`
  - Examples include DocumentType, RateBasis, Customs Inspection
- [ ] Update `openapi/hvdc_sct_ontology_actions.apikey.yaml` (mirror)
- [ ] Update `gpts/GPT_INSTRUCTIONS_SCT_ONTOLOGY_ROUTER.md`
  - Forbid final PASS if Action fails
  - Forbid `SCT_ONTOLOGY_USED: YES` on 404/500
  - Allow Knowledge fallback only for AMBER/ZERO
- [ ] Verify operation ID alignment: worker.js ROUTES == OpenAPI paths
- [ ] Verify no raw rate/shipment ID in any example
- **Deploy**: `wrangler deploy` (v2.5.0)
- **Commit**: `feat(phase-6): v2.5.0 OpenAPI schema + GPT Instructions alignment`

### Phase 7: v2.6.0 — Regression & Deploy

- [ ] Run local: `node --check cloudflare_worker/worker.js` → 0 errors
- [ ] Run live: 9/9 routes HTTP 200 via `bash tests/curl_smoke_tests.sh`
- [ ] Run 8 Golden TC + 5 regression TC (DO, THC, STROAGE, INLAND, 기존 Customs)
- [ ] GPTS preview verification: `ACTION_CALLED: YES`, `SCT_ONTOLOGY_USED: YES`
- [ ] Generate `docs/superpowers/reports/2026-06-08-deployment-report.md`
- [ ] Final wrangler deploy (v2.6.0)
- **Commit**: `chore(phase-7): v2.6.0 regression test + deployment report`

## Risk Mitigation (top 5)

| Risk | Phase | Mitigation | Rollback |
|------|-------|-----------|----------|
| Ontology changes break existing resolve | 1 | Only ADD synonyms, preserve existing mappings | `git revert HEAD; wrangler deploy` |
| Override priority order wrong | 2 | 2 dedicated TC (TC-OVR-001, 002) | Revert v2.1.0 |
| Gate blocks existing PASS cases | 4 | Baseline gap analysis before Phase 4 | Revert v2.3.0 |
| OpenAPI drift from worker.js | 6 | Manual diff of ROUTES vs OpenAPI paths | Sync revert |
| Raw rate/shipment ID leaks | 1-6 | Audit review of all response fields (NFR-003) | Revert + rotate |

## Definition of Done (per EXECUTION_PLAN §DoD)

- [ ] BOE, CI/PL, POD resolve as DocumentType (Phase 1)
- [ ] AT COST, AS PER OFFER resolve as RateBasis (Phase 1)
- [ ] CUSTOMS INSPECTION FEE → TYPE-B `Inspection` (Phase 2)
- [ ] BILL OF ENTRY FEE → TYPE-B `Customs` + BOE evidence (Phase 2-3)
- [ ] Line_Audit retains 9 required fields (Phase 5)
- [ ] Final subtotal missing blocks final PASS (Phase 4)
- [ ] ROUNDUP(2) disclosure preserved (N/A for this scope, but verified in regression)
- [ ] Regression tests pass for DO/Customs/STROAGE/THC/INLAND (Phase 7)

## Test Coverage Matrix

| Phase | Golden TC | Regression TC | Total |
|-------|-----------|---------------|-------|
| 1 | 5 (TC-DOC-001/002/003, TC-RATE-001/002) | 5 (existing) | 10 |
| 2 | 2 (TC-OVR-001/002) | 5 (Phase 1) | 7 |
| 3 | 4 (evidence variants) | 7 (Phase 2) | 11 |
| 4 | 1 (TC-GATE-001) | 11 (Phase 3) | 12 |
| 5 | 1 (Line_Audit integration) | 12 (Phase 4) | 13 |
| 6 | 1 (OpenAPI sync) | 13 (Phase 5) | 14 |
| 7 | All 8 Golden TC | All 14 | 15+ |

## Commit Strategy

7 atomic commits (one per phase), each deployable independently.

## Deploy Strategy

7 wrangler deploys, each manually approved (per settings.local.json: `wrangler deploy` is in `ask` list).

## Rollback Strategy

- Each phase: `git revert HEAD; wrangler deploy`
- Worst case (Phase 7): revert 7 commits, redeploy v1.0 baseline

## Out of Scope (verified)

- ❌ Raw contract rate disclosure
- ❌ Raw BL/BOE/TRN/container/shipment/person/email/approval text
- ❌ ERP/TMS/WMS/payment/invoice approval execution
- ❌ Reclassifying true Customs Clearance/Duty/BOE Fee as Inspection
- ❌ Final PASS without final subtotal before VAT

## References

- Design: `docs/superpowers/specs/2026-06-08-sct-ontology-improvement-design.md`
- Spec: `docs/SCT_ONTOLOGY_IMPROVEMENT_SPEC.md`
- Plan: `docs/SCT_ONTOLOGY_IMPROVEMENT_EXECUTION_PLAN.md`
- Global rules: `~/.claude/CLAUDE.md` (HVDC SCM domain)
- Project rules: `CLAUDE.md` (HVDC SCT Ontology GPT Actions)
