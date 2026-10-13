# Edge-case verification — 2026-10-13 — pixel-kitchen

LOCAL ONLY. Parent integrates/releases. No commit, push, deployment, sibling change or new server. Main loopback server remains running. Baseline tracked tree was clean; starting HEAD: ff04ef7.

## Results and reproducible commands

- NEW ordinary Node tests: **8** in `test/edge-20261013.test.js`. E01 etc. below mean declaration order in that file.
- Initial new regression batch: **3 actual failures** on unchanged production modules; remaining initial cases passed on baseline and are coverage additions, not RED_GREEN. 
- Confirmed defect groups: **2** (group repeated write/delete manifestations by the boundary described below). 
- Full `npm test`: **34/34 PASS**. `npm run check` and `git diff --check`: PASS.
- NEW browser B: `tools/browser-edge-20261013.mjs`, local Chrome, fresh isolated contexts, muted audio, 1440/390/320 pixels, real keyboard and mobile-emulated taps. Full results in `output/playwright/edge-20261013/browser.json`. No uncaught page exceptions; no horizontal overflow.
- CI: new Node file is automatically discovered by existing `node --test` / `npm test` in `.github/workflows/pages.yml`. Workflow unchanged. Browser script is repeatable optional tooling, **NOT in ordinary CI** (Playwright is an existing local QA dependency). Remote CI and LIVE: **NOT_RUN**.

Run from this repository:
```powershell
node --test test/edge-20261013.test.js
npm test
npm run check
node tools/browser-edge-20261013.mjs
git diff --check
```

Browser defaults: existing sibling-root `../output/playwright/implement-20261012/package.json` (Playwright 1.61.1), Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, URL `http://127.0.0.1:59540/pixel-kitchen/`. Overrides: `PLAYWRIGHT_PACKAGE`, `CHROME_PATH`, `EDGE_BASE_URL`; `EDGE_FIXTURES_ONLY=1` runs just the injected fixture group. Dependencies are read only; evidence is written only within this owned repo. Script closes its own browser/contexts and never controls the shared server.

## Actual red / green evidence

E01 no-op setItem and E02 a replaced valid-but-empty readback were reported as successful saves; E03 no-op removeItem reported erasure. Adapter now verifies exact serialized write or null deletion before reporting success.

Production edits: `dist/src/storage.js`. Test doubles are explicit bounded in-memory fixtures, not real device denial/quota measurements or external validation. Readback confirms the value observed immediately afterward; it cannot make two localStorage keys transactional or prevent future concurrent writes.

- `output/playwright/edge-20261013/red.tap`: original new tests before production edits.
- `output/playwright/edge-20261013/green.tap`: same regression tests after minimal changes.
- `output/playwright/edge-20261013/full-test.txt`, `check.txt`: full suite and static check.
- `browser-fixture-baseline.txt` initially timed out because a hardcoded PNG fixture did not decode. Replaced only the fixture with a native canvas-generated 1×1 PNG; `browser-fixture-corrected.txt` passes. This timeout is NOT a product bug or RED_GREEN claim.

Evidence folder is ignored. Red logs are preserved, not reconstructed by reverting code. Previously documented 2026-10-13 bugs are existing work and are not counted here.

## Feature/control matrix

| Feature/control | Concrete test / command | Result and boundary |
| --- | --- | --- |
| Five objectives / seeded synthetic inputs | Existing pipeline.test.js independent reconstruction over seeds/levels; NEW B actual seed17 bias12 solution | PASS; no target or tolerance changes |
| Kernel min/max / one pixel / byte clamp / alpha | NEW E05 ±255 bias independent expected [0,0,0,7]/[255,255,255,7]; existing pipeline arithmetic oracle | PASS; Rec.709, edge replication, byte rounding and alpha unchanged |
| Pipeline stage/work bounds / cancel / retry | Existing pipeline 4-pass/40M bounds; NEW E06 iterator return remains terminal, fresh identity retry | PASS; canceled result never contaminates retry |
| Heatmap / histogram / display gain | NEW E07 gain1/16 leaves zero transparent RGB metric; outside/NaN/string/null reject; E05 alpha bin | PASS; metrics separate from display gain |
| Recipe JSON / exact byte edge / clone | NEW E04 8192 bytes accepted, 8193 rejected, independent clones; B malformed and oversize file inputs | PASS; invalid files preserve output/export state |
| Settings save/load/export/delete / peer isolation | NEW E08 reload, slot reuse, repeated erase and gallery preservation; B real JSON download/load/run | PASS; presets do not create achievements |
| Storage no-op / substituted readback / failed erase | NEW E01–03; B actual error UI with injected setItem no-op | RED_GREEN 3 tests; no schema or retention change |
| Async decode / stale recipe / cancel | NEW B delayed native PNG decode closed after cancel/sample; delayed recipe ignored after workspace reset | PASS TEST_DOUBLE scheduler with native 1×1 generated PNG; native huge decode NOT_RUN |
| Keyboard / empty input / stale output export | NEW B Enter run, ArrowRight inspector, empty bias rejection, export disabled | PASS at 1440/390/320; tap inputs at mobile widths |
| Undo / BFCache / huge file limits | Undo N/A; existing browser-bfcache/browser-limits scripts inventoried | Existing optional scripts NOT_RUN this session; 8MiB/24MP actual-device boundary NOT_RUN |

B = the new browser command above. Existing tests are explicitly marked; running them again does not make them new coverage. No source-string-only test was added.

## Source accounting

- **VERIFIED**: `architecture.md`, `README.md`, `docs/decisions.md` read with authority precedence. `api-spec.md`, `requirements.md` absent in this repo (N/A, not silently skipped).
- **VERIFIED**: modified production modules `dist/src/storage.js`, added executable test/browser files, `package.json`, `.gitattributes`, `.gitignore`, and Pages workflow.
- **PARTIAL**: whole `dist/`, `test/`, `tools/`, `docs/` source review. Inventoried first; inspected applicable storage, model, UI lifecycle and existing regression files. All ordinary tests executed, but this is not a claim of full line-by-line review of every renderer, historical verification note or optional browser script.
- Existing `docs/verification.md` receives a new top link; old LOCAL/CI/LIVE claims remain historical.
- **NOT_INSPECTED / out of scope**: siblings' implementation and private files. No .env/credential values read or printed.

Inventory at intake (repository files, excluding .git/dependencies/output; inventory is not full-file review):

```text
.gitattributes
.gitignore
tools\serve.mjs
tools\check.mjs
tools\browser-validation.js
tools\browser-smoke.js
tools\browser-return-20261013.js
tools\browser-limits.js
tools\browser-bfcache.js
tools\browser-audit-20261013.js
.github\workflows\pages.yml
docs\verification.md
docs\decisions.md
test\recipe.test.js
test\pipeline.test.js
test\model.test.js
README.md
package.json
architecture.md
dist\styles.css
dist\index.html
dist\src\ui.js
dist\src\storage.js
dist\src\recipe.js
dist\src\model.js
dist\src\challenges.js
dist\src\app.js
```

## Capture and limitations

`output/playwright/edge-20261013/viewport-1440.png`, `viewport-390.png`, `viewport-320.png` and injected storage-error capture. Narrow captures inspected for clipping/overlap; no layout/CSS redesign was made. Browser validation covers Chrome emulation, not a physical touchscreen, screen reader, Firefox/WebKit or all OS lifecycle behavior. No actual clinical/audio/photometric or real-world traffic/biology measurement. Concurrency fixtures are deterministic schedules, not exhaustive races. 

See [decision log](decisions.md) for D13. Preserve existing scientific model, game rules, safety and retention boundaries.
