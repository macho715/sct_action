# Graph Report - C:\Users\jichu\Downloads\HVDC_SCT_ONTOLOGY_GPT_ACTIONS_FULL_v1_0\HVDC_SCT_ONTOLOGY_GPT_ACTIONS_FULL_v1_0  (2026-06-08)

## Corpus Check
- Corpus is ~21,472 words - fits in a single context window. You may not need a graph.

## Summary
- 211 nodes · 260 edges · 23 communities (21 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d51e062`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Gate Check and PASS Control|Gate Check and PASS Control]]
- [[_COMMUNITY_OpenAPI and Action Routes|OpenAPI and Action Routes]]
- [[_COMMUNITY_OpenAPI and Action Routes|OpenAPI and Action Routes]]
- [[_COMMUNITY_SCT Ontology Resolver|SCT Ontology Resolver]]
- [[_COMMUNITY_OpenAPI and Action Routes|OpenAPI and Action Routes]]
- [[_COMMUNITY_SCT Ontology Resolver|SCT Ontology Resolver]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_Regression and Smoke Tests|Regression and Smoke Tests]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_Evidence Map and Validation|Evidence Map and Validation]]
- [[_COMMUNITY_SCT Ontology Resolver|SCT Ontology Resolver]]
- [[_COMMUNITY_SCT Ontology Resolver|SCT Ontology Resolver]]
- [[_COMMUNITY_SCT Ontology Resolver|SCT Ontology Resolver]]
- [[_COMMUNITY_SCT Ontology Resolver|SCT Ontology Resolver]]
- [[_COMMUNITY_Regression and Smoke Tests|Regression and Smoke Tests]]
- [[_COMMUNITY_Regression and Smoke Tests|Regression and Smoke Tests]]
- [[_COMMUNITY_Regression and Smoke Tests|Regression and Smoke Tests]]
- [[_COMMUNITY_Regression and Smoke Tests|Regression and Smoke Tests]]

## God Nodes (most connected - your core abstractions)
1. `worker.js` - 45 edges
2. `_check_imports.mjs` - 10 edges
3. `ontology.js` - 9 edges
4. `fetch()` - 9 edges
5. `evidence.js` - 8 edges
6. `errorPayload()` - 8 edges
7. `SCT Ontology Improvement Execution Plan` - 8 edges
8. `getEvidenceRequirements()` - 7 edges
9. `rate-lookup.payload.json` - 7 edges
10. `validateEvidence()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `commands_deploy_openapi_worker_route_alignment` --rationale_for--> `readme_install_no_route_404_failure`  [EXTRACTED]
   → 
- `claude_read_only_dry_run_principle` --semantically_similar_to--> `docs_sct_ontology_improvement_spec_masked_non_mutating_contract`  [EXTRACTED] [semantically similar]
   → 
- `docs_sct_ontology_improvement_execution_plan_execution_plan` --semantically_similar_to--> `specs_2026_06_08_sct_ontology_improvement_design_phased_release_plan`  [EXTRACTED] [semantically similar]
   → 
- `docs_sct_ontology_improvement_execution_plan_customs_inspection_override` --semantically_similar_to--> `converted_sct_ontology_improvement_plan_documenttype_ratebasis_customsinspection_override_2bfa3d89_docx_improvement_plan`  [EXTRACTED] [semantically similar]
   → 
- `docs_sct_ontology_improvement_spec_api_contract` --conceptually_related_to--> `gpts_gpt_instructions_sct_ontology_router_mandatory_action_router`  [EXTRACTED]
   → 
- `specs_2026_06_08_sct_ontology_improvement_design_phased_release_plan` --semantically_similar_to--> `plan_seven_phase_release_strategy`  [EXTRACTED] [semantically similar]
   → 
- `openapi_hvdc_sct_ontology_actions_apikey_apikey_schema` --semantically_similar_to--> `openapi_hvdc_sct_ontology_actions_noauth_noauth_schema`  [EXTRACTED] [semantically similar]
   → 

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Action Route Alignment Surface** — commands_deploy_openapi_worker_route_alignment, docs_route_decision_root_action_paths, openapi_hvdc_sct_ontology_actions_noauth_operation_set, gpts_gpt_instructions_sct_ontology_router_mandatory_action_router [INFERRED 0.85]
- **Ontology Improvement Core Concepts** — docs_sct_ontology_improvement_execution_plan_documenttype, docs_sct_ontology_improvement_execution_plan_ratebasis, docs_sct_ontology_improvement_execution_plan_customs_inspection_override, docs_sct_ontology_improvement_execution_plan_final_pass_blockers [EXTRACTED 1.00]
- **Phased Delivery Chain** — docs_sct_ontology_improvement_execution_plan_execution_plan, specs_2026_06_08_sct_ontology_improvement_design_phased_release_plan, plan_seven_phase_release_strategy [INFERRED 0.95]

## Communities (23 total, 2 thin omitted)

### Community 0 - "Gate Check and PASS Control"
Cohesion: 0.11
Nodes (32): addMeta(), checkAuth(), costCenterHintFromTypeB(), crosswalkLine(), documentTypeFromSctCode(), errorPayload(), evaluateGate(), fetch() (+24 more)

### Community 1 - "OpenAPI and Action Routes"
Cohesion: 0.14
Nodes (18): Converted DOCX Improvement Plan, Line Audit Propagation, MCP Alias Paths, Root Action Paths, Customs Inspection Override, DocumentType Ontology Nodes, SCT Ontology Improvement Execution Plan, Final PASS Blockers (+10 more)

### Community 2 - "OpenAPI and Action Routes"
Cohesion: 0.16
Nodes (15): HVDC SCT Ontology GPT Actions, Read Only Dry Run Principle, Cloudflare Worker Deploy Command, OpenAPI Worker Route Alignment, YAML Parse Validation, Nine Action Routes, Worker Smoke Test, Masked Non Mutating Contract (+7 more)

### Community 3 - "SCT Ontology Resolver"
Cohesion: 0.22
Nodes (11): explainNode(), resolveTerm(), CHARGE_TYPE, DOC_TYPE, RATE_BASIS, RAW, explainOntologyNode(), resolveDocumentType() (+3 more)

### Community 4 - "OpenAPI and Action Routes"
Cohesion: 0.14
Nodes (13): checks, file_count, node_check_detail, node_syntax_check, openapi_apikey_yaml_parse, openapi_noauth_yaml_parse, created_utc, files (+5 more)

### Community 5 - "SCT Ontology Resolver"
Cohesion: 0.14
Nodes (13): context, module, user_intent, ontology_version, terms, context, currency, draft_invoice_ref_masked (+5 more)

### Community 6 - "Evidence Map and Validation"
Cohesion: 0.36
Nodes (7): handleEvidenceMap(), DEFAULT_RULE, EVIDENCE_RULE_KEYS, findRule(), getEvidenceRequirements(), validateEvidence(), cases

### Community 7 - "Evidence Map and Validation"
Cohesion: 0.25
Nodes (8): context, currency, shipment_no_masked, evidence_status, final_subtotal_status, module, rate_basis_status, sct_codes

### Community 8 - "Regression and Smoke Tests"
Cohesion: 0.25
Nodes (7): amount, charge, currency, route_key_masked, sct_code, type_b, unit

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (6): hooks, PostToolUse, permissions, allow, ask, deny

### Community 10 - "Evidence Map and Validation"
Cohesion: 0.33
Nodes (5): context, module, user_intent, provided_evidence, sct_codes

### Community 11 - "Evidence Map and Validation"
Cohesion: 0.33
Nodes (5): context, module, user_intent, provided_evidence, sct_codes

### Community 12 - "Evidence Map and Validation"
Cohesion: 0.33
Nodes (5): context, module, user_intent, provided_evidence, sct_codes

### Community 13 - "Evidence Map and Validation"
Cohesion: 0.33
Nodes (5): context, module, user_intent, provided_evidence, sct_codes

### Community 14 - "Evidence Map and Validation"
Cohesion: 0.33
Nodes (5): context, currency, module, shipment_no_masked, sct_codes

### Community 15 - "SCT Ontology Resolver"
Cohesion: 0.33
Nodes (5): context, module, user_intent, ontology_version, terms

### Community 16 - "SCT Ontology Resolver"
Cohesion: 0.33
Nodes (5): context, module, user_intent, ontology_version, terms

### Community 17 - "SCT Ontology Resolver"
Cohesion: 0.33
Nodes (5): context, module, user_intent, ontology_version, terms

### Community 18 - "SCT Ontology Resolver"
Cohesion: 0.33
Nodes (5): context, module, user_intent, ontology_version, terms

### Community 19 - "Regression and Smoke Tests"
Cohesion: 0.40
Nodes (4): context, module, user_intent, lines

### Community 20 - "Regression and Smoke Tests"
Cohesion: 0.40
Nodes (4): context, module, user_intent, lines

## Knowledge Gaps
- **101 isolated node(s):** `allow`, `deny`, `ask`, `PostToolUse`, `DEFAULT_RULE` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **How does resolveSctOntologyTerm connect to evidence-map and gate-check?**
  _Trace the primary GPT Action validation flow._
- **Which files define the read-only dry-run privacy contract?**
  _Audit the safety boundary across docs, schema, and Worker code._
- **What changed across Phase 1 to Phase 7?**
  _Review the phased delivery and regression scope._