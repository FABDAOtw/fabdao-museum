#!/usr/bin/env node
/** Public, read-only collection ingestion. Run: node scripts/ingest-collection.mjs [--offline]
 * Ownership comes from balances, never from proposals, titles, or marketplace collection pages.
 * Snapshot scope: Ethereum mainnet and Tezos only. Receiving a token is not proof of a purchase.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public/data');
const rawDir = path.join(dataDir, 'raw');
const offline = process.argv.includes('--offline');
const ethWallet = '0x992f0201ff7ee158a8baf638549d0ad1cbcc27ef';
const xtzWallet = 'tz1cpZ7eLovJigqcUsfbjmquuezjToZLtGUZ';
const tzktUrl = `https://api.tzkt.io/v1/tokens/balances?account=${xtzWallet}&balance.gt=0&limit=1000`;
const ethUrl = `https://eth.blockscout.com/api/v2/addresses/${ethWallet}/nft?type=ERC-721%2CERC-1155%2CERC-404`;
const objktUrl = 'https://data.objkt.com/v3/graphql';
await fs.mkdir(rawDir, { recursive: true });
const read = async name => JSON.parse(await fs.readFile(path.join(rawDir, name), 'utf8'));
const save = async (name, value) => fs.writeFile(path.join(rawDir, name), JSON.stringify(value, null, 2) + '\n');
async function getJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json;
}

if (!offline) {
  const balances = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await getJson(`${tzktUrl}&offset=${offset}`);
    balances.push(...page);
    if (page.length < 1000) break;
  }
  await save('tezos-balances.json', balances);
  const items = [];
  let ethPageUrl = ethUrl;
  do {
    const page = await getJson(ethPageUrl);
    items.push(...page.items);
    ethPageUrl = page.next_page_params ? `${ethUrl}&${new URLSearchParams(page.next_page_params)}` : null;
  } while (ethPageUrl);
  await save('ethereum-nft.json', { items, next_page_params: null });
  const holders = [];
  for (let offset = 0; ; offset += 500) {
    const query = `{ token_holder(where: {holder_address: {_eq: "${xtzWallet}"}, quantity: {_gt: 0}}, limit: 500, offset: ${offset}, order_by: {token_pk: asc}) {quantity token {pk token_id fa_contract name description artifact_uri display_uri thumbnail_uri mime metadata creators {creator_address holder {alias address}}}}}`;
    const page = await getJson(objktUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
    holders.push(...page.data.token_holder);
    if (page.data.token_holder.length < 500) break;
  }
  await save('objkt-holdings.json', { data: { token_holder: holders } });
  await save('snapshot-info.json', { fetchedAt: new Date().toISOString(), sources: [tzktUrl, ethUrl, objktUrl] });
}

const tezos = await read('tezos-balances.json');
const ethereum = await read('ethereum-nft.json');
const objkt = await read('objkt-holdings.json');
const snapshot = await read('snapshot-info.json');
const curation = JSON.parse(await fs.readFile(path.join(root, 'scripts/collection-curation.json'), 'utf8'));
const objktMap = new Map(objkt.data.token_holder.map(row => [`${row.token.fa_contract}:${row.token.token_id}`, row.token]));
const ipfs = value => typeof value !== 'string' ? null : value.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${value.slice(7).replace(/^ipfs\//, '')}` : value.startsWith('https://') ? value : null;
const clean = value => typeof value === 'string' ? value.trim() : '';
const pending = value => /WAITING TO BE SIGNED|pending-edition/.test(value || '');
const items = [];
const excludedTokens = [];

function themeFor(title, contract, mime = '') {
  if (curation.overrides[title]?.theme) return curation.overrides[title].theme;
  if (/群島|Nusantara|Mountain|landscape|Kowloon|Village|Terrarium|Turtle|Moonlit|Algoscape|pulau|Geomodulo|Star Atlas|Forest|Sea|Shibuya|ride/i.test(title)) return 'islands';
  if (/FABDAO|Sofa|collector|DECENTRALIZED|心動|Market|proceeds|BURN THIS|Francis BaCOIN/i.test(title)) return 'commons';
  if (/Freedom|21\/29.7|Abandoned|Ashes|Sunflowers|WORD AFTER|BINARY ODE|Waves 2.0|刪|Olden|Czar|стена|Ukraine|Blue fires|Sebelum|Ancestral|Loss|Yesterday|VOICE GEMS|Evanescencia|Mother/i.test(title)) return 'memory';
  return 'generative';
}
function finish(artwork) {
  const override = curation.overrides[artwork.title] || {};
  Object.assign(artwork, override);
  if (override.artistSource) artwork.sourceUrls.push(override.artistSource);
  if (override.previewSourceEvidence) artwork.sourceUrls.push(override.previewSourceEvidence);
  artwork.theme = artwork.theme || themeFor(artwork.title, artwork.contract, artwork.mediaType);
  const list = curation.featured[artwork.theme];
  artwork.curatorialOrder = list.indexOf(artwork.title);
  artwork.featured = artwork.curatorialOrder >= 0;
  artwork.themeStatus = artwork.featured ? 'curated' : override.themeStatus || 'provisional_rule_based';
  artwork.curatorialOrder = artwork.featured ? artwork.curatorialOrder : 100;
  artwork.sourceUrls = [...new Set(artwork.sourceUrls.filter(Boolean))];
  items.push(artwork);
}

for (const row of tezos) {
  const token = row.token, metadata = token.metadata || {}, contract = token.contract.address;
  if (Number(metadata.decimals || 0) > 0 || contract === 'KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS' || ['akaSwap DAO', 'Temple Key'].includes(metadata.name)) {
    excludedTokens.push({ chain: 'tezos', contract, tokenId: token.tokenId, title: metadata.name || null, reason: contract === 'KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS' ? 'domain_name' : 'utility_or_fungible_token', balance: row.balance });
    continue;
  }
  const enriched = objktMap.get(`${contract}:${token.tokenId}`) || {};
  const title = clean(enriched.name || metadata.name) || `未命名 token #${token.tokenId}`;
  const artifact = enriched.artifact_uri || metadata.artifactUri || null;
  const imageUri = enriched.display_uri || metadata.displayUri || metadata.image || enriched.thumbnail_uri || metadata.thumbnailUri || null;
  const mime = enriched.mime || metadata.formats?.find(f => f.uri === artifact)?.mimeType || null;
  const creators = enriched.creators || [];
  const aliases = creators.map(c => clean(c.holder?.alias)).filter(Boolean);
  const creatorAddresses = [...new Set([...creators.map(c => c.creator_address), ...(metadata.creators || [])])];
  const artist = aliases.length ? [...new Set(aliases)].join('、') : '創作者名稱待核對';
  finish({
    id: `tezos_${contract}_${token.tokenId}`, title, artist, artistStatus: aliases.length ? 'platform_profile' : 'name_unresolved',
    creatorAddresses, chain: 'tezos', contract, tokenId: token.tokenId, tokenStandard: token.standard,
    image: ipfs(imageUri), originalImage: ipfs(imageUri), imageUri,
    animation: mime && !mime.startsWith('image/') && mime !== 'application/pdf' && mime !== 'text/plain' ? ipfs(artifact) : null,
    artifactUri: artifact, artifactUrl: ipfs(artifact), thumbnail: ipfs(enriched.thumbnail_uri || metadata.thumbnailUri),
    mediaType: mime, description: clean(enriched.description || metadata.description),
    sourceUrl: `https://objkt.com/tokens/${contract}/${token.tokenId}`,
    ownershipStatus: 'verified_owned', ownershipMethod: 'public_indexer_balance', wallet: xtzWallet, quantity: row.balance,
    firstRecordedAt: row.firstTime, lastTransferAt: row.lastTime, acquiredByPurchase: null,
    metadataUri: enriched.metadata || null, metadataStatus: pending(title) ? 'pending_platform_metadata' : imageUri ? 'available' : 'incomplete',
    mediaStatus: pending(title) ? 'pending_platform_metadata' : ipfs(imageUri) ? 'remote_unchecked' : 'unavailable',
    license: metadata.rights || metadata.license || null,
    sourceUrls: [tzktUrl, objktUrl, `https://tzkt.io/${contract}/tokens/${token.tokenId}`, `https://objkt.com/tokens/${contract}/${token.tokenId}`, ipfs(enriched.metadata)],
  });
}
for (const row of ethereum.items) {
  const metadata = row.metadata || {}, contract = row.token.address_hash.toLowerCase();
  const title = clean(metadata.name) || `${row.token.name || '未命名 token'} #${row.id}`;
  const attributeArtists = (Array.isArray(metadata.attributes) ? metadata.attributes : []).filter(a => /^(artist|creator)$/i.test(clean(a.trait_type || a.name))).map(a => clean(a.value)).filter(Boolean);
  const artist = clean(metadata.artist || metadata.created_by) || attributeArtists.join('、') || '創作者名稱待核對';
  const imageUri = metadata.image || row.image_url || null;
  const mime = metadata.media?.mimeType || (metadata.animation_details?.format === 'MP4' ? 'video/mp4' : null);
  const unavailable = pending(title) || pending(imageUri);
  finish({
    id: `ethereum_${contract}_${row.id}`, title, artist, artistStatus: artist === '創作者名稱待核對' ? 'name_unresolved' : 'token_metadata',
    chain: 'ethereum', contract, tokenId: row.id, tokenStandard: row.token_type,
    image: unavailable ? null : ipfs(imageUri), originalImage: ipfs(imageUri), imageUri,
    animation: ipfs(metadata.animation_url || metadata.animation || row.animation_url || (mime?.startsWith('video/') ? metadata.media?.uri || imageUri : null)),
    artifactUri: metadata.animation_url || metadata.generator_url || metadata.media?.uri || imageUri,
    artifactUrl: ipfs(metadata.animation_url || metadata.generator_url || metadata.media?.uri || imageUri),
    mediaType: mime, description: clean(metadata.description),
    sourceUrl: `https://opensea.io/assets/ethereum/${contract}/${row.id}`,
    ownershipStatus: 'verified_owned', ownershipMethod: 'public_indexer_balance', wallet: ethWallet, quantity: row.value || '1', acquiredByPurchase: null,
    metadataStatus: unavailable ? 'pending_platform_metadata' : imageUri ? 'available' : 'incomplete',
    mediaStatus: unavailable ? 'pending_platform_metadata' : imageUri ? 'remote_unchecked' : 'unavailable',
    license: metadata.license || null,
    sourceUrls: [ethUrl, `https://eth.blockscout.com/token/${contract}/instance/${row.id}`, `https://opensea.io/assets/ethereum/${contract}/${row.id}`, metadata.website, metadata.external_url],
  });
}

// Reapply only successful local previews; retain provenance and original URLs.
let cache = {};
try { cache = JSON.parse(await fs.readFile(path.join(dataDir, 'media-manifest.json'), 'utf8')); } catch {}
for (const artwork of items) {
  const entry = cache[artwork.id];
  if (entry?.path) {
    try { await fs.access(path.join(root, 'public', entry.path)); }
    catch { continue; }
    Object.assign(artwork, { image: entry.path, mediaStatus: 'local_preview_verified', imageWidth: entry.width, imageHeight: entry.height, previewSource: entry.source, previewKind: artwork.previewSources?.includes(entry.source) ? 'official_gallery_preview_resized' : 'metadata_preview_resized', previewVerifiedAt: entry.checkedAt });
  } else if (entry?.status === 'unavailable') {
    Object.assign(artwork, { image: null, mediaStatus: 'preview_unavailable', previewVerifiedAt: entry.checkedAt, previewFailures: entry.attempts, previewUnavailableReason: entry.reason });
  }
}
items.sort((a, b) => a.curatorialOrder - b.curatorialOrder || a.title.localeCompare(b.title));
const output = {
  verifiedAt: snapshot.fetchedAt,
  verificationMethod: 'Public indexer balance snapshots: TzKT / Blockscout; Objkt enriches metadata and artist profile aliases.',
  scope: 'Current positive balances in the two listed art-bank wallets, Ethereum mainnet and Tezos. No Base or treasury-wallet inventory is implied.',
  notes: ['持有不等同購買、評選通過或作者授權；本版未核對逐筆購藏交易。', '主題與首展選件是本館策展層，不是原始 token metadata。', '圖片是原 metadata 預覽；生成、影音、3D 與 PDF 原作請開啟作品來源。', '部分 Ethereum indexer metadata 仍為待簽署／預覽占位，保留館藏記錄並暫不布展。', '提案與 Project % 全系列未併入持有清單；公庫、基金與藝術銀行錢包分開。'],
  wallets: [
    { chain: 'ethereum', address: ethWallet, label: 'FABDAO-Art-Bank', role: 'art_bank_collection', addressSource: 'user_supplied', holdingsSource: ethUrl },
    { chain: 'tezos', address: xtzWallet, label: 'fabcollect.tez', role: 'art_bank_collection', addressSource: 'https://hackmd.io/@mashbean/SklFizJ4T', holdingsSource: tzktUrl },
  ],
  counts: { ethereum: items.filter(a => a.chain === 'ethereum').length, tezos: items.filter(a => a.chain === 'tezos').length, total: items.length, featured: items.filter(a => a.featured).length, localPreviews: items.filter(a => a.mediaStatus === 'local_preview_verified').length, unavailablePreviews: items.filter(a => a.mediaStatus === 'preview_unavailable').length, pendingMetadata: items.filter(a => a.metadataStatus === 'pending_platform_metadata').length, excludedNonArt: excludedTokens.length },
  excludedTokens, artworks: items,
};
await fs.writeFile(path.join(dataDir, 'collection.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output.counts));
