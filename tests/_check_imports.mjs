import { getEvidenceRequirements, validateEvidence } from "../cloudflare_worker/lib/evidence.js";
import { resolveDocumentType, resolveRateBasis, explainOntologyNode } from "../cloudflare_worker/lib/ontology.js";
import { classifyTypeB, crosswalkSctToTypeB } from "../cloudflare_worker/lib/type-b-classifier.js";
console.log("  ✓ all lib modules import");
console.log("  evidence keys:", Object.keys({ getEvidenceRequirements, validateEvidence }));
console.log("  ontology keys:", Object.keys({ resolveDocumentType, resolveRateBasis, explainOntologyNode }));
console.log("  classifier keys:", Object.keys({ classifyTypeB, crosswalkSctToTypeB }));
