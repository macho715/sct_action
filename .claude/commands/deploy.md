# /deploy — Cloudflare Worker 배포

Cloudflare Worker `hvdc-ontology-chatgpt-app`을 배포합니다.

## 실행 순서

1. **사전 검증**
   ```bash
   node --check cloudflare_worker/worker.js
   ```
   → 0 에러 아니면 중단

2. **YAML 파싱 검증**
   ```bash
   node -e "const yaml=require('js-yaml');const fs=require('fs');['openapi/hvdc_sct_ontology_actions.noauth.yaml','openapi/hvdc_sct_ontology_actions.apikey.yaml'].forEach(f=>{try{yaml.load(fs.readFileSync(f,'utf8'));console.log(f,'OK')}catch(e){console.error(f,'FAIL',e.message);process.exit(1)}})"
   ```
   → FAIL 시 중단

3. **OpenAPI/Worker 라우트 일치 확인**
   - OpenAPI `paths`에 정의된 모든 path가 Worker `ROUTES` 매핑에 있는지
   - 미일치 시 `FAILURE_REASON: NO_ROUTE_404` 위험

4. **배포**
   ```bash
   wrangler deploy
   ```

5. **Smoke test** (자동 실행)
   ```bash
   bash tests/curl_smoke_tests.sh
   ```

## 옵션

- `/deploy dev` — no-auth 모드 (개발)
- `/deploy prod` — API Key 모드 (운영)

## 안전

- 첫 배포는 사용자 승인 필요
- `wrangler secret put SCT_ACTION_API_KEY`은 절대 직접 실행하지 않음
