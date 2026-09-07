import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const collection = read('collection');
const exhibitions = read('exhibitions');
const documents = read('documents');
const institution = read('institution');
const english = read('locales/en');
const hasHan = value => typeof value === 'string' && /\p{Script=Han}/u.test(value);
const translatedArtworkFields = [
  'title', 'viewingNote', 'makingNote', 'curatorialNote', 'wallNote', 'mediumLabel',
  'suggestedDuration', 'editorialLabel', 'selectedGroupLabel', 'curatorialBasis', 'previewNote',
];
// Proper names retain their source spelling; surrounding museum prose must be English.
const retainedNames = ['林經堯', '王新仁', '林逸文', '張恩滿', '張寶成', '豆泥', '水耕香菜', '心動家族', '綠沙發'];
const proseWithoutNames = value => retainedNames.reduce((text, name) => text.replaceAll(name, ''), value);
const assertEnglish = (value, label) => {
  assert.equal(typeof value, 'string', label);
  assert.ok(value.trim().length > 0, label);
  assert.equal(hasHan(proseWithoutNames(value)), false, `${label}: untranslated museum prose`);
};

test('English overlay covers every Chinese display title and museum-authored artwork field', () => {
  const knownIds = new Set(collection.artworks.map(artwork => artwork.id));
  const neededIds = collection.artworks.filter(artwork =>
    translatedArtworkFields.some(field => hasHan(artwork[field])) || artwork.acquisitionStory,
  ).map(artwork => artwork.id);
  assert.equal(collection.artworks.length, 151);
  assert.deepEqual(Object.keys(english.artworks).sort(), neededIds.sort());
  for (const [id, overlay] of Object.entries(english.artworks)) {
    assert.ok(knownIds.has(id), `Unknown artwork ${id}`);
    assert.ok(Object.keys(overlay).every(key => [...translatedArtworkFields, 'acquisitionStory'].includes(key)), id);
  }
  for (const artwork of collection.artworks) {
    const overlay = english.artworks[artwork.id] ?? {};
    for (const field of translatedArtworkFields) {
      if (hasHan(artwork[field])) {
        assertEnglish(overlay[field], `${artwork.id}.${field}`);
        assert.notEqual(overlay[field], artwork[field]);
      }
    }
    if (!hasHan(artwork.title)) assert.equal(overlay.title, undefined, `Keep source title: ${artwork.title}`);
    for (const factualField of ['id', 'tokenId', 'contract', 'chain', 'artist', 'description', 'image', 'theme', 'featured', 'curatorialOrder', 'selectedGroup', 'sourceUrls', 'mediaStatus']) {
      assert.equal(Object.hasOwn(overlay, factualField), false, `Do not overwrite ${artwork.id}.${factualField}`);
    }
  }
});

test('all 32 selected guides have complete English viewing, making and curatorial text', () => {
  const selected = collection.artworks.filter(artwork => artwork.featured);
  assert.equal(selected.length, 32);
  const guideFields = ['viewingNote', 'makingNote', 'curatorialNote', 'wallNote', 'mediumLabel', 'suggestedDuration', 'editorialLabel', 'selectedGroupLabel'];
  for (const artwork of selected) {
    const overlay = english.artworks[artwork.id];
    for (const field of guideFields) assertEnglish(overlay[field], `${artwork.id}.${field}`);
    assert.notEqual(overlay.viewingNote, overlay.makingNote, artwork.id);
    assert.notEqual(overlay.curatorialNote, overlay.viewingNote, artwork.id);
    assert.equal(overlay.editorialLabel, 'Museum viewing guide and curatorial interpretation');
  }
});

test('translated collection stories retain evidence status, sources and open questions', () => {
  const stories = collection.artworks.filter(artwork => artwork.acquisitionStory);
  assert.equal(stories.length, 32);
  assert.equal(stories.filter(artwork => artwork.acquisitionStory.status !== 'acquisition_not_yet_reconciled').length, 3);
  for (const artwork of stories) {
    const source = artwork.acquisitionStory;
    const overlay = english.artworks[artwork.id].acquisitionStory;
    assert.deepEqual(Object.keys(overlay).sort(), Object.keys(source).sort(), artwork.id);
    assert.equal(overlay.status, source.status, artwork.id);
    assert.deepEqual(overlay.sourceUrls, source.sourceUrls, artwork.id);
    for (const field of ['title', 'artistIntent', 'exhibitionReason']) assertEnglish(overlay[field], `${artwork.id}.${field}`);
    for (const field of ['verifiedFacts', 'openQuestions']) {
      assert.equal(overlay[field].length, source[field].length, `${artwork.id}.${field}`);
      assert.ok(overlay[field].length > 0, `${artwork.id}.${field}`);
      overlay[field].forEach((value, index) => assertEnglish(value, `${artwork.id}.${field}[${index}]`));
    }
  }
});

