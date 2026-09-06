import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = await readFile(new URL('../src/media.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { getMediaKind, getMediaSupport, mountMedia } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const { artworks } = JSON.parse(await readFile(new URL('../public/data/collection.json', import.meta.url), 'utf8'));
const rain = artworks.find(a => a.title === 'Rain Blooms #81');
const directrix = artworks.find(a => a.title === 'Directrix #86');
const sofa = artworks.find(a => a.title === '你的第一個綠沙發｜Your First Green Sofa');

// A small DOM test double exercises our activation and cleanup logic without
// executing external artwork or treating a mock as a browser playback test.
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.listeners = {}; this.style = {}; this.hidden = false; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parent = undefined; this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'src') delete this.src; }
  addEventListener(key, listener) { (this.listeners[key] ||= []).push(listener); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = undefined; }
  click() { for (const listener of this.listeners.click || []) listener(); }
  focus() { this.focused = true; }
}
function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) { const match = find(child, predicate); if (match) return match; }
}
function fakeDOM() {
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.window = { setTimeout, clearTimeout };
  return new Element('div');
}

test('native media requires the exact reviewed artwork source, including Directrix seed', () => {
  assert.equal(getMediaKind(rain), 'interactive');
  assert.equal(getMediaKind(directrix), 'interactive');
  assert.equal(getMediaKind(sofa), 'model');
  for (const artwork of [rain, directrix, sofa]) {
    assert.equal(getMediaSupport(artwork).supported, true);
    assert.equal(getMediaSupport(artwork).sourceUrl, artwork.artifactUrl);
    assert.equal(getMediaSupport({ ...artwork, artifactUrl: 'javascript:alert(1)' }).supported, false);
    assert.equal(getMediaSupport({ ...artwork, artifactUrl: 'https://example.com/work' }).supported, false);
  }
  const changedSeed = new URL(directrix.artifactUrl);
  changedSeed.searchParams.set('seed', '0');
  assert.equal(getMediaSupport({ ...directrix, artifactUrl: changedSeed.href }).supported, false);
  assert.equal(getMediaSupport({ ...rain, id: 'unreviewed' }).supported, false);
});

test('interactive originals create no iframe until user activation and use an opaque sandbox', () => {
  const container = fakeDOM();
  const handle = mountMedia(container, rain);
  assert.equal(handle.getState(), 'idle');
  assert.equal(find(container, element => element.tagName === 'IFRAME'), undefined);
  const start = find(container, element => element.className === 'primary native-media-start');
  start.click();
  const frame = find(container, element => element.tagName === 'IFRAME');
  assert.equal(frame.src, rain.artifactUrl);
  assert.equal(frame.attributes.sandbox, 'allow-scripts');
  assert.equal(frame.referrerPolicy, 'no-referrer');
  assert.equal(frame.attributes.allow, 'autoplay; fullscreen');
  assert.equal(handle.getState(), 'loading');
  frame.onload();
  assert.equal(handle.getState(), 'open');
  handle.dispose();
  assert.equal(container.children.length, 0);
  assert.equal(frame.parent, undefined);
  assert.equal(frame.src, undefined);
  assert.equal(frame.onload, null);
  assert.equal(handle.getState(), 'disposed');
});

test('closing a pending original cancels it and stale load callbacks cannot reopen it', () => {
  const container = fakeDOM();
  const states = [];
  const handle = mountMedia(container, directrix, { onStatus: state => states.push(state) });
  const start = find(container, element => element.className === 'primary native-media-start');
  start.click();
  const oldFrame = find(container, element => element.tagName === 'IFRAME');
  const delayedLoad = oldFrame.onload;
  handle.stop();
  delayedLoad();
  assert.equal(handle.getState(), 'idle');
  assert.deepEqual(states, ['idle', 'loading', 'idle']);
  assert.equal(oldFrame.parent, undefined);
  assert.equal(find(container, element => element.tagName === 'IFRAME'), undefined);
  start.click();
  const newFrame = find(container, element => element.tagName === 'IFRAME');
  assert.notEqual(newFrame, oldFrame);
  assert.equal(newFrame.src, directrix.artifactUrl);
  handle.dispose();
  start.click();
  assert.equal(handle.getState(), 'disposed');
  handle.dispose();
});

test('unreviewed HTML cannot be launched through the media controls', () => {
  const container = fakeDOM();
  const handle = mountMedia(container, { ...rain, artifactUrl: 'https://unknown.example/original.html' });
  const start = find(container, element => element.className === 'primary native-media-start');
  assert.equal(start.hidden, true);
  start.click();
  assert.equal(find(container, element => element.tagName === 'IFRAME'), undefined);
  handle.dispose();
});

test('the cached original GLB is complete, self-contained, and matches its source checksum', async () => {
  const bytes = await readFile(new URL('../public/media/green-sofa.glb', import.meta.url));
  const map = JSON.parse(await readFile(new URL('../public/media/source-media-map.json', import.meta.url), 'utf8'));
  const evidence = map.records.find(item => item.artworkId === sofa.id);
  assert.ok(bytes.length < 25000000);
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.sha256);
  assert.equal(evidence.sourceUrl, sofa.artifactUrl);
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.ok(model.meshes.length > 0);
  assert.ok(model.images.length > 0, 'preserve the original embedded texture');
  assert.equal([...(model.images || []), ...(model.buffers || [])].some(item => item.uri), false);
  assert.equal(model.extensionsRequired?.length || 0, 0);
});
