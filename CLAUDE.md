# CLAUDE.md

## 프로젝트 개요

HTML, CSS, JavaScript 프론트엔드와 Supabase Edge Function을 연동해 **제품 사진으로 SNS(Instagram·Threads) 포스팅 초안을 만드는 앱**.

1. 사진을 올리면 OpenRouter 무료 비전 모델이 SNS 메시지에 쓸 사진의 특성을 추출한다.
2. 추출한 특성으로 Google Gemini 3.5 Flash-Lite가 Instagram·Threads 포스팅 초안을 작성한다.

자세한 요구사항은 `PRD.md`를 따른다.

## 기술 스택

- 프론트엔드: HTML / CSS / JavaScript (Vanilla, 빌드 도구 없음)
- 백엔드: Supabase Edge Functions (Deno, TypeScript)
- 외부 API
  - OpenRouter: 사진 특성 추출 `nvidia/nemotron-3.5-super-vl:free` (이 모델만 사용)
  - Google Gemini: 포스팅 초안 작성 `gemini-3.5-flash-lite`

## 폴더 구조

```
예제2/
├─ index.html                     # 화면
├─ style.css                      # 스타일
├─ app.js                         # 화면 동작, Edge Function 호출
├─ config.js                      # 공개 설정 (Supabase URL, anon key만)
└─ supabase/functions/
   ├─ _shared/cors.ts             # CORS 헤더, json() 응답 도우미
   ├─ analyze-image/index.ts      # 사진 → 특성 (OpenRouter)
   └─ generate-post/index.ts      # 특성 → Instagram·Threads 초안 (Gemini)
```

## 시크릿 / 보안 규칙

- API 키는 **Supabase Secrets에만** 있다. Edge Function에서 `Deno.env.get()`으로 읽는다.
  - `OPEN_API_KEY`: OpenRouter 키 (`Authorization: Bearer ...`)
  - `GEMINI_API_KEY`: Google Gemini 키 (`x-goog-api-key` 헤더)
- 시크릿 이름은 대소문자를 구분한다. 코드의 이름과 정확히 일치시킨다.
- 프론트엔드(`config.js` 등)에는 Supabase 프로젝트 URL과 anon(publishable) 키만 둔다. 비밀 키를 절대 넣지 않는다.
- 로컬 개발용 `supabase/functions/.env`는 Git에 올리지 않는다.
- Supabase 프로젝트: `연습용` (ref `xyawtkqsmdeslslndnto`)

## 개발 규칙

- Edge Function은 `OPTIONS` 프리플라이트를 처리하고, 모든 응답에 CORS 헤더를 붙인다 (`_shared/cors.ts` 재사용).
- 오류 응답 형식은 `{ "error": "사용자에게 보여줄 한국어 메시지" }`로 통일한다. 상세 원인은 `console.error`로 서버 로그에만 남긴다.
- AI 응답은 JSON으로 받는다. 모델이 앞뒤에 다른 글자를 붙일 수 있으므로 `{...}` 부분만 잘라 `JSON.parse` 한다.
- 무료 모델은 429(요청 과다)가 잦다. 다른 모델로 바꿔 시도하지 않고, 사용자에게 "잠시 뒤 다시 시도" 안내를 보여준다.
- 추론형 모델이므로 `max_tokens`는 1500~2000으로 넉넉히 준다.
- 화면에 표시하는 AI 결과는 `textContent`로 넣는다 (`innerHTML` 금지).
- 사용자에게 보이는 문구와 코드 주석은 한국어로 쓴다.

## 배포

```bash
npx supabase functions deploy <함수이름> --project-ref xyawtkqsmdeslslndnto --no-verify-jwt
```

- 배포는 운영(production) 환경을 바꾸므로 사용자 확인을 받은 뒤 실행한다.

## 브랜치 전략

- 모든 작업은 `dev` 브랜치에서 한다.
- merge는 `main` 브랜치에서 한다 (`main`에서 `dev`를 merge).

## 커밋 규칙

커밋을 요청받으면 아래 순서를 따른다.

1. **현재 브랜치 확인**: `git branch --show-current`로 현재 브랜치를 확인한다.
2. **브랜치 경고**: 현재 브랜치가 `dev`가 아니면 다음 형식으로 경고하고, 사용자 확인을 받은 뒤에만 커밋한다.
   > ⚠️ 현재 브랜치는 `<현재 브랜치 이름>`입니다. `dev` 브랜치가 아닙니다. 그래도 커밋할까요?
3. **커밋 메시지 확인**: 사용자가 커밋 메시지를 주지 않았으면 메시지를 요청하고, 받은 뒤에 커밋한다.
