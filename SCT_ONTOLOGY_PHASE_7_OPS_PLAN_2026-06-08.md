# SCT Ontology Phase 7 Operations Plan

## Phase 1: Business Review

### 1.1 Problem Definition

Current state: Phase 1-7 SWARM outputs are implemented, committed, deployed, and documented, and the operating mode will remain no-auth for GPT Builder use.

Target state: keep the no-auth GPT Builder schema, complete deployment report review, and preserve the read-only dry-run contract without changing production authentication.

Impact scope:

- Worker runtime: `https://hvdc-ontology-chatgpt-app.mscho715.workers.dev`
- OpenAPI schemas: 2 files
- GPTS instruction surface: 1 file
- Deployment evidence report: 1 file
- External user-facing behavior: GPT Actions route mapping and authentication mode

### 1.2 Options

| Option | Description | Effort (days) | Risk | Cost (AED) |
|---|---|---:|---|---:|
| A | Documentation-only closeout. Keep no-auth schema in GPT Builder and only review the deployment report. | 0.25 | Low. No production auth change. | 0 |
| B | Controlled production mode. Add `SCT_ACTION_API_KEY`, switch GPT Builder to API-key schema, then rerun live smoke tests. | 0.5 | Medium. GPTS action auth can fail if key/header is misconfigured. | 0 |
| C | Full operations hardening. Do Option B plus add rollback notes, post-deploy checklist, and issue log updates. | 1.0 | Medium. More files touched, but better audit trail. | 0 |

### 1.3 Recommendation

Recommend Option A because the user explicitly decided not to switch to API-key mode.

Reason: current GPT Builder calls are already using the no-auth schema successfully, and keeping no-auth avoids an authentication failure mode.

Fallback: if GPT Builder schema drift is detected, re-paste `openapi/hvdc_sct_ontology_actions.noauth.yaml` and rerun preview calls.

### 1.4 Approval Request

- [x] Phase 1 approval: proceed with Option A, keep no-auth mode, review deployment evidence, and avoid API-key production-mode transition.

## Approval Boundary

Do not execute `wrangler secret put SCT_ACTION_API_KEY`, switch to the API-key schema, or modify production auth behavior.

After approval, Phase 2 must include:

- Mermaid module flow.
- File change list.
- Dependency order.
- Test strategy.
- Rollback path.

## Phase 2: Engineering Review

### 2.1 Mermaid Module Flow

```mermaid
graph TD
  GPTS[GPT Builder Action] --> Schema[No-auth OpenAPI schema]
  Schema --> Worker[Cloudflare Worker routes]
  Worker --> Resolve[/ontology/resolve]
  Worker --> Evidence[/ontology/evidence-map]
  Worker --> Gate[/ontology/gate-check]
  Worker --> LineAudit[Line_Audit augmentation]
  Worker --> AuditTrace[Masked audit trace]
  Tests[Live smoke tests] --> Worker
  Report[Deployment report] --> Tests
```

### 2.2 File Change List

| File | Change type | Description |
|---|---|---|
| `SCT_ONTOLOGY_PHASE_7_OPS_PLAN_2026-06-08.md` | modify | Record approval, engineering plan, validation path, and rollback path. |
| `docs/superpowers/reports/2026-06-08-sct-ontology-deployment.md` | review/update if needed | Confirm live deployment evidence, auth mode, schema version, and route count. |
| `openapi/hvdc_sct_ontology_actions.noauth.yaml` | external use | Keep this schema in GPT Builder. Re-paste only if GPT Builder schema drift is detected. |
| `openapi/hvdc_sct_ontology_actions.apikey.yaml` | no change | Keep as archived alternative only. Do not use for the current GPT Builder setup. |
| `gpts/GPT_INSTRUCTIONS_SCT_ONTOLOGY_ROUTER.md` | review/update if needed | Confirm GPTS instructions still require ACTION_CALLED / SCT_ONTOLOGY_USED and read-only dry-run behavior. |

### 2.3 Dependency And Execution Order

