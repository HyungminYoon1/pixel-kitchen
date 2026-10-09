# Decisions

## D01 — Static, independent implementation

- Context: the user approved implementing all six proposed services and adding them to WEB LAB.
- Options: merge into existing services; backend/Sites hosting; independent static Pages repositories.
- Decision: independent pixel-kitchen repository and public GitHub Pages, pure model separated from rendering, no dependencies or new paid services.
- Rationale: fits the current collection, keeps other releases untouched, supports local model verification.
- Affected: architecture.md, dist, test, tools and .github/workflows/pages.yml.
- Review: additions requiring server state or different hosting need a separate decision.

## D02 — Transient, bounded browser state

- Context: these experiments need configuration, not user accounts or retained visitor records.
- Options: server upload/analytics/history; transient browser memory and deliberate local output.
- Decision: no stored visitor state or uploaded data. Bound all controls and model work. Pixel imports, when applicable, never leave the browser; reject unsupported/oversized files and cap decoded work.
- Rationale: privacy and predictable resource use; no API credential or personal profile required.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html and optional WebMCP summaries.
- Review: do not add hidden persistence or make medical/real-traffic/benchmark claims from these models. Use GitHub noreply identity for commits.

## D03 — 계산과 조작의 경계

- Context: 설명만 표시하는 데 그치지 않고 조작한 조건에서 실제 결과를 계산해야 합니다.
- Options: 고정 애니메이션/결과 문구; 범위를 제한한 순수 모델과 동일 상태를 읽는 UI.
- Decision: 알파는 보존하고 가장자리 좌표는 경계 픽셀에 고정합니다. 흑백은 Rec.709 계수로 계산합니다. 파일은 8 MB·디코딩 2,400만 픽셀 이내, 계산 화면은 최대 720×480으로 축소합니다. 샘플 복원은 진행 중 읽기의 결과를 취소합니다.
- Rationale: 재현 가능한 검사와 읽을 수 있는 결과를 제공하고 브라우저 자원 사용을 제한합니다.
- Affected: dist/src/model.js, dist/src/app.js, dist/index.html, dist/styles.css and test/model.test.js.
- Review: 입력 파일 자체는 앱에 저장되지 않습니다. 다운로드만 사용자가 명시적으로 실행합니다.

## D04 — Ordered, bounded processing instead of a single filter

- Context: user explicitly requested a local implementation session upgrading the preset-filter toy into a genuine processing lab; only this repository is owned, no new agents or remote writes.
- Options: stacked CSS filters; unlimited full-frame recomputation; Web Worker plus message copies; pure row iterator with bounded ordered buffers.
- Decision: retain the pure calculation/UI boundary. Add kernel, signed X/Y Sobel, combined magnitude and threshold stages; maximum four passes and 40M sample/channel work units validated before allocation. Snapshot stage settings, calculate 16 rows per yield and schedule in the UI. Keep at most four intermediate RGBA results. All passes byte-round/clamp before the next stage, preserving alpha.
- Rationale: actual intermediate pixels, order-dependent nonlinear operations and inspectable gradients require real processing. The iterator makes cancellation available without extra worker/tool infrastructure, and bounds mobile work rather than assuming desktop speed.
- Affected: dist/src/model.js, dist/src/app.js, dist/src/ui.js, dist/index.html, dist/styles.css, test/pipeline.test.js, architecture.md.
- Review: 40M is an accounting budget, not measured CPU instructions; actual-device mobile responsiveness remains NOT_RUN. Any higher size/pass limit must recheck work, memory and cancellation latency. Model alpha semantics include transparent-neighbor RGB; do not claim linear-light or photographic restoration behavior.

## D05 — Seeded reconstruction, progressive constraints and honest error

- Context: selecting a known preset does not require reconstructing a processing rule. Objectives should teach flat-region invariance, point spread, gradient sign and noncommuting order.
- Options: subjective similarity score; guessed/fixed progress numbers; immediate preset answers; calculated synthetic targets with exact byte metrics and constrained progression.
- Decision: pure challenges.js generates 192x128 seeded noisy scenes and targets from hidden bounded pipelines. Five levels progress from bias through symmetric averaging, signed gradients, threshold order and a four-stage directional edge map. Seeds also vary average coefficients, gradient settings, threshold and final averaging direction. Hide presets in challenges, expose explicit constraints and hypotheses, and require both MAE and RMSE limits plus zero alpha error. Progress and previous attempt error stay only in page memory. A new seed resets progression; pending seed input is labelled and cannot silently change the current target.
- Rationale: observable RGB/point-spread/gradient evidence plus intermediate comparison supports reasoning. MAE and RMSE measure actual byte differences without pretending to validate visual perception. Equivalent admissible pipelines may pass; identifying the unique generating coefficients is not guaranteed.
- Affected: dist/src/challenges.js, dist/src/app.js, dist/index.html, test/pipeline.test.js, README.md.
- Review: thresholds are educational tolerances, not a calibrated statistic. No claim of recovered lost details. Seeds reproduce within this implementation; disclose algorithm changes if targets change. Source-visible solutions are expected in a static learning app, not anti-cheat security.

