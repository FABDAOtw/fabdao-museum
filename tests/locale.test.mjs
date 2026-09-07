import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/locale.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { resolveLocale, languageURL, applyEnglishOverlay, decodeVisit } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('an explicit language link wins over preferences and keeps the selected work and other query parameters', () => {
  assert.equal(resolveLocale('?lang=en', 'zh-TW'), 'en');
  assert.equal(resolveLocale('?lang=zh-TW', 'en'), 'zh-TW');
  assert.equal(resolveLocale('', 'en'), 'en');
  assert.equal(resolveLocale('?lang=unknown', 'en'), 'en');
  assert.equal(resolveLocale('', null), 'zh-TW');
  const current = 'https://fabdao-museum.mashbean.net/?lang=zh-TW&quality=low#artwork=tezos_token_86';
  const changed = new URL(languageURL(current, 'en'));
  assert.equal(changed.searchParams.get('lang'), 'en');
  assert.equal(changed.searchParams.get('quality'), 'low');
  assert.equal(changed.hash, '#artwork=tezos_token_86');
  assert.equal(changed.origin, new URL(current).origin);
});

test('editorial translation cannot replace token identities, originals, rights, display order, or evidence links', () => {
  const collection = { verifiedAt: '2026-09-06', wallets: [{ address: 'original-wallet' }], artworks: [{
    id: 'one', title: '作品', artist: '原作者', theme: 'generative', chain: 'Tezos', tokenId: '86', contract: 'original-contract',
    artifactUrl: 'https://example.com/ipfs/original?fxhash=original-seed', description: '作者原文', license: 'original-license',
    featured: true, curatorialOrder: 4, acquisitionStory: { status: 'partial', title: '故事', artistIntent: '意圖', exhibitionReason: '原因', verifiedFacts: ['已知'], openQuestions: ['未知'], sourceUrls: ['https://example.com/evidence'] },
  }] };
  const exhibitions = [{ id: 'generative', theme: 'generative', title: '生成', titleEn: 'Generative', subtitle: '', description: '', color: '#fff', groups: [{ id: 'rules', title: '規則', description: '', artworkIds: ['one'] }], sourceUrls: ['https://example.com/exhibition'] }];
  const documents = [{ id: 'document', title: '文件', theme: 'generative', type: 'protocol', summary: '摘要', url: 'https://example.com/document', date: '2023-03' }];
  const institution = { title: '本館', introduction: '介紹', question: '問題', authorship: '編輯', collectionScope: '邊界', sourceUrls: ['https://example.com/institution'], timeline: [{ date: '2023', title: '事件', description: '脈絡', documentIds: ['document'], sourceUrls: ['https://example.com/event'] }] };
  const baseline = structuredClone({ collection, exhibitions, documents, institution });
  const result = applyEnglishOverlay(collection, exhibitions, documents, institution, {
    artworks: { one: { id: 'replacement', title: 'Work', artist: 'replacement', chain: 'Ethereum', tokenId: 'other', contract: 'other', artifactUrl: 'https://other.example/reseeded', description: 'Translated original', license: 'other', featured: false, curatorialOrder: 0, wallNote: 'Look here.', acquisitionStory: { status: 'complete', title: 'Story', verifiedFacts: ['Known'], openQuestions: ['Unknown'], sourceUrls: ['https://other.example/evidence'] } } },
    exhibitions: { generative: { theme: 'other', title: 'Generative', sourceUrls: [], groups: [{ id: 'rules', title: 'Rules', description: 'Observe repetition.', artworkIds: ['replacement'] }] } },
    documents: { document: { title: 'Document', summary: 'Summary', url: 'https://other.example/document', date: '2030', contextLabel: 'Public source' } },
    institution: { title: 'Museum', authorship: 'Editorial responsibility', collectionScope: 'Scope', sourceUrls: [], timeline: [{ date: '2023', title: 'Event', description: 'Context', documentIds: [], sourceUrls: [] }] },
  });
  assert.deepEqual({ collection, exhibitions, documents, institution }, baseline, 'source objects must remain untouched');
  const translated = result.collection.artworks[0];
  for (const key of ['id', 'artist', 'chain', 'tokenId', 'contract', 'artifactUrl', 'description', 'license', 'featured', 'curatorialOrder']) assert.deepEqual(translated[key], collection.artworks[0][key], key);
  assert.equal(translated.title, 'Work');
  assert.equal(translated.wallNote, 'Look here.');
  assert.equal(translated.acquisitionStory.title, 'Story');
  assert.equal(translated.acquisitionStory.status, 'partial');
  assert.deepEqual(translated.acquisitionStory.sourceUrls, collection.artworks[0].acquisitionStory.sourceUrls);
  assert.deepEqual(result.exhibitions[0].groups[0].artworkIds, ['one']);
  assert.equal(result.exhibitions[0].groups[0].title, 'Rules');
  assert.equal(result.documents[0].url, documents[0].url);
  assert.equal(result.documents[0].date, documents[0].date);
  assert.equal(result.institution.authorship, 'Editorial responsibility');
  assert.equal(result.institution.timeline[0].title, 'Event');
  assert.deepEqual(result.institution.timeline[0].documentIds, ['document']);
  assert.deepEqual(result.institution.timeline[0].sourceUrls, institution.timeline[0].sourceUrls);
});

