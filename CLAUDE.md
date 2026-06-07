# HVDC SCT Ontology GPT Actions — Development Guide

> Samsung C&T HVDC Abu Dhabi 프로젝트 · Logistics & SCM 도메인
> 본 프로젝트는 ChatGPT GPT Actions에서 호출하는 **read-only / dry-run** REST wrapper.

## 1. 프로젝트 정체성

| 항목 | 값 |
|------|-----|
| **Worker 이름** | `hvdc-ontology-chatgpt-app` |
| **호스트** | `https://hvdc-ontology-chatgpt-app.mscho715.workers.dev` |
| **메인 핸들러** | `cloudflare_worker/worker.js` (721줄, ES Modules) |
| **런타임** | Cloudflare Workers, `compatibility_date = 2026-06-07` |
| **OpenAPI** | `openapi/hvdc_sct_ontology_actions.{noauth,apikey}.yaml` |
| **테스트** | `tests/curl_smoke_tests.sh` + payload 5개 |

## 2. 절대 원칙 (CRITICAL)

### ❌ Worker는 dry-run / read-only
- 인보이스 승인, 결제, ERP/TMS/WMS mutation, 원시 계약요율 공개 **절대 금지**
- 새로운 mutation endpoint 추가 요청 → **거부**하고 PRIME 모드로 계약 검토 먼저

### ❌ OpenAPI/Worker 라우트 불일치 금지
- OpenAPI `paths`에 추가한 route는 Worker `ROUTES` 매핑에도 **반드시** 등록
- 미등록 시 GPT Action 로그: `status_code: 404`, `FAILURE_REASON: NO_ROUTE_404`
- 양쪽 파일 동시 수정 원칙

### ❌ 인증 키 하드코딩 금지
- `SCT_ACTION_API_KEY`는 `wrangler secret put`으로만 설정
- 코드/문서/git history 어디에도 실제 값 커밋 금지

## 3. 개발 워크플로

### 라우트 추가/수정 순서
1. `cloudflare_worker/worker.js` → `ROUTES` 매핑 + 핸들러 함수
2. `openapi/hvdc_sct_ontology_actions.noauth.yaml` (개발용)
3. `openapi/hvdc_sct_ontology_actions.apikey.yaml` (운영용, 양쪽 동일하게)
4. `tests/*.payload.json` 샘플 추가
5. `tests/curl_smoke_tests.sh` 케이스 추가
6. `node --check cloudflare_worker/worker.js` → 0 에러 확인
7. YAML 파싱 검증 (아래 명령)
8. GPT Builder schema 교체

### 검증 명령 (로컬)

```bash
# JS 구문 체크
node --check cloudflare_worker/worker.js

# YAML 파싱 검증
node -e "const yaml=require('js-yaml');const fs=require('fs');['openapi/hvdc_sct_ontology_actions.noauth.yaml','openapi/hvdc_sct_ontology_actions.apikey.yaml'].forEach(f=>{try{yaml.load(fs.readFileSync(f,'utf8'));console.log(f,'OK')}catch(e){console.error(f,'FAIL',e.message);process.exit(1)}})"
```

### 배포

```bash
# 개발 (no-auth 모드)
wrangler deploy

# 운영 (API Key 설정 후)
wrangler secret put SCT_ACTION_API_KEY
wrangler deploy
```

## 4. 응답 형식 표준

### 성공 응답 (resolve 예시)
```json
{
  "dry_run": true,
  "ontology_version": "SCT-LOGI-2026.06-v2.1",
  "mappings": []
}
```

### GPT 응답 규칙
```text
ACTION_CALLED: YES
SCT_ONTOLOGY_USED: NO   # 404/500 시에는 절대 YES 아님
FAILURE_REASON: NO_ROUTE_404
```

## 5. 코딩 컨벤션

- **ES Modules** (`export default { fetch }`)
- 핸들러 함수: `async function handleResolve(request, env) { ... }` 형식
- 상수: `Object.freeze({ ... })`로 노출 (예: `TYPE_B`)
- 라우트 매핑: `ROUTES` 객체에 path → handler 등록
- Path 정규화: `normalizePath()`, `/mcp/` prefix는 `stripMcpPrefix()`로 strip
- 한국어 주석 OK, 식별자는 영어

## 6. 프로젝트 구조

```
.
├── cloudflare_worker/
│   └── worker.js                # 단일 핸들러 (수정 빈도 높음)
├── openapi/
│   ├── hvdc_sct_ontology_actions.noauth.yaml   # GPT Builder (noauth)
│   └── hvdc_sct_ontology_actions.apikey.yaml   # GPT Builder (API Key)
├── gpts/
│   └── GPT_INSTRUCTIONS_SCT_ONTOLOGY_ROUTER.md  # GPT Instructions 패치
├── tests/
│   ├── curl_smoke_tests.sh
│   └── *.payload.json (5개)
├── docs/
│   ├── ROUTE_DECISION.md
│   ├── SCT_ONTOLOGY_IMPROVEMENT_SPEC.md
│   └── SCT_ONTOLOGY_IMPROVEMENT_EXECUTION_PLAN.md
├── wrangler.toml
├── package_self_check.json
└── README_INSTALL.md
```

## 7. 안전/품질 게이트

- 인보이스 금액 검증 (Δ > 2% → 빨간색 + 사유 메모) — 글로벌 규칙 상속
- 추측 금지, 불확실 시 `⚠ 확인 필요` 표시
- 파일 삭제/덮어쓰기 전 확인
- 전화번호/이메일 마스킹
- 외부 데이터: 출처+날짜 명시

## 8. 글로벌 규칙 상속

본 프로젝트는 다음 글로벌 규칙을 상속합니다:
- `~/.claude/CLAUDE.md` — MACHO-GPT v4.5 (HVDC SCM 도메인)
- `~/.claude/rules/coding-style.md` — Immutability, 작은 파일
- `~/.claude/rules/security.md` — 비밀 관리, 보안 체크
- `~/.claude/rules/verification.md` — 완료 전 검증 필수
- `~/.claude/rules/team.md` — 팀 협업 규칙

## 9. 다음 단계

- [ ] `wrangler deploy`로 dev 환경 배포
- [ ] `tests/curl_smoke_tests.sh`로 9개 라우트 smoke test
- [ ] GPT Builder에 `noauth` OpenAPI 붙여넣기
- [ ] `resolveSctOntologyTerm` 호출 → 200 응답 확인
- [ ] 성공 시 API Key 모드 전환