1. Review deployment report and current Worker health.
2. Confirm `openapi/hvdc_sct_ontology_actions.noauth.yaml` matches the live Worker routes.
3. Keep GPT Builder configured with the no-auth schema.
4. Run live smoke tests for resolve, evidence-map, gate-check, rate lookup, and Line_Audit.
5. Run GPT Builder preview calls and confirm Action debug logs show successful endpoint calls.
6. Update the deployment report with the no-auth decision and verification result.

Parallel-safe work:

- Report review can run while schema route alignment is checked.
- GPT instruction review can run while live health is checked.

Serial work:

- Do not change GPT Builder authentication mode during this plan.
- Final PASS validation must happen after GPT Builder preview calls succeed in no-auth mode.

### 2.4 Test Strategy

Unit tests:

- `node --check cloudflare_worker/worker.js`
- `node --check cloudflare_worker/lib/gate.js`
- Existing local gate and evidence tests if runtime dependencies are available.

Integration tests:

- `bash tests/curl_smoke_tests.sh` against the live Worker.
- Recheck the 9 route surfaces: resolve, explain, evidence-map, gate-check, crosswalk, audit-trace, validate, type-b-classify, rate-lookup.

GPTS manual tests:

- In GPT Builder preview, call `resolveSctOntologyTerm` with `Delivery Order Fee` and `Terminal Handling Charge - Jebel Ali`.
- Call `mapRequiredEvidence` for `SCT.CHARGE.MASTER_DO` and `SCT.CHARGE.THC`.
- Call `checkSctOntologyGate` with missing final subtotal and confirm `PASS` is blocked.

Acceptance criteria:

- No-auth GPTS calls return 2xx for valid GPTS preview calls.
- API-key mode is not enabled and is not part of acceptance for this plan.
- No response exposes raw contract rates.
- PHONE and EMAIL redaction remains active.
- GPTS output still reports `ACTION_CALLED` and `SCT_ONTOLOGY_USED`.

### 2.5 Risks And Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Accidental API-key schema use | GPT Actions fail with auth error. | Keep GPT Builder on `hvdc_sct_ontology_actions.noauth.yaml`. |
| Secret setup attempted unnecessarily | Unneeded operational complexity. | Do not run `wrangler secret put SCT_ACTION_API_KEY` for this plan. |
| Schema route drift | GPT Builder exposes stale or missing operations. | Compare OpenAPI paths with Worker `/health` supported routes. |
| Sensitive output regression | Contract rates or identifiers leak. | Run masked-output checks before reporting PASS. |
| GPTS manual state mismatch | User sees old schema despite local files being correct. | Use GPT Builder preview debug logs as the final user-facing proof layer. |

### 2.6 Rollback Path

1. Re-paste `openapi/hvdc_sct_ontology_actions.noauth.yaml` into GPT Builder if schema drift is found.
2. Keep Worker deployed in read-only dry-run mode.
3. Do not add or rotate `SCT_ACTION_API_KEY` for this plan.
4. Record the no-auth decision in the deployment report.

### 2.7 Execution Result

- [x] Phase 2 approval: execute no-auth verification and deployment report update.

Executed on 2026-06-08:

- Kept API-key mode disabled.
- Did not run `wrangler secret put SCT_ACTION_API_KEY`.
- Confirmed live Worker health reports 9 supported routes and `NO_AUTH_DEV` route responses.
- Confirmed `openapi/hvdc_sct_ontology_actions.noauth.yaml` has the same 9 paths as live Worker `/health`.
- Direct live calls passed for resolve, explain, evidence-map, gate-check, crosswalk, audit-trace, validate, type-b-classify, and rate-lookup.
- Confirmed rate lookup response does not expose a `raw_rate` field.

Remaining manual layer:

- GPT Builder preview UI was verified by user-provided debug log. The preview called `/ontology/resolve`, received HTTP 200 dry-run, and returned `ACTION_CALLED: YES` / `SCT_ONTOLOGY_USED: YES` for Delivery Order Fee and Terminal Handling Charge - Jebel Ali.
