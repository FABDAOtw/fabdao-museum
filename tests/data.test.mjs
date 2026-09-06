import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const readData = async name => JSON.parse(await readFile(path.join(publicRoot, 'data', `${name}.json`), 'utf8'));
const [collection, exhibitions, documents] = await Promise.all(['collection', 'exhibitions', 'documents'].map(readData));
const httpsSource = (value, label) => {
  assert.equal(typeof value, 'string', `${label} is missing`);
  const source = new URL(value);
  assert.equal(source.protocol, 'https:', `${label} must retain an HTTPS source`);
  assert.ok(source.hostname, `${label} has no host`);
};
const text = (value, label) => assert.ok(typeof value === 'string' && value.trim().length > 0, `${label} is missing`);

test('the inaugural snapshot contains 151 distinct holdings with consistent chain counts', () => {
  assert.equal(collection.artworks.length, 151);
  assert.equal(collection.counts.total, collection.artworks.length);
  assert.equal(new Set(collection.artworks.map(work => work.id)).size, 151);
  const tokenKeys = collection.artworks.map(work => `${work.chain}:${work.chain === 'ethereum' ? work.contract.toLowerCase() : work.contract}:${work.tokenId}`);
  assert.equal(new Set(tokenKeys).size, 151, 'the same on-chain token must not be counted under multiple catalogue IDs');
  for (const chain of ['ethereum', 'tezos']) {
    assert.equal(collection.artworks.filter(work => work.chain === chain).length, collection.counts[chain]);
  }
  assert.ok(Number.isFinite(Date.parse(collection.verifiedAt)), 'the snapshot needs a verification date');
});

test('holdings retain wallet, token, and evidence references without inferring purchases', () => {
  const wallets = new Set(collection.wallets.map(wallet => `${wallet.chain}:${wallet.address}`));
  const themes = new Set(exhibitions.map(exhibition => exhibition.theme));
  for (const work of collection.artworks) {
    text(work.id, 'artwork ID');
    text(work.title, `${work.id} title`);
    text(work.artist, `${work.id} artist or explicit unknown credit`);
    text(work.contract, `${work.id} contract`);
    assert.match(String(work.tokenId), /^\d+$/, `${work.id} token ID`);
    assert.ok(wallets.has(`${work.chain}:${work.wallet}`), `${work.id} points to an unrecorded wallet`);
    assert.ok(themes.has(work.theme), `${work.id} has no gallery classification`);
    assert.ok(Number(work.quantity) > 0, `${work.id} has no held quantity`);
    assert.equal(work.ownershipStatus, 'verified_owned');
    assert.equal(work.acquiredByPurchase, null, `${work.id} must not turn a balance snapshot into purchase evidence`);
    httpsSource(work.sourceUrl, `${work.id} source`);
    assert.ok(Array.isArray(work.sourceUrls) && work.sourceUrls.length > 0, `${work.id} lacks evidence references`);
    for (const source of work.sourceUrls) httpsSource(source, `${work.id} evidence reference`);
  }
});

test('each of the four galleries has eight ordered, readable local featured previews', async () => {
  assert.equal(exhibitions.length, 4);
  assert.equal(new Set(exhibitions.map(exhibition => exhibition.id)).size, 4);
  assert.equal(new Set(exhibitions.map(exhibition => exhibition.theme)).size, 4);
  for (const exhibition of exhibitions) {
    const featured = collection.artworks.filter(work => work.theme === exhibition.theme && work.featured);
    assert.equal(featured.length, 8, `${exhibition.title} requires eight inaugural works`);
    assert.equal(new Set(featured.map(work => work.curatorialOrder)).size, 8, `${exhibition.title} has ambiguous hanging order`);
    for (const work of featured) {
      assert.equal(work.mediaStatus, 'local_preview_verified', `${work.title} has no verified wall preview`);
      assert.match(work.image, /^\/artworks\/[A-Za-z0-9._-]+$/, `${work.title} must use a portable local preview`);
      const imagePath = path.resolve(publicRoot, `.${work.image}`);
      assert.ok(imagePath.startsWith(publicRoot), 'preview path escapes the public asset root');
      const bytes = await readFile(imagePath);
      assert.ok(bytes.length > 100, `${work.title} preview is empty or truncated`);
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
      assert.ok(jpeg || png || webp, `${work.title} preview is not a supported raster file`);
      assert.ok(work.imageWidth > 0 && work.imageHeight > 0, `${work.title} needs intrinsic dimensions`);
      httpsSource(work.previewSource, `${work.title} preview provenance`);
      text(work.previewKind, `${work.title} preview type`);
    }
  }
  assert.equal(collection.counts.featured, 32);
});

test('all ten documents have source context, are classified as documents, and are linked by a gallery', () => {
  assert.equal(documents.length, 10);
  assert.equal(new Set(documents.map(document => document.id)).size, documents.length);
  const linkedDocuments = new Set(exhibitions.flatMap(exhibition => exhibition.documentIds));
  const documentsById = new Map(documents.map(document => [document.id, document]));
  for (const document of documents) {
    for (const field of ['id', 'title', 'type', 'summary', 'credit', 'verificationStatus']) text(document[field], `${document.id} ${field}`);
    httpsSource(document.url, `${document.id} original document`);
    assert.ok(document.sourceUrls?.length > 0, `${document.id} lacks source context`);
    for (const source of document.sourceUrls) httpsSource(source, `${document.id} evidence reference`);
    assert.equal(document.display.isCollectionHolding, false, `${document.id} must not be presented as an owned NFT`);
    assert.equal(document.display.mode, 'summary_and_source_link');
    assert.ok(Number.isFinite(Date.parse(document.lastVerifiedAt)), `${document.id} lacks a verification date`);
    assert.ok(linkedDocuments.has(document.id), `${document.id} is orphaned from the curatorial plan`);
  }
  for (const exhibition of exhibitions) {
    text(exhibition.title, 'gallery title');
    text(exhibition.description, `${exhibition.id} curatorial text`);
    assert.equal(exhibition.curatorialInterpretation, true, `${exhibition.id} must identify its editorial interpretation`);
    assert.ok(exhibition.documentIds.length > 0, `${exhibition.id} has no documents`);
    for (const id of exhibition.documentIds) {
      const document = documentsById.get(id);
      assert.ok(document, `${exhibition.id} references missing document ${id}`);
      assert.ok(document.theme === exhibition.theme || document.themes?.includes(exhibition.theme), `${id} is not associated with ${exhibition.id}`);
    }
  }
});
