# Verification

## Scope

pixel-kitchen: model source and focused tests, static asset/syntax checks, browser interaction, remote workflow and public site are separate evidence levels. Existing unrelated services remain outside this change.

## Evidence

### 최초 배포 전 로컬 검증 / 2026-10-09

- LOCAL: npm test 4/4 통과. npm run check로 모델/UI 구문, 로컬 자산 참조, 메타데이터, CSP, BOM 여부 통과.
- BROWSER_LOCAL: 공개된 갤러리 JPEG의 로컬 읽기, 실제 PNG 다운로드, 0 나누기 거절, 필터 전환과 방향키 검사.
- RESPONSIVE_LOCAL: 390×844, 320×780에서 페이지 가로 넘침 없음. 현재 검사한 브라우저에서 경고/오류 로그 없음.
- WebMCP_LOCAL: 기능 감지가 되는 브라우저에서 등록된 읽기/조작 도구의 정상 호출과 의도한 잘못된 입력 거절을 확인. 이 기능이 없는 브라우저에서는 일반 UI로 사용합니다.

### 배포 결과의 별도 기록

이 문서는 최초 배포 직전의 로컬 증거입니다. 원격 CI·공개 사이트 증거와 혼동하지 않습니다.
배포 후 커밋별 CI와 공개 URL 확인 결과는 [WEB LAB 종합 검증 기록](https://github.com/HyungminYoon1/web-lab/blob/main/docs/verification.md)에 기록합니다.
이 저장소의 이후 변경은 [Actions](https://github.com/HyungminYoon1/pixel-kitchen/actions)에서 해당 커밋의 결과를 별도로 확인해야 합니다.

## 복원 과제 / 다중 패스 확장 — 2026-10-09 LOCAL ONLY

이 절은 이번 로컬 작업의 증거이며 위 최초 배포 전 기록과 분리합니다. 커밋·푸시·배포·원격 쓰기·새 에이전트 생성은 수행하지 않았습니다. 브라우저는 이 작업을 수행한 에이전트가 직접 로컬 Chromium에서 확인했습니다.

### 요청한 입력의 검사 상태

| 입력 | 상태 | 검사 범위 |
| --- | --- | --- |
| pixel-kitchen | VERIFIED | 숨김 파일 포함 앱 파일 목록, 초기 Git 상태(깨끗함), 아래 관련 파일 전체. .git 내부 구현/객체는 기능 검토 대상이 아님. |
| architecture.md / README.md | VERIFIED | 수정 전 전체 읽기, 기존 계층·개인정보 경계 유지, 수정 후 내용 확인. |
| docs/decisions.md / docs/verification.md | VERIFIED | 기존 문서 전체, 결정 D04–D07 및 이번 검증 기록. |
| .gitattributes / .gitignore / package.json | VERIFIED | 전체 읽기. CRLF/UTF-8 정책, 로컬 명령, QA 산출물 제외. |
| dist/src/model.js / app.js / ui.js | VERIFIED | 기존 계산·UI·도구/좌표 코드 전체 읽기, 변경 후 계산/상태/취소 경계 확인. |
| dist/index.html / styles.css | VERIFIED | 전체 읽기, 조작 요소·CSP·반응형 구성 및 로컬 스크린샷 검사. |
| test/model.test.js / tools/check.mjs / tools/serve.mjs | VERIFIED | 기존 테스트·검사·정적 서버 전체 읽기. 확장 테스트와 브라우저 QA는 아래와 같음. |
| .github/workflows/pages.yml | VERIFIED | 로컬 내용 전체 읽기만 수행. 원격 실행/배포 검사 NOT_RUN. |

범위 밖 앱은 수정하지 않았습니다. 초기 조회 한 번은 기본 상위 작업 폴더의 목록까지 출력했으며 그곳의 파일을 수정하지 않았습니다. 이후 모든 작업 명령에 pixel-kitchen 경로를 명시했습니다. 메모리 검색에는 관련 항목이 없어 구현 판단에 사용하지 않았습니다.

### LOCAL / 독립 산술 검증

- `npm test`: **17/17 PASS**, 실패·취소·스킵 0. 기존 4개 + 확장 13개, 최종 실행 약 8.5초.
- `test/pipeline.test.js`의 독립 스칼라 기준 계산기는 생산 모델·픽셀 검사기를 기대값 계산에 사용하지 않습니다. 반올림은 명시적 half-to-even, 경계 좌표는 별도 중첩 행렬/조회 구현입니다.
- 모든 커널, 흑백, Sobel X/Y/크기, 문턱값, 비정사각형/모서리, 4단계의 각 중간 결과와 알파를 교차 확인했습니다.
- 수계산 Sobel 램프: 중심 Gx=80, Gy=160 → signed X=148, Y=168, magnitude=45 (gain=1, byte rounding). 생산 모델/검사기로 확인.
- 수계산 오차 예제: RGB 차이 [3,-4,0] → MAE=7/3, RMSE=√(25/3), 부호 평균=-1/3, 최대=4. 4× 지도 [16,4,0,255], 16× [64,4,0,255]. 완전 투명 쌍 제외와 알파 독립 오차도 확인.
- 시드 0/17/991/999999 × 5과제 = **20개 목표**를 별도 기준 파이프라인으로 재구성해 동일 바이트를 확인했습니다. 정답은 제약/오차를 만족하고 초기 identity는 실패합니다. 잘못된 제약으로 목표 바이트만 맞춰도 통과하지 않습니다.
- 문턱값과 평균의 순서 교환 불가, 단계별 clipping, 빈/sparse/잘못된 입력, 최대 패스/예산, iterator 중단과 설정 스냅샷을 확인했습니다.
- 소수점 CSS 표시 크기에서 테두리를 빼고 픽셀 칸을 floor로 선택하는 좌표도 수계산 예제와 일치합니다.
- `npm run check`: **PASS**, 공개 파일 6개와 텍스트 19개. 구문·로컬 자산/모듈 참조·메타데이터·CSP, 순수 계산에 DOM/시간 의존 없음, 런타임 network/storage/eval API 없음, 유효 UTF-8 without BOM / CRLF.
- `git diff --check`: **PASS**. 변경은 이 앱에만 있으며 기존 테스트·정적 서버·호스팅 워크플로는 보존했습니다.

### BROWSER_LOCAL / 실제 브라우저 동작

환경: 캐시된 Playwright CLI를 `--offline`으로 사용, 로컬 정적 서버 `127.0.0.1`에만 접속. 외부 이미지·사진 생성·코드 복사는 없습니다.

`tools/browser-smoke.js`: **39/39 PASS**.

- 첫 진행 잠금, 밝기 오답의 부호 설명, 5과제의 UI 입력/정답 진행과 실제 MAE/RMSE 0. 과제에서는 프리셋이 숨겨집니다.
- 평균 → 문턱값은 목표를 못 맞추고 순서를 바꾸면 통과. 단계 선택·와이프 키보드 경계·픽셀 방향키·Gx/Gy 검사. 지도 증폭은 오차 불변.
- 4단계 UI 상한, 빈 숫자·나누기 0 거절 및 PNG 비활성화. 실행 중 취소는 부분 결과를 내보내지 않음.
- 메모리에 만든 로컬 4×2 PNG의 실제 createImageBitmap 읽기, 알파 보존, **실제 PNG 다운로드**. 다운로드 파일 121바이트, PNG signature `89-50-4E-47-0D-0A-1A-0A` 확인.
- 미지원 SVG와 8 MiB 초과 파일 거절, 샘플 복원. 기록한 요청은 로컬 HTML/CSS/JS 6개뿐이며 localStorage/sessionStorage/cookie 없음. 이 실행에서 콘솔 오류·미처리 예외 0.
- 데스크톱 1440×1000, 화면 크기 모의 390×844 및 320×844에서 가로 넘침 없음. 저장한 스크린샷을 직접 열어 레이아웃 확인. 와이프 캔버스의 letterbox를 제거하고 포인터의 테두리 오프셋을 보정했습니다.
- 와이프 왼쪽/오른쪽 실제 RGBA가 원본/처리 결과와 각각 일치하고, 1/4 지점을 누르면 x=150/y=100을 정확히 선택합니다. 처음 관찰한 한 픽셀 오프셋을 소수점 내용 영역 계산과 floor로 수정했습니다. QA의 반복 getImageData 읽기는 Chromium의 readback 성능 안내 경고를 발생시킬 수 있으며 앱 예외와 구분합니다.

`tools/browser-limits.js`: **14/14 PASS**.

- 실제 PNG/JPEG/WebP 1440×960 디코딩 → 720×480 축소. 가져온 파일은 자유 실험실로 이동하고 identity로 시작합니다.
- 720×480 × 커널 4회는 37.32M / 40M work로 완료. 최근 단독 실행 1,656ms, 이 데스크톱의 관찰값일 뿐 모바일 성능 통계가 아닙니다.
- 커널 1회 + Sobel 3회는 40M 초과로 처리 전에 거절, 결과 PNG 비활성화.
- 명시적 사진 읽기 취소, 중복 디코딩 요청 거절, 늦은 결과가 샘플을 덮어쓰지 않음. 새 시드 미적용 표시, 명시적 적용과 진행 초기화.

### TEST_DOUBLE / 별도 구분

- 사진 읽기 취소의 경쟁 상태: 실제 디코딩 뒤 결과 전달을 지연하는 테스트 대역으로 재현했습니다. 네이티브 디코더 강제 취소를 검증한 것이 아닙니다.
- 디코딩 24MP 초과 거절: 5000×5000 치수/close를 반환하는 제어된 테스트 대역으로 거절·close를 확인했습니다. 실제 25MP 사진 디코딩은 NOT_RUN입니다.
- 순수 모델 알파 보존과 브라우저 디코딩/캔버스 알파 보존은 별도 증거입니다. 완전 투명 RGB의 브라우저 보존은 주장하지 않습니다.

### 변경 파일 / 재확인 흐름

- 계산: `dist/src/model.js`, 새 `dist/src/challenges.js`.
- UI: `dist/src/app.js`, `dist/src/ui.js`, `dist/index.html`, `dist/styles.css`.
- 검증: 새 `test/pipeline.test.js`, `tools/check.mjs`, 새 `tools/browser-smoke.js` / `tools/browser-limits.js`.
- 문서/정책: `README.md`, `architecture.md`, `docs/decisions.md`, `docs/verification.md`, `.gitignore`.
- 로컬 무시 산출물: `output/playwright/challenge-desktop.png`, `challenge-390.png`, `challenge-320.png`, `export.png`; `.playwright-cli/` 기록. 배포 자산이 아님.

[README의 짧은 실행 흐름](../README.md#직접-실행)으로 첫 과제 오답→정답, 다중 단계 순서 비교, 와이프/검사기, 취소와 파일/PNG를 다시 확인할 수 있습니다. 브라우저 QA 스크립트는 그 흐름을 반복합니다.

### NOT_RUN / 증거의 한계

이번 변경의 원격 CI, 배포, 라이브 사이트/URL 확인; 실제 모바일 기기 CPU/메모리/터치; Firefox/WebKit; 실제 25MP 디코딩; 지각 품질/통계 검증/사용자 연구는 **NOT_RUN**입니다. 앱의 결과는 byte-domain 교육용 계산이며 손실된 세부 정보를 복구한다는 증거가 아닙니다. 기존 공개 페이지/워크플로 링크는 이번 변경의 라이브 성공을 의미하지 않습니다.

## BFCache 후속 검증 / 2026-10-09

- BROWSER_LOCAL 재현: 통합 `http://127.0.0.1:4178/pixel-kitchen/`의 정상 WEB LAB 링크로 이동한 뒤 브라우저 back. 기본 Playwright는 BFCache를 끄므로 처음에는 새 문서 로드만 관찰했습니다. 검사 브라우저에서 `--disable-back-forward-cache` 기본 인자만 제거한 뒤 같은 문서의 `pagehide.persisted=true` / `pageshow.persisted=true`를 확인했습니다.
- 수정 전 실제 오류: 파이프라인 실행은 이미지 크기/픽셀 배열 오류로 실패했고, 단서 버튼은 null의 objective 접근 TypeError를 발생시켰습니다. 코드 독해만의 위험이 아닌 실제 재현입니다.
- 최소 수정: pagehide에서 현재 계산 iterator와 화면 픽셀/검사 값/파일 입력을 비우고, persisted pageshow에서 시드 17의 첫 과제 및 선택적 페이지 도구를 새로 초기화합니다. 개인 파일·이전 파이프라인·진행은 복원하지 않습니다. 다른 서비스와 숨겨진 seed 핸들러는 수정하지 않았습니다.
- `tools/browser-bfcache.js`: 43개 검사 PASS, 페이지 오류 0. 정상 로컬 링크/back의 실제 BFCache 왕복 4회에서 과제 진행 초기화, 실제 합성 PNG 가져오기 후 개인 입력 미복원, 반복 복귀, PNG 다운로드, 계산/단서/검사기 작동을 확인했습니다. 복귀 전 캔버스 1×1 정리, 빈 파일 입력과 비활성 내보내기도 검사했습니다.
- TEST_DOUBLE: 계산 중 이동 사례는 한 번의 행 예약을 제어해 busy 상태를 결정적으로 만듭니다. 링크 이동과 BFCache 복귀 자체는 실제 브라우저 동작이며, 늦은 계산이 새 과제를 덮어쓰지 않는지 확인했습니다. 네이티브 디코더 강제 중단/보안 메모리 삭제를 주장하지 않습니다.
- LOCAL: 단위 테스트 17/17 PASS, 정적 검사 PASS, `git diff --check` PASS. UTF-8 without BOM / CRLF 유지. 위 브라우저 검증은 Chromium이며 Firefox/WebKit·실제 모바일·라이브 배포는 NOT_RUN입니다.
- 반복 흐름: 로컬 URL에서 첫 과제를 실행 → WEB LAB 링크 → 브라우저 back → 시드 17 첫 과제/단서/실행 확인. 자유 실험실에서 로컬 PNG를 읽은 뒤 같은 이동/back을 하면 이전 파일 대신 새 합성 과제가 표시되어야 합니다.
- 검사 브라우저 설정은 무시되는 `output/playwright/bfcache.config.json`이며 새 서버를 시작하지 않았습니다. 자체 65484 preview는 종료 상태를 유지하고, 메인 4178 서비스에는 변경/종료 명령을 실행하지 않았습니다. 커밋·푸시·배포 없음.

## 레시피·로컬 프리셋·히스토그램 / 2026-10-09 LOCAL

### 입력과 범위

| 요청한 입력 | 상태 | 범위 |
| --- | --- | --- |
| pixel-kitchen 저장소 | PARTIAL | 숨김 파일 포함 목록·초기 git status 확인(깨끗함). 아래 기능 관련 파일 전체 검토. Git 객체/관련 없는 내부 파일은 읽지 않음. 변경은 이 저장소에만 있음. |
| architecture.md / README.md / docs/decisions.md | VERIFIED | 수정 전 전체 읽기. D09–D11에 승인된 저장 예외·수명·오류·갤러리 요약 제외 근거 기록. |
| api-spec.md / requirements.md | NOT_INSPECTED | 파일 목록에 존재하지 않음. architecture.md를 우선 기준으로 사용. |
| dist/index.html / styles.css / src/model.js / challenges.js / app.js / ui.js | VERIFIED | 기존 관련 코드 전체 읽기. 기존 이미지 계산·과제 목표·제약·시드 알고리즘은 유지하고 표시/설정 경계만 추가. |
| .gitattributes / .gitignore / package.json / tools/check.mjs / serve.mjs / test/model.test.js / pipeline.test.js | VERIFIED | 전체 읽기. 기존 17개 모델 테스트 보존. 기존 브라우저 QA 파일 전체 검토 후 새 문구/명시적 저장 경계에 맞춰 검사 변경. |
| .github/workflows/pages.yml | VERIFIED | 전체 읽기만 함. 변경·실행 없음. |
| web-lab / 다른 서비스 / 계정·백엔드 | NOT_INSPECTED | 명시된 소유권 경계에 따라 접근·수정하지 않음. 메인 담당. |

메모리 레지스트리의 관련 키워드 검색에 일치 항목이 없었고 구현 판단에 사용하지 않았습니다. 다른 에이전트 생성·커밋·푸시·프로비저닝·계정 접근·서버 시작·브라우저 실행은 수행하지 않았습니다.

### 변경과 LOCAL 증거

- `npm test`: **26/26 PASS**, 실패·취소·스킵 0. 기존 17개 + 새 9개. 실행 14,407.6584ms. 기존 독립 기준 계산기 및 4시드×5과제의 합법 파이프라인/실패 조건을 그대로 실행했습니다.
- 새 `test/recipe.test.js`: 실제 ordered output/α를 레시피 왕복 후 수계산 값과 비교; 개인 이름/파일 경로/픽셀 필드 제외; 미지원 버전·모델·누락/추가 필드·프로토타입·희소 배열·잘못된 타입·비유한 수·모든 연산 범위 거절. UTF-8 8 KiB 및 64 KiB 초과와 현재 이미지 40M 예산 거절을 검사했습니다.
- 저장 검증은 주입한 메모리 저장소의 **TEST_DOUBLE**입니다. 8개 상한·재읽기·복사 격리·선택 삭제/번호 재사용·손상 데이터 덮어쓰기 금지·차단/용량 초과·전체 삭제가 다른 앱/갤러리 키를 보존하는지 확인했습니다. 실제 브라우저 localStorage의 동작/용량 증거는 아닙니다.
- 히스토그램은 직접 계산한 gray 57, R/G/B/α bin 합, 완전/부분 투명 처리, 입력 불변, 잘못된 채널/이미지 거절을 검사했습니다.
- `npm run check`: **PASS**. 공개 파일 8개, 텍스트 23개. JS 구문·모듈 참조·메타데이터·CSP·순수 모델 경계·UTF-8 without BOM/CRLF.
- 정적 개인정보 검사의 blanket localStorage 금지는 D09의 승인된 예외만 반영했습니다. `storage.js`에 한 번의 접근·고정 프리셋 키·검증을 요구하고 다른 런타임 파일의 localStorage를 금지합니다. 네트워크/sessionStorage/indexedDB/eval 금지와 CSP 유지, 순수 모듈의 UI/저장 import도 금지합니다.
- 기존 browser-smoke/bfcache 검사는 모든 localStorage가 비어야 한다는 조건을 **작업 전후 모든 키/값이 동일**하다는 조건으로 변경했습니다. 이 흐름에는 명시적 저장이 없으므로 이미지·진행·자동 저장이 발생하면 실패하며 기존 프리셋/다른 앱 데이터를 허용합니다. sessionStorage/cookie 검사는 보존했습니다. `단서`와 읽기 상태 텍스트 selector만 조정했습니다. 이번 브라우저 QA 실행은 NOT_RUN입니다.
- `git diff --check`: **PASS**. 변경 16개(새 파일 3개 포함), 배포 워크플로·외부 저장소 변경 없음.

변경 경로: `dist/src/recipe.js` (새 순수 스키마), `dist/src/storage.js` (새 단일 저장 경계), `test/recipe.test.js` (새 테스트), `dist/src/model.js`, `dist/src/challenges.js`, `dist/src/app.js`, `dist/index.html`, `dist/styles.css`, `tools/check.mjs`, `tools/browser-smoke.js`, `tools/browser-limits.js`, `tools/browser-bfcache.js`, `architecture.md`, `README.md`, `docs/decisions.md`, `docs/verification.md`.

### 메인 브라우저 확인 / 실제 화면 캡처 절차

1. 이 저장소에서 `npm run dev -- 0`으로 표시된 URL 또는 메인의 통합 로컬 URL을 엽니다. 초기 첫 과제는 시드 17/밝기 0. JSON 내보내기·가져오기·저장·불러오기가 비활성인지 확인합니다. 밝기 6 → `파이프라인 실행`: 실패, 차이 지도. 밝기 12 → 실행: MAE/RMSE 0, 02 과제 열림. `단서`는 진행을 저장하지 않습니다.
2. `작업 모드` → `자유 실험`. 기본 600×400 샘플을 사용합니다. 첫 단계 `가우시안 3×3` → 추가할 연산 `Sobel 기울기` → `단계 추가` → 기울기 방향 `크기 / 두 방향 결합` → 증폭 1. 다음 연산 `문턱값` 추가 → 값 60 → `파이프라인 실행`.
3. 데스크톱 `화면` → 전체, `오른쪽 결과` → 3단계. 히스토그램 `이미지` → 오른쪽 결과 단계, `채널` → 밝기. 240,000픽셀, 0/255에 두 봉우리가 실제 계산되어야 합니다. 원본 분포로 바꾸면 다수의 bin이 나옵니다. 이 상태의 이미지 작업 영역을 캡처하면 실제 필터 결과·좌우 비교·분포를 함께 보여 줍니다. 390/320px에서는 `화면` → 결과 또는 좌우 비교, 같은 히스토그램을 포함해 캡처합니다. `실행`은 기존 실행과 같은 계산입니다.
4. `현재 설정 저장` → 프리셋 1, `JSON 내보내기` → 실제 `pixel-kitchen-recipe-v1.json` 다운로드 확인. 숫자 설정만 포함되어야 합니다. 새로고침 → 자유 실험 → 저장 프리셋 선택 → `불러오기` → 실행. 이미지 파일·과제 통과는 복원되지 않습니다. 그 뒤 `순서 초기화` → 내려받은 JSON 가져오기 → 실행해 같은 샘플에서 결과를 비교합니다.
5. 내려받은 JSON을 메인의 로컬 테스트 파일로 복사해 버전 2, 추가 `image` 필드, divisor 0, 단계 5개, 8 KiB 초과 파일을 각각 가져옵니다. 상태 오류, 기존 stage-list/이미지/저장 payload 불변을 확인합니다. 빈/잘못된 숫자 상태의 저장·내보내기도 거절되어야 합니다. 720×480 입력에 4 Sobel 레시피를 적용하면 예산 오류이며 이전 설정은 유지됩니다.
6. 저장을 8개까지 하면 추가 저장이 비활성화됩니다. 선택 삭제 후 번호를 재사용할 수 있고 전체 삭제는 이 키만 제거합니다. 통합 origin에서 다른 앱 데이터/갤러리 요약의 존재·불변 여부만 확인합니다(개인 값 로그 금지). 첫 보기·샘플·JSON 가져오기·과제 실행 모두 `web-lab-progress-v1`을 만들거나 수정하지 않아야 합니다.
7. 브라우저 테스트 컨텍스트에서만 프리셋 키를 손상된 JSON으로 만들면 저장·불러오기가 실패하고 `전체 삭제`로 복구됩니다. 저장 접근/쓰기 거절은 브라우저 대역으로 별도 표시합니다. 개인 이미지 없이 합성 PNG를 가져와 프리셋 저장 → 페이지 이동/back → 픽셀/파일 입력 비움과 시드 17 과제 재시작, 설정만 남는지 확인합니다. BFCache 복귀 뒤 히스토그램 backing size도 512×128이어야 합니다.

이번 구현자의 브라우저 E2E·스크린샷·실제 모바일·다른 엔진·원격 CI·LIVE 배포는 **NOT_RUN**, 메인 담당입니다. 위 옛 BROWSER_LOCAL 결과는 이번 변경 검증으로 재사용하지 않습니다. 과제/샘플 처리·설정 저장을 내구성 있는 독립 완료로 계산하지 않으므로 갤러리 요약은 의도적으로 없습니다(D10). 공개 순위/백엔드 상태도 추가하지 않았습니다.
