# Collection provenance

`collection.json` is a current-holdings catalogue with a separate curatorial layer. Its `verifiedAt` records the public API snapshot time; it does not imply a direct RPC audit or historical acquisition review.

## Scope

- Ethereum mainnet: `0x992f0201ff7ee158a8baf638549d0ad1cbcc27ef`, supplied by the museum initiator as the art-bank address; balances queried through Blockscout.
- Tezos: `tz1cpZ7eLovJigqcUsfbjmquuezjToZLtGUZ`, `fabcollect.tez`, documented by [FIP-2](https://hackmd.io/@mashbean/SklFizJ4T); positive token balances queried through TzKT, descriptions and artist aliases enriched through Objkt.
- The September 2026 snapshot contains 151 art tokens: 126 Tezos and 25 Ethereum. Two domain-name NFTs and two utility/fungible tokens are recorded in `excludedTokens` instead of the artwork catalogue.
- Eleven Ethereum records return unsigned or pending-edition placeholders in the indexer. These remain holdings records, have `metadataStatus: pending_platform_metadata`, and are not selected for the first exhibition.
- Treasury wallets, Supporter, 1947March, Base, unowned proposals, and the complete Project % collection are outside this balance inventory.

`verified_owned` means a positive balance was present in the stated public indexer snapshot. An inbound token may be a purchase, gift, airdrop, or transfer. `acquiredByPurchase` is intentionally null until acquisition transactions and decisions are reconciled. Historical holdings that have been transferred out require a separate transfer-history ingestion.

## Media

The 32 featured exhibits and 104 additional catalogue works use same-origin JPEG previews: 136 cached previews in total (52,588,579 bytes), covering 97.1% of the 140 works whose metadata currently provides a preview. Images are at most 1200 pixels on the longest edge and resized without cropping from real token previews. `media-manifest.json` records source URL, original URI, hash, dimensions, size, and retrieval time.

Four works — “Sebelum Jadi Abu”, NYOK, Split Logic #13, and Terrarium 022 — expose large animated/video media through their preview URI and exceeded the deliberately imposed 16 MiB source-download cap. Their `image` is null and `mediaStatus` is `preview_unavailable`; original URLs and failed-attempt evidence remain available. No generic icon or invented image replaces them. Along with the 11 pending-metadata holdings, these four are excluded from image-based wall rotations. Public IPFS gateways also returned temporary HTTP 429 responses; a bounded pass through an independent gateway recovered the other missing previews.

Generativemasks #2422 uses the exact edition preview from the artist's official gallery CDN because the original IPFS URI timed out through three gateways. Its `previewKind`, `previewSources`, and `previewSourceEvidence` preserve this distinction. Its palette can differ from a live execution of the generative artwork.

Interactive art, moving image, GLB, and PDF originals remain external `artifactUrl`/`animation` links. A still preview is not a substitute for the original executable work. Every available metadata preview has been attempted with bounded retries. Licences and rights are preserved when present in token metadata; token ownership is not represented as a copyright transfer or a new licence.

For Nusantara Archive publications, the person or collective named in the edition title is credited separately from the `issuer: RikeyT` platform account. Description-level credits also distinguish Shepard Fairey from issuer Pussy Riot; Tina G's photography from issuer Danny G; and collaborators bjorn calleja/eskalator3 and Ann Chou/Nullbaysea. Themes, ordering, and featured flags are editorial decisions saved in `scripts/collection-curation.json`; they are not claims made by the tokens. `themeStatus` distinguishes the 32 curated first-exhibition works, 10 additional metadata-reviewed classifications, and 109 provisional rule-based classifications.

## Reproduce

From the repository root:

```sh
node scripts/ingest-collection.mjs
python3 scripts/cache-artworks.py --all
node scripts/ingest-collection.mjs --offline
```

The first command requests public TzKT, Blockscout, and Objkt APIs, with pagination. The second requires Python 3, curl, and macOS `sips`; `--all` requests all available previews and preserves prior successful cached previews. Omitting `--all` requests only featured works. It runs eight downloads in parallel, with a default 10-second timeout and at most three URLs per artwork. It writes the manifest atomically after each result. An optional bounded recovery pass can prioritize another public gateway, for example `--gateway https://ipfs.verse.works --attempts 1`. The final command rebuilds the catalogue from the saved snapshots and media manifest without network access. Changing the wall selection does not delete earlier previews.

`raw/` contains only public balance and metadata responses; no Google Drive private documents, KYC worksheets, wallet secrets, or authentication tokens are included.
