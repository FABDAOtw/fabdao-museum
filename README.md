# FAB DAO Museum

A desktop-first virtual museum and public-source collection catalogue for FAB DAO. Traditional Chinese interface; classical galleries; first-person navigation; no login or wallet connection.

**Public website:** [fabdao-museum.mashbean.net](https://fabdao-museum.mashbean.net)

**Alias domain:** [museum.fabdao.world](https://museum.fabdao.world) (deployed 2026-09-07; forwards to the same content as the primary hostname above)

## What is implemented

- Four connected galleries: 生成之間 / 群山成島 / 收藏作為行動 / 留白與記憶.
- Procedural fluted columns, arch voussoirs, cornices and dentils, coffered skylights, brass picture frames and low-contrast tiled stone floors. Each room has distinct furniture and a clear circulation route; the commons gallery includes the original Green Sofa GLB.
- Three.js WebGL2, PBR architecture, environment lighting, directional shadows and ACES output. The gallery renders on demand and stops redrawing while idle. Balanced quality uses direct rendering; high quality adds SSAO at half resolution. Art previews use sRGB; the HTML detail viewer preserves the image independently of the gallery lighting.
- WASD movement, arrow keys and vertical keyboard look, collision, pause, map teleportation, frontal artwork positioning, quiet mode and three quality levels. Dragging grabs the scene (drag right to move the scene right); pointer-locked free look follows first-person game directions. Mouse sensitivity and vertical inversion are adjustable and saved locally.
- All 136 holdings with verified local previews can be displayed across 13 wall batches. Permanent previous/next-batch controls, room totals and catalogue access make the extended collection reachable. Galleries load as needed; each replacement is prepared before the current wall is removed, and failed initial loads have a retry control.
- The 32 fixed first-exhibition selections (8 per gallery) retain their authored groups and guided route. Extended display does not turn provisional classifications into formal curatorial selections. Shared documents follow the curatorial reference order on reading tables and accessible panels.
- Searchable catalogue of 151 publicly indexed holdings, including 15 records still without usable previews. It provides artwork attribution, source links, fit/100%/zoom/pan/fullscreen image viewing, contextual previous/next and return navigation, shareable artwork URLs, document summaries and a WebGL-unavailable fallback.
- Traditional Chinese and English interfaces are available through `?lang=zh-TW` and `?lang=en`. English editorial overlays translate museum-authored labels and interpretation while retaining original artist text, token identifiers, evidence URLs and display order.
- Original-media handling is explicit and opt-in: reviewed interactive HTML works use an opaque sandbox with activation, timeout, retry and preview fallback, the Directrix viewer has a checked Filebase playback gateway while preserving its canonical IPFS source, the Green Sofa is a self-contained GLB, and unsupported external model resources return to the preview with a source link.
- Relative asset paths and stable chain/contract/token identifiers for domain migration.

| Gallery | Displayable works | Works per batch | Batches | Guided selections |
| --- | ---: | ---: | ---: | ---: |
| 生成之間 | 75 | 12 | 7 | 8 |
| 群山成島 | 30 | 12 | 3 | 8 |
| 收藏作為行動 | 12 | 12 | 1 | 8 |
| 留白與記憶 | 19 | 10 | 2 | 8 |
| Total | 136 | — | 13 | 32 |

## Stack and development

Node.js 22.12+ (tested with Node 24), Three.js, TypeScript, Vite; Cloudflare Workers Static Assets. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
npm test
npm run build
```

Round-three validation passed all 45 tests and `npm run build`. Round-four local validation passes all 59 tests, `npm run build`, and `git diff --check`. Coverage now includes bilingual overlays, language-visit restoration, the domain-alias Worker contract, media activation/fallback/disposal, and the previously reviewed source boundaries. Automated tests do not establish successful external artwork playback.

Round-three browser acceptance used the approved CUA tools at 1280 px and 1440 px desktop widths, plus a 390 px mobile viewport. Catalogue cards showed no overlap or horizontal overflow at those sizes. Checks also covered all four room transitions, the second batch of the fourth gallery, and dragging right moving the scene right. The mobile viewport check is a layout check, not acceptance on a physical phone or a low-power device.

`tests/browser-qa.mjs` records the original round-one automated flow and is historical: its selectors and rotation assumptions need updating before reuse.

```sh
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

No application secrets or API keys are needed. Deployment uses the operator's existing Cloudflare authentication, which is never stored in this repository. The source repository is public under [FABDAOtw/fabdao-museum](https://github.com/FABDAOtw/fabdao-museum); the deployed museum and its public-source data are publicly readable.

## Collection and editorial workflow

See [`public/data/README.md`](public/data/README.md) for exact source, ownership, media and reproduction boundaries. `scripts/collection-curation.json` keeps editorial choices separate from indexer responses. `exhibitions.json`, `documents.json` and `institution.json` contain authored groupings, cross-references, a timeline and source boundaries. Every first-exhibition work has separate viewing/making/curatorial notes; three expanded collection stories distinguish documented artist intent and holdings from missing decision/transaction evidence.

```sh
node scripts/ingest-collection.mjs
python3 scripts/cache-artworks.py
node scripts/ingest-collection.mjs --offline
npm test
npm run build
```

Inspect new tokens and media before deploying a refreshed snapshot. Positive balances establish indexed holdings, not purchases, selection votes, copyright ownership or a complete historic archive. Metadata pending in the upstream indexer remains visible as a holding with no invented title/image. Some extended works have metadata-reviewed themes; others retain provisional rule-based classifications. Their display status does not alter `featured`, `selectedGroup` or `themeStatus`. Only verified local previews enter the walls; the other 15 records remain accessible through the catalogue and source links.

## Media, rights and current scope

The display programme uses cached resized previews from real token metadata (one explicitly documented artist-CDN alternative). Rain Blooms and Directrix have explicit-activation original HTML viewers in opaque sandboxed iframes. Your First Green Sofa has a verified self-contained original GLB in the gallery and an on-demand rotatable viewer. All other native media retain source links. Closing or changing a work disposes its viewer; gallery idle rendering does not stop an original the visitor has chosen to run. External availability remains dependent on its publisher/IPFS gateway; iframe load alone is not successful artwork playback. Per-token licences are preserved where metadata supplies them. Rights remain with their respective authors.

This museum is a procedural architectural implementation. It does not yet contain artist-modelled architectural sculptures, offline baked global illumination, multiplayer, an avatar camera, VR, full acquisition/transfer history, Base holdings or proposal-decision reconciliation. Fifteen holdings still lack usable previews. Safari/Firefox, complete native-media playback and a representative low-power device remain acceptance gaps. The performance changes still need controlled benchmarking; the current checks establish neither an FPS improvement multiplier nor acceptance on real low-end hardware.

## museum.fabdao.world alias

[`domain-alias/wrangler.jsonc`](domain-alias/wrangler.jsonc) is deployed to the Cloudflare account **Gimmychang@pm.me's Account** (`b9e60d05860dfe2eaf2db7f9930875c0`), which holds the `fabdao.world` zone (`dc8869a2c7438132c34b39280a5f00d3`). The Worker in [`domain-alias/worker.js`](domain-alias/worker.js) streams every request through to `fabdao-museum.mashbean.net`, so `museum.fabdao.world` serves the same content without a separate deployment of the museum itself.

Deployed 2026-09-07 (`wrangler deploy` from `domain-alias/`, custom domain `museum.fabdao.world`, version `b79b8c1d-d828-4c79-ba1d-f463aded7af4`). Both `https://museum.fabdao.world/` and `https://fabdao-museum.mashbean.net/` return HTTP 200. Remaining follow-ups if the alias becomes the canonical URL:

1. Verify the English query route, GLB range requests, and all relative artwork/data paths on the new hostname beyond the basic 200 check above.
2. Update the advertised website URL and any later canonical/social metadata.
3. Once the new site is accepted as canonical, configure the old hostname to redirect each path to the new one.
