# FAB DAO Museum

A desktop-first virtual museum and public-source collection catalogue for FAB DAO. Traditional Chinese interface; classical galleries; first-person navigation; no login or wallet connection.

**Public website:** https://fabdao-museum.mashbean.net  
**Planned future domain:** https://museum.fabdao.world (not configured yet)

## What is implemented

- Four connected galleries: 生成之間 / 群山成島 / 收藏作為行動 / 留白與記憶.
- Procedural fluted columns, arch voussoirs, cornices and dentils, coffered skylights, stone urns, brass picture frames and tiled stone floors. Decorative urns are architectural elements, not NFTs.
- Three.js WebGL2, PBR architecture, environment lighting, directional shadows, SSAO and ACES output. Art previews use sRGB; the HTML detail viewer preserves the image independently of the gallery lighting.
- WASD movement, arrow-key movement/turning, drag-to-look, optional pointer lock, collision, pause, map teleportation and three quality levels.
- 32 curated first-exhibition previews, with art rotation by room; 10 permanent document panels beside the arches.
- Searchable catalogue of 151 publicly indexed holdings, artwork attribution, source links, image zoom, document summaries and a WebGL-unavailable fallback.
- Relative asset paths and stable chain/contract/token identifiers for domain migration.

## Stack and development

Node.js 22.12+ (tested with Node 24), Three.js, TypeScript, Vite; Cloudflare Workers Static Assets. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
npm test
npm run build
```

For browser checks, install Chrome and run `node tests/browser-qa.mjs`. `MUSEUM_URL` selects a deployment. The output directory can be configured with `MUSEUM_OUTPUT`; it defaults to `../../output/fabdao-museum` in this workspace. Browser checks exercise real rendering, controls, map navigation, search, metadata, documents, image zoom, quality settings, rotation and WebGL fallback. They do not imply cross-browser or cross-device performance acceptance.

```sh
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

No application secrets or API keys are needed. Deployment uses the operator's existing Cloudflare authentication, which is never stored in this repository. The GitHub repository is private; the deployed museum and its public-source data are publicly readable.

## Collection and editorial workflow

See [`public/data/README.md`](public/data/README.md) for exact source, ownership, media and reproduction boundaries. `scripts/collection-curation.json` keeps editorial choices separate from indexer responses. `exhibitions.json` and `documents.json` contain authored summaries and their public references.

```sh
node scripts/ingest-collection.mjs
python3 scripts/cache-artworks.py
node scripts/ingest-collection.mjs --offline
npm test
npm run build
```

Inspect new tokens and media before deploying a refreshed snapshot. Positive balances establish indexed holdings, not purchases, selection votes, copyright ownership or a complete historic archive. Metadata pending in the upstream indexer remains visible as a holding with no invented title/image. Classification outside the 32 reviewed first-exhibition pieces uses explicit editorial rules and may need further curatorial review.

## Media, rights and current scope

The first exhibition uses cached resized previews from real token metadata (one explicitly documented artist-CDN alternative). Originals, animation, executable art, PDF publications and 3D artworks remain available through original-source links; they are not all playable inside the gallery. Per-token licences are preserved where metadata supplies them. Rights remain with their respective authors.

This initial museum is a procedural architectural implementation. It does not yet contain artist-modelled architectural sculptures, offline baked global illumination, multiplayer, an avatar camera, VR, full acquisition/transfer history, Base holdings or proposal-decision reconciliation. Chrome desktop and a narrow-screen catalogue are tested; Safari/Firefox and a representative low-power device still need acceptance testing.

## Moving to museum.fabdao.world

1. Confirm management of the `fabdao.world` zone and configure the new Worker custom domain.
2. Add the new binding to `wrangler.jsonc`; verify HTTPS and all relative artwork/data paths.
3. Update the advertised website URL and any later canonical/social metadata.
4. Once the new site is accepted, configure the old hostname to redirect each path to the new one.

The current task does not change DNS for `museum.fabdao.world`.
