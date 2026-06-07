# HVDC SCT Ontology GPT Actions Full Package v1.0

## 목적

이 패키지는 ChatGPT GPT Actions가 `hvdc-ontology-chatgpt-app.mscho715.workers.dev`를 통해 SCT Ontology를 실제 호출하도록 만드는 REST wrapper 전체 구성입니다.

현재 실패 원인은 GPT가 `POST /ontology/resolve`를 호출했으나 Worker에 해당 route가 없어 404가 발생한 것입니다. 이 패키지는 `/ontology/*` route와 `/mcp/ontology/*` alias를 모두 지원합니다.

## 포함 파일

| 경로 | 용도 |
|---|---|
| `cloudflare_worker/worker.js` | Cloudflare Worker REST wrapper 전체 코드 |
| `wrangler.toml` | Wrangler 배포 설정 |
| `openapi/hvdc_sct_ontology_actions.noauth.yaml` | GPT Builder 인증 없음 테스트용 OpenAPI |
| `openapi/hvdc_sct_ontology_actions.apikey.yaml` | GPT Builder API Key 운영용 OpenAPI |
| `gpts/GPT_INSTRUCTIONS_SCT_ONTOLOGY_ROUTER.md` | GPT Instructions 최상단 삽입 패치 |
| `tests/*.payload.json` | Action 테스트 payload |
| `tests/curl_smoke_tests.sh` | 배포 후 smoke test |

## 설치 순서

1. Cloudflare Worker에 `cloudflare_worker/worker.js` 배포
2. GPT Builder → Actions → 기존 schema 삭제
3. `openapi/hvdc_sct_ontology_actions.noauth.yaml` 전체 붙여넣기
4. 인증은 우선 `없음`
5. `resolveSctOntologyTerm` 테스트 실행
6. 성공 후 운영 전환 시 `wrangler secret put SCT_ACTION_API_KEY`
7. GPT Builder 인증을 API Key header `X-API-Key`로 변경
8. `openapi/hvdc_sct_ontology_actions.apikey.yaml`로 schema 교체

## 성공 기준

GPT Action 로그가 아래처럼 나와야 합니다.

```text
status_code: 200
domain: hvdc-ontology-chatgpt-app.mscho715.workers.dev
path: /ontology/resolve
operation: resolveSctOntologyTerm
```

응답 body는 최소 아래 구조를 포함해야 합니다.

```json
{
  "dry_run": true,
  "ontology_version": "SCT-LOGI-2026.06-v2.1",
  "mappings": []
}
```

## Fail-safe

- 404: Worker route 미배포 또는 wrong path
- 401: API key 불일치
- 400: payload/schema 불일치
- 500: Worker handler 오류

GPT 응답 규칙:

```text
ACTION_CALLED: YES
SCT_ONTOLOGY_USED: NO
FAILURE_REASON: NO_ROUTE_404
```

Action 호출은 되었지만 404/500이면 `SCT_ONTOLOGY_USED: YES`라고 표시하면 안 됩니다.