test('all four English galleries retain the same 32 selected works and explicit groups', () => {
  assert.equal(exhibitions.length, 4);
  assert.deepEqual(Object.keys(english.exhibitions).sort(), exhibitions.map(exhibition => exhibition.id).sort());
  const seen = new Set();
  for (const exhibition of exhibitions) {
    const overlay = english.exhibitions[exhibition.id];
    assert.deepEqual(Object.keys(overlay).sort(), ['title', 'subtitle', 'description', 'introduction', 'question', 'transition', 'editorialLabel', 'groups'].sort());
    for (const field of ['title', 'subtitle', 'description', 'introduction', 'question', 'transition', 'editorialLabel']) assertEnglish(overlay[field], `${exhibition.id}.${field}`);
    assert.equal(overlay.title, exhibition.titleEn);
    assert.deepEqual(overlay.groups.map(group => group.id), exhibition.groups.map(group => group.id));
    for (let index = 0; index < exhibition.groups.length; index++) {
      const source = exhibition.groups[index];
      const group = overlay.groups[index];
      assert.deepEqual(Object.keys(group).sort(), Object.keys(source).sort());
      assert.deepEqual(group.artworkIds, source.artworkIds, source.id);
      assertEnglish(group.title, `${source.id}.title`);
      assertEnglish(group.description, `${source.id}.description`);
      for (const id of group.artworkIds) {
        assert.equal(seen.has(id), false, `Repeated selected artwork ${id}`);
        seen.add(id);
        assert.equal(english.artworks[id].selectedGroupLabel, group.title, id);
      }
    }
    assert.deepEqual(overlay.groups.flatMap(group => group.artworkIds), exhibition.selection.artworkIds);
    for (const id of exhibition.documentIds) assert.ok(english.documents[id], `${exhibition.id}: missing ${id}`);
  }
  assert.equal(seen.size, 32);
});

test('all ten document summaries and credits are translated without replacing reference metadata', () => {
  assert.equal(documents.length, 10);
  assert.deepEqual(Object.keys(english.documents).sort(), documents.map(document => document.id).sort());
  const fields = ['title', 'summary', 'credit', 'displayLabel', 'contextLabel'];
  for (const document of documents) {
    const overlay = english.documents[document.id];
    assert.deepEqual(Object.keys(overlay).sort(), [...fields].sort());
    for (const field of fields) assertEnglish(overlay[field], `${document.id}.${field}`);
    assert.equal(overlay.contextLabel, 'Documentary context; not proof of ownership of this NFT.');
    for (const name of retainedNames.filter(name => document.credit.includes(name))) {
      assert.ok(overlay.credit.includes(name), `${document.id}: retain credit for ${name}`);
    }
  }
});

test('the institutional timeline preserves all dates, document IDs and source URLs', () => {
  const overlay = english.institution;
  const proseFields = ['title', 'introduction', 'authorship', 'collectionScope', 'question', 'editorialLabel'];
  assert.deepEqual(Object.keys(overlay).sort(), [...proseFields, 'timeline', 'sourceUrls'].sort());
  for (const field of proseFields) assertEnglish(overlay[field], `institution.${field}`);
  assert.equal(overlay.timeline.length, 6);
  assert.equal(overlay.timeline.length, institution.timeline.length);
  assert.deepEqual(overlay.sourceUrls, institution.sourceUrls);
  for (let index = 0; index < institution.timeline.length; index++) {
    const source = institution.timeline[index];
    const translated = overlay.timeline[index];
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(source).sort());
    for (const key of Object.keys(source)) {
      if (key === 'title' || key === 'description') assertEnglish(translated[key], `timeline[${index}].${key}`);
      else assert.deepEqual(translated[key], source[key], `timeline[${index}].${key}`);
    }
    for (const id of translated.documentIds) assert.ok(english.documents[id], `Timeline references unknown document ${id}`);
  }
});
