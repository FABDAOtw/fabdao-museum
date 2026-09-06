import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exhibitionWorks, galleryWorks, hasDisplayablePreview, exhibitionDocuments, findExhibit, pageSize } from '../src/curation.js';

const collection = JSON.parse(fs.readFileSync(new URL('../public/data/collection.json', import.meta.url), 'utf8'));
const exhibitions = JSON.parse(fs.readFileSync(new URL('../public/data/exhibitions.json', import.meta.url), 'utf8'));
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const sample = (id, extra = {}) => ({ id, title: id, artist: 'Artist', theme: 'x', image: `/artworks/${id}.jpg`, mediaStatus: 'local_preview_verified', ...extra });

test('extended display never silently changes the 32-work editorial route', () => {
  const extra = sample('transfer', { featured: false, curatorialOrder: 0 });
  const works = [extra, sample('two', { featured: true, curatorialOrder: 2 }), sample('one', { featured: true, curatorialOrder: 1 })];
  assert.deepEqual(exhibitionWorks(works, 'x').map(artwork => artwork.id), ['one', 'two']);
  assert.deepEqual(galleryWorks(works, 'x').map(artwork => artwork.id), ['one', 'two', 'transfer']);
  assert.equal(extra.featured, false);
  assert.equal(extra.selectedGroup, undefined);
  const route = exhibitions.flatMap(exhibition => exhibitionWorks(collection.artworks, exhibition.theme));
  assert.equal(route.length, 32);
  assert.equal(new Set(route.map(artwork => artwork.id)).size, 32);
  for (const exhibition of exhibitions) {
    assert.deepEqual(exhibitionWorks(collection.artworks, exhibition.theme).map(artwork => artwork.id), exhibition.selection.artworkIds);
  }
});

test('display sorting places selections, metadata-reviewed works, then provisional works in stable order', () => {
  const works = [
    sample('provisional-z', { artist: 'Zed' }),
    sample('reviewed-z', { artist: 'Zed', themeStatus: 'metadata_review' }),
    sample('featured-two', { featured: true, curatorialOrder: 1, artist: 'A' }),
    sample('provisional-a2', { artist: 'Amy', title: 'Work 2' }),
    sample('reviewed-a', { artist: 'Amy', themeStatus: 'metadata_review' }),
    sample('featured-one', { featured: true, curatorialOrder: 0, artist: 'Z' }),
    sample('provisional-a1', { artist: 'Amy', title: 'Work 1' }),
  ];
  const before = structuredClone(works);
  const expected = ['featured-one', 'featured-two', 'reviewed-a', 'reviewed-z', 'provisional-a1', 'provisional-a2', 'provisional-z'];
  assert.deepEqual(galleryWorks(works, 'x').map(artwork => artwork.id), expected);
  assert.deepEqual(galleryWorks([...works].reverse(), 'x').map(artwork => artwork.id), expected);
  assert.deepEqual(works, before, 'Ordering must not rewrite source status or mutate the caller array');
  const ties = [sample('b'), sample('a')].map(artwork => ({ ...artwork, title: 'Same' }));
  assert.deepEqual(galleryWorks(ties, 'x').map(artwork => artwork.id), ['a', 'b']);
});

test('unavailable, unverified, remote, and unsafe image paths never create empty frames', () => {
  const rejected = [
    sample('null', { image: null }),
    sample('empty', { image: '' }),
    sample('remote', { image: 'https://example.com/image.jpg' }),
    sample('traversal', { image: '/artworks/../image.jpg' }),
    sample('unknown', { mediaStatus: 'remote_unchecked' }),
    sample('missing', { mediaStatus: 'preview_unavailable' }),
    sample('pending', { mediaStatus: 'pending_platform_metadata' }),
    sample('html', { image: '/artworks/executable.html' }),
  ];
  for (const artwork of rejected) assert.equal(hasDisplayablePreview(artwork), false, artwork.id);
  assert.deepEqual(galleryWorks(rejected, 'x'), []);
  assert.equal(findExhibit(rejected, [{ theme: 'x' }], 'null'), null);
});

test('all 136 verified previews exist locally and are reachable exactly once across 13 display pages', () => {
  const displayed = exhibitions.flatMap(exhibition => galleryWorks(collection.artworks, exhibition.theme));
  assert.equal(displayed.length, 136);
  assert.equal(new Set(displayed.map(artwork => artwork.id)).size, 136);
  assert.deepEqual(exhibitions.map((exhibition, room) => {
    const works = galleryWorks(collection.artworks, exhibition.theme);
    return { works: works.length, pages: Math.ceil(works.length / pageSize(room)) };
  }), [{ works: 75, pages: 7 }, { works: 30, pages: 3 }, { works: 12, pages: 1 }, { works: 19, pages: 2 }]);
  for (const artwork of displayed) {
    assert.ok(fs.statSync(`${publicRoot}${artwork.image.slice(1)}`).size > 0, artwork.title);
    const position = findExhibit(collection.artworks, exhibitions, artwork.id);
    assert.ok(position, artwork.title);
    const works = galleryWorks(collection.artworks, exhibitions[position.room].theme);
    const size = pageSize(position.room);
    assert.ok(position.page >= 0 && position.page < Math.ceil(works.length / size));
    assert.equal(works[position.index].id, artwork.id);
    assert.ok(works.slice(position.page * size, (position.page + 1) * size).some(item => item.id === artwork.id));
  }
  for (const artwork of collection.artworks.filter(artwork => !hasDisplayablePreview(artwork))) {
    assert.equal(findExhibit(collection.artworks, exhibitions, artwork.id), null, artwork.title);
  }
});

test('page boundaries use 12 frames in the first three rooms and 10 in the last', () => {
  assert.deepEqual([0, 1, 2, 3].map(pageSize), [12, 12, 12, 10]);
  const rooms = ['a', 'b', 'c', 'd'].map(theme => ({ theme }));
  for (let room = 0; room < rooms.length; room++) {
    const size = pageSize(room);
    const works = Array.from({ length: size + 1 }, (_, index) => sample(String(index), { theme: rooms[room].theme, featured: true, curatorialOrder: index }));
    assert.deepEqual(findExhibit(works, rooms, String(size - 1)), { room, page: 0, index: size - 1 });
    assert.deepEqual(findExhibit(works, rooms, String(size)), { room, page: 1, index: size });
  }
  assert.equal(findExhibit([], rooms, 'unknown'), null);
});

test('shared documents follow explicit curatorial order, across primary themes', () => {
  assert.deepEqual(exhibitionDocuments([{ id: 'shared', theme: 'elsewhere' }, { id: 'first', theme: 'x' }], { documentIds: ['first', 'shared', 'missing'] }).map(document => document.id), ['first', 'shared']);
});
