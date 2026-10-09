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
