<!-- converted from SCT_Ontology_Improvement_Plan_DocumentType_RateBasis_CustomsInspection_Override.docx -->

SCT Ontology 개선 플랜
DocumentType + RateBasis + Customs Inspection Override Rule
대상 시스템: DSV Invoice Audit & Final Validator PRO
작성일: 2026-06-08 · 버전: v0.1 Draft · 분류: PRIVATE INTERNAL
ACTION_CALLED: YES · SCT_ONTOLOGY_USED: YES · 실행모드: Dry-run / Read-only

핵심 결론
• 현재 SCT action은 주요 ChargeType(예: MASTER DO, Customs Clearance, Storage, THC)은 잘 분류하지만, DocumentType(BOE, CI/PL, POD)과 RateBasis(AT COST, AS PER OFFER)는 미매핑으로 남는다.
• CUSTOMS INSPECTION FEE는 현재 SCT.CHARGE.CUSTOMS_CLEARANCE/TYPE-B Customs로 과분류된다. 내부 TYPE-B 우선순위와 맞추려면 ‘customs inspection → Inspection’ override rule을 최상위 priority로 둬야 한다.
• 개선 후 목표는 charge description만이 아니라 DocumentType, RateBasis, Evidence Status, Gate Result까지 Line_Audit과 TYPE-B Summary에 일관되게 전파하는 것이다.

# 1. 목적과 범위
본 문서는 DSV invoice audit workflow에서 SCT Ontology를 더 안정적으로 사용하기 위한 개선 플랜이다. 특히 DocumentType node, RateBasis node, Customs Inspection override rule을 보강하여 invoice line 분류, evidence mapping, Cost Guard, final reconciliation gate의 일관성을 높이는 것을 목표로 한다.

# 2. 현재 Gap 진단
Dry-run SCT resolve 결과, DocumentType/RateBasis 관련 입력어가 SCT.UNKNOWN으로 확인되었다. 또한 Customs Inspection은 내부 우선순위상 Inspection이어야 하나 action mapping에서는 Customs Clearance로 흡수되는 경향이 확인되었다.

# 3. Target Ontology 설계
## 3.1 DocumentType nodes

## 3.2 RateBasis nodes

# 4. Customs Inspection Override Rule
핵심 변경은 ‘customs inspection’이 포함된 모든 charge description을 Customs보다 먼저 Inspection으로 확정하는 것이다. 이 override는 TYPE-B classification priority의 1순위로 적용해야 하며, SCT resolver가 Customs Clearance로 반환하더라도 downstream validator에서 재분류한다.

권장 pseudo-rule:
def classify_type_b(description: str, resolved_sct: str | None = None) -> str:
    d = normalize(description)

    # Priority override: Inspection must beat Customs
    if "customs inspection" in d or ("inspection" in d and "customs" in d):
        return "Inspection"

    if any(k in d for k in ["customs clearance", "bill of entry", "boe fee",
                            "customs duty", "export customs", "customs code opening"]):
        return "Customs"

    if any(k in d for k in ["master do", "house do", "delivery order", "do fee"]):
        return "DO"

    if any(k in d for k in ["transport", "truck", "inland", "fb from", "cipca", "mosb"]):
        return "INLAND"

    if any(k in d for k in ["terminal handling", "port handling", "tsc", "discharging"]):
        return "THC"

    if "detention" in d:
        return "Detention"

    if "storage" in d or "stroage" in d:
        return "STROAGE"

    return "OTHERS"
# 5. Evidence Map 변경안

# 6. Data Model / Schema 변경
Line_Audit와 7-sheet submission pack에 다음 필드를 추가 또는 표준화한다.

# 7. 구현 로드맵

# 8. Golden Test Cases

# 9. DLP / 보안 원칙
본 개선은 ontology/rule lookup, evidence requirement mapping, dry-run gate check 목적이다. 계약 raw rate, BL/BOE/container/TRN/개인정보는 action payload와 출력 문서에 원문 노출하지 않는다.

