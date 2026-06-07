import { getEvidenceRequirements, validateEvidence } from "../cloudflare_worker/lib/evidence.js";

const cases = [
  { code: "SCT.CHARGE.CUSTOMS_CLEARANCE", provided: ["SCT.DOC.BOE","SCT.DOC.VENDOR_INVOICE","SCT.DOC.CI_PL","SCT.DOC.APPROVAL"], expectStatus: "MATCHED_EXACT", expectMissing: "PARTIAL", expectRule: "CUSTOMS" },
  { code: "SCT.CHARGE.BOE_FEE",            provided: ["SCT.DOC.BOE"],                                                                              expectStatus: "PARTIAL",        expectMissing: "PARTIAL", expectRule: "CUSTOMS" },
  { code: "SCT.CHARGE.CUSTOMS_INSPECTION", provided: ["SCT.DOC.APPROVAL"],                                                                          expectStatus: "PARTIAL",        expectMissing: "PARTIAL", expectRule: "INSPECTION" },
  { code: "SCT.CHARGE.CUSTOMS_INSPECTION", provided: [],                                                                                          expectStatus: "MISSING",        expectMissing: "PARTIAL", expectRule: "INSPECTION" },
  { code: "SCT.RATE.AT_COST",              provided: ["SCT.DOC.VENDOR_INVOICE","SCT.DOC.APPROVAL","AMOUNT_MATCH"],                                expectStatus: "MATCHED_EXACT", expectMissing: "AMBER",    expectRule: "AT_COST" },
  { code: "SCT.RATE.AS_PER_OFFER",         provided: ["SCT.DOC.APPROVAL_OFFER"],                                                                  expectStatus: "PARTIAL",        expectMissing: "AMBER",    expectRule: "AS_PER_OFFER" },
  { code: "SCT.CHARGE.MASTER_DO",          provided: ["SCT.DOC.DO","SCT.DOC.VENDOR_INVOICE"],                                                       expectStatus: "MATCHED_EXACT", expectMissing: "AMBER",    expectRule: "DO" },
  { code: "SCT.CHARGE.THC",                provided: ["SCT.DOC.TERMINAL_INVOICE"],                                                                 expectStatus: "PARTIAL",        expectMissing: "AMBER",    expectRule: "THC" },
  { code: "SCT.CHARGE.DETENTION",          provided: ["FREE_TIME"],                                                                                expectStatus: "PARTIAL",        expectMissing: "ZERO",     expectRule: "DETENTION" },
  { code: "SCT.CHARGE.STORAGE",            provided: ["SCT.DOC.STORAGE_INVOICE","SCT.DOC.TERMINAL_INVOICE"],                                       expectStatus: "MATCHED_EXACT", expectMissing: "AMBER",    expectRule: "STORAGE" },
  { code: "SCT.DOC.BL",                    provided: ["SCT.DOC.BL","SCT.DOC.CI_PL"],                                                              expectStatus: "MATCHED_EXACT", expectMissing: "AMBER",    expectRule: "BL" },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const req = getEvidenceRequirements(c.code);
  const val = validateEvidence({ sct_code: c.code, provided_evidence: c.provided });
  const ok = val.evidence_status === c.expectStatus && req.missing_status === c.expectMissing && req.rule_source === c.expectRule;
  if (ok) {
    pass++;
    console.log(`  ✓ ${c.code} → status=${val.evidence_status}, missing_status=${req.missing_status}, rule=${req.rule_source}`);
  } else {
    fail++;
    console.log(`  ✗ ${c.code} expected status=${c.expectStatus} missing=${c.expectMissing} rule=${c.expectRule}, got status=${val.evidence_status} missing=${req.missing_status} rule=${req.rule_source}`);
  }
}
console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail === 0 ? 0 : 1);