test('the actual English overlay retains all original artist statements and collection identifiers', async () => {
  const [collection, exhibitions, documents, institution, overlay] = await Promise.all(['collection', 'exhibitions', 'documents', 'institution', 'locales/en'].map(name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse)));
  const result = applyEnglishOverlay(collection, exhibitions, documents, institution, overlay);
  assert.deepEqual(result.collection.artworks.map(art => art.id), collection.artworks.map(art => art.id));
  for (let index = 0; index < collection.artworks.length; index++) {
    const original = collection.artworks[index], translated = result.collection.artworks[index];
    for (const field of ['description', 'artist', 'artifactUrl', 'animation', 'sourceUrl', 'tokenId', 'contract', 'license', 'theme', 'featured', 'curatorialOrder']) assert.deepEqual(translated[field], original[field], `${original.id}: ${field}`);
  }
  assert.ok(result.exhibitions.every(exhibition => exhibition.title !== exhibitions.find(item => item.id === exhibition.id).title));
  assert.ok(result.documents.every(document => document.summary !== documents.find(item => item.id === document.id).summary));
  assert.notEqual(result.institution.authorship, institution.authorship);
  assert.notEqual(result.institution.collectionScope, institution.collectionScope);
});

const now = 2_000_000;
const visit = { savedAt: now - 100, path: '/', locale: 'en', entered: true, room: 2, pages: [1, 0, 2, 0], panel: 'artwork', selectedId: 'one', detailOrigin: 'catalogue', detailIds: ['one', 'two'], panelScroll: 315, catalogueTheme: 'commons', catalogueQuery: '沙發', catalogueFeatured: false, catalogueScroll: 600, catalogueFocus: 'one', quiet: true, manualPause: false, roomCollapsed: true, guideId: 'two', showPerformance: false, view: { position: { x: 5.3, z: -44 }, yaw: 1.2, pitch: -.1 } };

test('changing language restores the work, catalogue search, display pages, and precise view from this visit', () => {
  assert.deepEqual(decodeVisit(JSON.stringify(visit), 'https://fabdao-museum.mashbean.net/?lang=en#artwork=one', now), visit);
});

test('stale, unrelated, malformed or unsafe visit records are not replayed', () => {
  const current = 'https://fabdao-museum.mashbean.net/?lang=en';
  for (const changes of [{ savedAt: now - 900_001 }, { savedAt: now + 20_000 }, { path: '/other' }, { locale: 'zh-TW' }, { room: -1 }, { room: 4 }, { pages: [0, 0, 0] }, { pages: [0, -1, 0, 0] }]) assert.equal(decodeVisit(JSON.stringify({ ...visit, ...changes }), current, now), null);
  for (const raw of [null, '', 'null', '{}', 'invalid']) assert.equal(decodeVisit(raw, current, now), null);
  const sanitized = decodeVisit(JSON.stringify({ ...visit, panel: 'unexpected', panelScroll: -5, detailIds: ['one', 2], view: { position: { x: '5', z: -44 }, yaw: 0, pitch: 0 } }), current, now);
  assert.equal(sanitized.panel, '');
  assert.equal(sanitized.panelScroll, 0);
  assert.deepEqual(sanitized.detailIds, ['one']);
  assert.equal(sanitized.view, undefined);
});
