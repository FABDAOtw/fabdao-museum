# FAB DAO Museum

A desktop-first virtual museum and public-source collection catalogue for FAB DAO. Traditional Chinese interface; classical galleries; first-person navigation; no login or wallet connection.

**Public website:** https://fabdao-museum.mashbean.net  
**Planned future domain:** https://museum.fabdao.world (not configured yet)

## What is implemented

- Four connected galleries: 生成之間 / 群山成島 / 收藏作為行動 / 留白與記憶.
- Procedural fluted columns, arch voussoirs, cornices and dentils, coffered skylights, brass picture frames and low-contrast tiled stone floors. Each room has distinct furniture and a clear circulation route; the commons gallery includes the original Green Sofa GLB.
- Three.js WebGL2, PBR architecture, environment lighting, directional shadows, SSAO and ACES output. Art previews use sRGB; the HTML detail viewer preserves the image independently of the gallery lighting.
- WASD movement, arrow keys and vertical keyboard look, drag-to-look, optional pointer lock, collision, pause, map teleportation, frontal artwork positioning, a 32-work guided route, quiet mode and three quality levels.
- 32 fixed first-exhibition works (8 per gallery), with two six/two-work wall pages in the memory gallery. Shared documents follow the curatorial reference order on reading tables and accessible panels.
- Searchable catalogue of 151 publicly indexed holdings, artwork attribution, source links, fit/100%/zoom/pan/fullscreen image viewing, contextual previous/next and return navigation, shareable artwork URLs, document summaries and a WebGL-unavailable fallback.
- Relative asset paths and stable chain/contract/token identifiers for domain migration.

## Stack and development

Node.js 22.12+ (tested with Node 24), Three.js, TypeScript, Vite; Cloudflare Workers Static Assets. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
npm test
npm run build
```

Round-two validation includes data and navigation tests, asynchronous scene replacement/disposal tests, and native-media activation/disposal tests. These do not replace browser visual or playback acceptance. `tests/browser-qa.mjs` records the original round-one automated flow and is now historical: its selectors and rotation assumptions need updating before reuse. In Codex desktop, use the approved CUA browser tools for UI checks. Round-two browser acceptance was blocked by the locked Mac at delivery; do not treat round-one screenshots as evidence of this revision.

```sh
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

No application secrets or API keys are needed. Deployment uses the operator's existing Cloudflare authentication, which is never stored in this repository. The GitHub repository is private; the deployed museum and its public-source data are publicly readable.

## Collection and editorial workflow

See [`public/data/README.md`](public/data/README.md) for exact source, ownership, media and reproduction boundaries. `scripts/collection-curation.json` keeps editorial choices separate from indexer responses. `exhibitions.json`, `documents.json` and `institution.json` contain authored groupings, cross-references, a timeline and source boundaries. Every first-exhibition work has separate viewing/making/curatorial notes; three expanded collection stories distinguish documented artist intent and holdings from missing decision/transaction evidence.

```sh
node scripts/ingest-collection.mjs
python3 scripts/cache-artworks.py
node scripts/ingest-collection.mjs --offline
npm test
npm run build
```

Inspect new tokens and media before deploying a refreshed snapshot. Positive balances establish indexed holdings, not purchases, selection votes, copyright ownership or a complete historic archive. Metadata pending in the upstream indexer remains visible as a holding with no invented title/image. Classification outside the 32 reviewed first-exhibition pieces uses explicit editorial rules and may need further curatorial review.

## Media, rights and current scope

The first exhibition uses cached resized previews from real token metadata (one explicitly documented artist-CDN alternative). Rain Blooms and Directrix have explicit-activation original HTML viewers in opaque sandboxed iframes. Your First Green Sofa has a verified self-contained original GLB in the gallery and an on-demand rotatable viewer. All other native media retain source links. Closing or changing a work disposes its viewer. External availability remains dependent on its publisher/IPFS gateway; iframe load alone is not successful artwork playback. Per-token licences are preserved where metadata supplies them. Rights remain with their respective authors.

This initial museum is a procedural architectural implementation. It does not yet contain artist-modelled architectural sculptures, offline baked global illumination, multiplayer, an avatar camera, VR, full acquisition/transfer history, Base holdings or proposal-decision reconciliation. Round-one Chrome and narrow-screen checks were completed before this revision. Round two still requires visual/playback acceptance after unlocking the Mac, plus Safari/Firefox and a representative low-power device.

## Moving to museum.fabdao.world

1. Confirm management of the `fabdao.world` zone and configure the new Worker custom domain.
2. Add the new binding to `wrangler.jsonc`; verify HTTPS and all relative artwork/data paths.
3. Update the advertised website URL and any later canonical/social metadata.
4. Once the new site is accepted, configure the old hostname to redirect each path to the new one.

The current task does not change DNS for `museum.fabdao.world`.