# 10. Definition of Done
☐ BOE, CI/PL, POD가 DocumentType으로 resolve된다.
☐ AT COST, AS PER OFFER가 RateBasis로 resolve되고 supporting evidence requirement가 자동 산출된다.
☐ CUSTOMS INSPECTION FEE는 action 결과와 무관하게 Line_Audit TYPE-B = Inspection으로 override된다.
☐ BILL OF ENTRY FEE는 Customs로 분류되고 BOE evidence requirement를 갖는다.
☐ Line_Audit에 sct_code, document_type_code, rate_basis_code, evidence_status, gate_result가 추적 가능하게 남는다.
☐ Final Subtotal Before VAT가 없으면 최종 PASS가 차단된다.
☐ ROUNDUP(2자리) 미적용 결과에는 disclosure가 포함된다.
☐ Regression test에서 기존 DO/Customs/STROAGE/THC/INLAND 분류가 깨지지 않는다.
# Appendix A. Proposed JSON Patch 예시
{
  "classes": ["DocumentType", "RateBasis"],
  "nodes": [
    {
      "sct_code": "SCT.DOC.BOE",
      "class": "DocumentType",
      "canonical_label": "Bill of Entry / Customs Declaration",
      "synonyms": ["BOE", "Bill of Entry", "Customs Declaration", "DEC NO"],
      "required_for": ["SCT.CHARGE.CUSTOMS_CLEARANCE", "SCT.CHARGE.CUSTOMS_DUTY", "SCT.CHARGE.BOE_FEE"],
      "risk_default": "HIGH"
    },
    {
      "sct_code": "SCT.RATE.AT_COST",
      "class": "RateBasis",
      "canonical_label": "At Cost / Actuals",
      "synonyms": ["AT COST", "as per actuals", "at actuals"],
      "required_evidence": ["SCT.DOC.VENDOR_INVOICE", "SCT.DOC.APPROVAL"],
      "gate_default": "AMBER"
    },
    {
      "sct_code": "SCT.CHARGE.CUSTOMS_INSPECTION",
      "class": "ChargeType",
      "canonical_label": "Customs Inspection Fee",
      "type_b": "Inspection",
      "priority": 1,
      "overrides": ["SCT.CHARGE.CUSTOMS_CLEARANCE"]
    }
  ]
}
# Appendix B. Validation Note
결과값은 ROUNDUP(2자리)을 반영하지 않은 값입니다. 본 플랜은 ontology/rule/evidence mapping 개선 문서이며, 실제 invoice PASS 판정은 Final Subtotal Before VAT, evidence status, rate basis, Line_Audit/TYPE-B tie-out이 모두 충족된 경우에만 가능하다.
| 구분 | 포함 범위 | 제외 범위 |
| --- | --- | --- |
| DocumentType | BOE, CI/PL, POD, DO, storage invoice, terminal invoice, approval evidence, vendor/broker invoice | 원문 BL/BOE/TRN/개인정보의 비마스킹 저장 |
| RateBasis | CONTRACT_NUMERIC, AT_COST, AS_PER_OFFER, TARIFF, ACTUALS, MISSING/CONFLICT 상태 | 계약 raw rate 노출 또는 rate table dump |
| Override Rule | CUSTOMS INSPECTION → TYPE-B Inspection 우선 적용 | Customs clearance/duty/BOE fee까지 Inspection으로 오분류 |
| Workflow | MasterData → Line_Audit → TYPE-B Summary → Final Recon 연계 | 사용자 승인 없는 ERP/TMS/WMS/결제 실행 |
| 입력 Term | 현재 Action 결과 | 위험 | 개선 방향 |
| --- | --- | --- | --- |
| DocumentType | SCT.UNKNOWN / confidence 0.35 | AMBER | SCT.DOC.* class를 seed/schema에 명시 |
| BOE | SCT.UNKNOWN / evidence missing | AMBER~ZERO 후보 | SCT.DOC.BOE + Customs evidence relation 추가 |
| CI/PL | SCT.UNKNOWN | AMBER | SCT.DOC.CI_PL + customs clearance relation 추가 |
| POD | SCT.UNKNOWN | AMBER | SCT.DOC.POD + INLAND evidence relation 추가 |
| AT COST | SCT.UNKNOWN | AMBER | SCT.RATE.AT_COST + supporting invoice 필수화 |
| AS PER OFFER | SCT.UNKNOWN | AMBER | SCT.RATE.AS_PER_OFFER + offer approval 필수화 |
| CUSTOMS INSPECTION FEE | SCT.CHARGE.CUSTOMS_CLEARANCE / TYPE-B Customs | 분류 충돌 | TYPE-B override: customs inspection → Inspection |
| BILL OF ENTRY FEE | SCT.UNKNOWN | AMBER | SCT.CHARGE.BOE_FEE 또는 SCT.DOC.BOE_FEE 정의 |
| Proposed SCT Code | Canonical Label | Synonyms | Required Evidence Link | Default Risk |
| --- | --- | --- | --- | --- |
| SCT.DOC.BOE | Bill of Entry / Customs Declaration | BOE, Bill of Entry, Customs Declaration, DEC NO | Customs Clearance, Customs Duty, BOE Fee | HIGH |
| SCT.DOC.CI_PL | Commercial Invoice & Packing List | CI/PL, CIPL, Invoice and Packing List | Customs Clearance, HS/UAE, import declaration | HIGH |
| SCT.DOC.POD | Proof of Delivery | POD, delivery proof, trip proof, delivery note | INLAND, truck appointment, delivery charge | AMBER |
| SCT.DOC.DO | Delivery Order | DO, D/O, Master DO, House DO, delivery order | DO fee, master DO fee | AMBER |
| SCT.DOC.STORAGE_INVOICE | Storage Invoice/Period Evidence | storage invoice, airport storage, storage period | STROAGE | AMBER |
| SCT.DOC.TERMINAL_INVOICE | Terminal/Port Handling Evidence | terminal invoice, port support, THC support | THC | AMBER |
| SCT.DOC.APPROVAL | Client/Offer Approval Evidence | client approval, offer approval, approval email | AS PER OFFER, AT COST | AMBER |
| SCT.DOC.VENDOR_INVOICE | Vendor/Broker Invoice | vendor invoice, broker invoice, agent invoice | AT COST, Customs, Storage, THC | HIGH |
| Proposed SCT Code | Canonical Label | Rule | PASS 가능 조건 | 기본 Gate |
| --- | --- | --- | --- | --- |
| SCT.RATE.CONTRACT_NUMERIC | Contract Numeric Rate | charge/route/unit/scope exact match | tolerance 내 + evidence clear | PASS 가능 |
| SCT.RATE.AT_COST | At Cost / Actuals | vendor/broker invoice amount 기반 | supporting invoice + amount match + approval | AMBER until supported |
| SCT.RATE.AS_PER_OFFER | As Per Offer | approved offer amount 기반 | offer approval + line amount match | AMBER until approval |
| SCT.RATE.TARIFF | Tariff / Published Schedule | terminal/customs/airport tariff 기반 | tariff ref + calculation basis | AMBER |
| SCT.RATE.MISSING | Missing Rate Basis | rate source 또는 unit 미확인 | 불가 | ZERO 후보 |
| SCT.RATE.CONFLICT | Conflicting Rate Basis | contract/offer/evidence amount 충돌 | 불가 | FAIL/ZERO |
| Priority | Condition | Target TYPE-B | SCT Code Proposal | 비고 |
| --- | --- | --- | --- | --- |
| 1 | description contains customs inspection / inspection fee | Inspection | SCT.CHARGE.CUSTOMS_INSPECTION | Customs보다 우선 |
| 2 | description contains customs clearance / import customs clearance | Customs | SCT.CHARGE.CUSTOMS_CLEARANCE | BOE/CI-PL evidence 필요 |
| 3 | description contains bill of entry / BOE fee | Customs | SCT.CHARGE.BOE_FEE + SCT.DOC.BOE | DocumentType relation 필요 |
| 4 | description contains customs duty / duty charges | Customs | SCT.CHARGE.CUSTOMS_DUTY | BOE duty amount 증빙 필요 |
| 5 | description contains SHJ customs code opening | Customs | SCT.CHARGE.CUSTOMS_CODE_OPENING | Offer approval 또는 customs support 필요 |
| TYPE-B / RateBasis | 필수 Evidence | Evidence Status Logic | Gate |
| --- | --- | --- | --- |
| Customs | BOE, broker invoice, CI/PL, customs approval evidence | BOE/CI-PL 누락 시 PARTIAL 또는 MISSING | ZERO 후보 |
| Inspection | inspection approval, broker/customs invoice, BOE remark if applicable | customs inspection line amount와 approval/offer amount 매칭 | AMBER~HIGH |
| DO | DO copy, vendor invoice, approval evidence | DO ref/amount/ship ref 매칭 | AMBER |
| STROAGE | storage invoice, storage period, tariff/approved basis | 기간/금액/승인 기준 불일치 시 CONFLICT | AMBER |
| THC | terminal invoice, port evidence, rate support | kg/unit basis와 total amount 매칭 | AMBER |
| INLAND | lane map, POD, trip evidence, approved rate basis | route/unit/scope 불일치 시 PARTIAL | AMBER |
| AT COST | vendor/broker invoice, approval evidence, amount match | source invoice amount = support amount | AMBER until matched |
| AS PER OFFER | offer approval, client approval, line amount match | offer line과 invoice line 매칭 | AMBER until matched |
| Field | Type | Source | 설명 |
| --- | --- | --- | --- |
| sct_code | text | ontology resolver | 최종 적용 SCT code |
| sct_class | enum | ontology resolver | ChargeType / DocumentType / RateBasis / RiskGate / TypeB |
| document_type_code | text | evidence mapper | SCT.DOC.BOE, SCT.DOC.CI_PL 등 |
| rate_basis_code | text | rate resolver | SCT.RATE.AT_COST, SCT.RATE.AS_PER_OFFER 등 |
| type_b_rule_source | enum | classifier | ACTION, OVERRIDE, FALLBACK_KEYWORD, MANUAL_REVIEW |
| classification_confidence | number | resolver/classifier | 0.00~1.00 |
| evidence_status | enum | evidence mapper | MATCHED_EXACT, PARTIAL, MISSING 등 |
| gate_result | enum | gate checker | PASS, PASS WITH WARNINGS, AMBER, FAIL, ZERO |
| reviewer_action | text | validator | 최종 검토 조치 |
| Phase | 작업 | 산출물 | 승인 기준 |
| --- | --- | --- | --- |
| 0. Baseline | 현재 action 결과/미매핑 term 목록 동결 | Gap register, test term set | 미매핑/과분류 재현 가능 |
| 1. Seed/Schema Patch | DocumentType/RateBasis class 및 node 추가 | sct_ontology_seed/schema patch | BOE, CI/PL, POD, AT COST, AS PER OFFER resolve 가능 |
| 2. Rule Patch | Customs Inspection override 및 BOE fee rule 추가 | TYPE-B classifier rule patch | customs inspection은 항상 Inspection |
| 3. Evidence Map Patch | DocumentType ↔ ChargeType ↔ Required Evidence relation 추가 | evidence rules CSV/JSON patch | Customs/Inspection/AT COST evidence gap 자동 산출 |
| 4. Pipeline Integration | Line_Audit 필드 및 7-sheet output mapping 업데이트 | Validator/Excel mapping patch | TYPE-B summary와 final recon 영향 없음 |
| 5. Regression Test | Golden cases + 실 invoice sample 재검증 | test result report | PASS/PASS WITH WARNINGS/AMBER/ZERO가 기준대로 산출 |
| Test ID | Input | Expected Result | Pass Criteria |
| --- | --- | --- | --- |
| TC-DOC-001 | BOE / Bill of Entry / Customs Declaration | SCT.DOC.BOE | DocumentType confidence >= 0.85 |
| TC-DOC-002 | CI/PL / CIPL / Invoice and Packing List | SCT.DOC.CI_PL | Customs evidence map에 포함 |
| TC-DOC-003 | POD / delivery proof | SCT.DOC.POD | INLAND evidence map에 포함 |
| TC-RATE-001 | AT COST / at actuals / as per actuals | SCT.RATE.AT_COST | supporting invoice 없으면 AMBER |
| TC-RATE-002 | AS PER OFFER / per offer | SCT.RATE.AS_PER_OFFER | offer approval 없으면 AMBER |
| TC-OVR-001 | CUSTOMS INSPECTION FEE | TYPE-B Inspection | Customs보다 override 우선 |
| TC-OVR-002 | BILL OF ENTRY FEE | TYPE-B Customs | SCT.CHARGE.BOE_FEE 또는 SCT.DOC.BOE relation |
| TC-GATE-001 | Final subtotal before VAT missing | ZERO/PENDING_FINAL_SUBTOTAL | 최종 PASS 금지 |
| 항목 | 정책 |
| --- | --- |
| Action mode | Read-only / dry-run 우선. 사용자 승인 전 execute 금지. |
| Rate disclosure | raw contract rate 금지. MATCH/PARTIAL/MISSING/CONFLICT status만 표시. |
| Identifier masking | Shipment=[MASKED], BL=[MASKED], BOE=[MASKED], Rate=[PRIVATE] 사용. |
| Critical gate | HS/UAE, DEM/DET, OOG/stowage, final reconciliation은 evidence gap 시 PASS 금지. |
| Rollback | Ontology seed/rule 변경은 versioned patch로 관리하고 이전 버전 fallback 가능해야 함. |