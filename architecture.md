# PIXEL KITCHEN architecture

## Purpose

Local image-processing lab with filter-reconstruction challenges, ordered 3x3 kernels / Sobel gradients / thresholds, computed byte-error heatmaps, intermediate-stage inspection, before/after wipe, local raster import and final PNG export.

## Structure

Independent static GitHub Pages site at /pixel-kitchen/. dist/src/model.js owns pure calculation and bounded pipeline iteration; dist/src/challenges.js owns pure seeded input/target generation and objective rules; dist/src/app.js owns UI, file decoding, scheduling/cancellation and page lifecycle; dist/src/ui.js owns pointer/tool adapters; dist/styles.css owns responsive presentation. source pixels -> bounded pure ordered processing -> Canvas output; UI reads/writes configuration, never evaluates code. The added challenge module belongs to the same pure calculation layer, without a new service or persistence boundary.

At most four stages, a preflight budget of 40,000,000 work units, 720x480 calculation dimensions. Kernel work is 27 units/pixel (+3 for grayscale), Sobel 57, threshold 6; these are conservative sample/channel accounting units, not a hardware instruction count or benchmark. The pure iterator yields every 16 rows; UI schedules the next chunk, invalidates old jobs and accepts only a complete current result. At most four intermediate RGBA buffers are retained. Comparison and target generation are bounded by the 192x128 challenge size. The model independently validates dimensions, stage parameters and the total budget.

Each pass rounds/clamps RGB to 8-bit before the next pass; edge coordinates repeat the nearest pixel. Rec.709 coefficients are applied to encoded RGB bytes (not linear-light luminance). Sobel X/Y keep signed values until G/4*gain+128; magnitude uses hypot(Gx,Gy)/4*gain before byte clipping. Threshold is >= on rounded Rec.709 gray. Alpha passes through unchanged. Convolution includes stored RGB of transparent neighbors; this is an instructional byte model, not premultiplied-alpha photo compositing.

Challenges use opaque deterministic synthetic images, seed range 0..999999, five progressively unlocked objectives, no preset shortcuts, bounded allowable operators and MAE/RMSE plus alpha checks. Error metrics compare the final output to the computed target: RGB channels of pairs that are not both fully transparent; alpha MAE separately over all pixels. Heatmap RGB = (min(255,max-channel-error*display-gain),max-channel-error,0), alpha 255; alpha error also contributes to the per-pixel maximum. Display gain cannot change objective scores. These byte distances are not validated visual-perception statistics or recovery of lost details.

Imports accept PNG/JPEG/WebP up to 8 MiB, one decoder in flight. A decoded bitmap above 24,000,000 pixels is rejected and closed; native decoding itself precedes that check and is controlled by the browser, so this is not a hard predecode memory guarantee. Accepted imports are resized to fit 720x480; new imports enter the free lab with an identity pipeline. Explicit cancel, sample restore or challenge transition invalidates pending decoding; a native decode cannot be forcibly interrupted, but its late result is discarded/closed. No file name/pixels or challenge answer is included in optional tool summaries.

No backend, account, tracking, cookies, visitor persistence, external fonts or runtime API. Input and experiments are transient page memory; explicit image download is user-owned local output, not server storage. Optional page-scoped WebMCP tools use the same validated state/actions as the visible controls, and feature-detect unsupported browsers. Tool summaries contain no private image bytes.

No eval, user HTML injection or remote embeds. External links use noopener/noreferrer. CSP restricts connections and execution; GitHub hosting logs are separate. Only dist is deployed. UTF-8 without BOM / CRLF. Preserve all other repositories.

## Visual direction

orange/charcoal image-editing desk. The working surface opens immediately; no marketing landing page ahead of controls. Keyboard controls, touch input, readable labels and reduced motion are part of the UI. Diagrams/canvas represent actual computed state rather than decorative or fictional results.
