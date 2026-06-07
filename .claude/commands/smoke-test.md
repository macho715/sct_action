# /smoke-test — Worker 9개 라우트 smoke test

배포된 Worker의 9개 ontology/dry-run 라우트를 curl로 검증합니다.

## 실행

```bash
# 기본 (dev URL)
bash tests/curl_smoke_tests.sh

# 사용자 지정 URL
BASE_URL=https://hvdc-ontology-chatgpt-app.mscho715.workers.dev bash tests/curl_smoke_tests.sh

# API Key 포함
SCT_ACTION_API_KEY=xxx bash tests/curl_smoke_tests.sh
```

## 검증 라우트 (9개)

| # | Method | Path | Payload |
|---|--------|------|---------|
| 1 | POST | /ontology/resolve | tests/resolve.payload.json |
| 2 | POST | /ontology/explain | (별도) |
| 3 | POST | /ontology/evidence-map | tests/evidence-map.payload.json |
| 4 | POST | /ontology/gate-check | tests/gate-check.payload.json |
| 5 | POST | /ontology/crosswalk | (별도) |
| 6 | POST | /ontology/audit-trace | (별도) |
| 7 | POST | /dry-run/validate | (별도) |
| 8 | POST | /dry-run/type-b-classify | tests/type-b-classify.payload.json |
| 9 | POST | /dry-run/rate-lookup | tests/rate-lookup.payload.json |

## 성공 기준

- 9/9 라우트 → HTTP 200
- 모든 응답에 `dry_run: true` 포함
- `FAILURE_REASON: NO_ROUTE_404` 0건

## 실패 시

- 404: Worker route 미배포 → `wrangler deploy` 재실행
- 401: API Key 불일치 → `SCT_ACTION_API_KEY` 확인
- 400: payload/schema 불일치 → OpenAPI `requestBody`와 payload 비교
- 500: Worker 핸들러 오류 → Worker 로그 확인 `wrangler tail`