## D06 — Explicit invalidation, one local decoder and comparison semantics

- Context: async decoding/calculation can finish after a control edit or sample/challenge change. Showing/exporting stale results would give misleading scores and retain unnecessary resources.
- Options: retain previous result with implicit updates; force page reload; invalidate versions and gate export/comparison on a complete current result.
- Decision: clear output previews and metrics on pipeline edits; only current complete output can export. Explicit calculation/import cancellation and pagehide invalidate pending work. Reject concurrent decoders; close every completed bitmap, including stale/oversized ones. Preserve 8 MiB/24MP limits and resize cap. Wipe compares a selected intermediate stage against source/target; inspector uses that selected editing stage's real input. Preserve aspect ratio and subtract canvas borders for pixel coordinates.
- Rationale: bounded in-memory buffers and current-state evidence; no upload, storage, new runtime dependency, backend or network access. PNG is only a deliberate local download. Native decoder completion cannot be forcibly stopped; document the postdecode size-check limitation.
- Affected: dist/src/app.js, dist/src/ui.js, dist/index.html, dist/styles.css, tools/browser-smoke.js, tools/browser-limits.js, .gitignore.
- Review: controlled-delay and synthetic-dimension browser cases are test doubles, not real 25MP decoding evidence. Browser PNG premultiplication/color decoding may change hidden RGB; model alpha tests and actual browser-alpha evidence are separate. Generated QA files are local ignored artifacts, not shipped assets.

## D07 — Independent verification and local-only delivery

- Context: existing tests mostly compared model convolution with its own inspector; this is not an independent arithmetic check. This session explicitly forbids commit/push/deploy/remote writes/new agents.
- Options: reuse production calculations for expected results; external fixture/images or runtime packages; hand-derived fixtures plus a separate scalar oracle and cached local browser tooling.
- Decision: add explicit half-to-even byte reference, hand-derived Sobel ramp and error fixture, independent pipeline reconstruction across four seeds and five objectives, budget/cancellation tests, and local Chromium interaction checks. Use cached Playwright offline, no generated photo assets or copied code. Extend static checks to local module references, pure-model boundaries, forbidden network/storage APIs and UTF-8 without BOM / CRLF. Document LOCAL, BROWSER_LOCAL, test-double and NOT_RUN separately. No changes to hosting workflow and no Git publication.
- Rationale: independently calculated expectations catch shared model/inspector mistakes; browser checks establish actual UI/download behavior without claiming live deployment.
- Affected: test/pipeline.test.js, tools/check.mjs, tools/browser-smoke.js, tools/browser-limits.js, docs/verification.md, README.md, .gitignore.
- Review: external CI/live, other browser engines, real touch devices, predecode memory bounds and perceptual validation are NOT_RUN. Browser QA entrypoints are optional tooling; runtime and npm test/check still have no external package dependency.

## D08 — Safe fresh workspace after actual BFCache return

- Context: on integration 127.0.0.1:4178, normal WEB LAB navigation and browser back produced pagehide.persisted=true / pageshow.persisted=true. The same document returned with source/challenge=null: running failed image validation and the visible hint button threw a null-objective error. Default Playwright initially masked this by disabling BFCache.
- Options: retain previous image/progress for cached return; reload the whole page; explicitly discard transient pixels and initialize a fresh synthetic challenge on persisted pageshow.
- Decision: on pagehide, close the current row iterator, invalidate calculation/import versions, drop image/target references, clear file input and inspector text, and resize all canvases to 1x1 to discard backing pixels. On persisted pageshow, reset progress and the seed control and start level 1 with seed 17; re-register optional page tools using a new lifecycle. Do not restore private files, former pipelines or progress. Normal non-persisted loading keeps its existing initialization. No change to the hidden seed input handler or unrelated services.
- Rationale: a BFCache document needs working data after pagehide cleanup, but retaining/recovering private photos would exceed the transient-data boundary. Explicit reinitialization is small and avoids a new request/reload loop. Keeping/closing the iterator also releases suspended calculation buffers; version checks stop late work from changing the new workspace.
- Affected: dist/src/app.js, tools/browser-bfcache.js, README.md, docs/decisions.md, docs/verification.md. Only ignored output/playwright/bfcache.config.json changes the test browser's default flag; no server/helper or other app changes.
- Review: real local-link BFCache roundtrips and imported synthetic PNG disposal are verified; the in-flight cancellation case uses controlled scheduling and is labelled a test double. Native pending decode still obeys one-decoder/version/close rules; no forced decoder abort or secure memory erasure is claimed. Firefox/WebKit and live deployment remain NOT_RUN.
