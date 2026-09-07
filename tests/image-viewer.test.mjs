import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/image-viewer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { mountImageViewer } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = undefined;
    this.className = '';
    this.classList = {
      add: (...names) => { this.className = [...new Set(`${this.className} ${names.join(' ')}`.trim().split(/\s+/).filter(Boolean))].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => name && !names.includes(name)).join(' '); },
    };
    this.listeners = {};
    this.style = {};
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = undefined; }
  setAttribute(key, value) { this[key] = String(value); }
  addEventListener(key, listener) { (this.listeners[key] ||= []).push(listener); }
  removeEventListener() {}
  setPointerCapture() {}
  requestFullscreen() { return Promise.resolve(); }
}

class FakeImage extends Element {
  constructor() { super('img'); this.naturalWidth = 1200; this.naturalHeight = 800; }
  set src(value) { this._src = value; }
  get src() { return this._src; }
}

function installDOM() {
  globalThis.document = {
    fullscreenElement: null,
    fullscreenEnabled: false,
    createElement: tag => new Element(tag),
    exitFullscreen: () => Promise.resolve(),
  };
  globalThis.Image = FakeImage;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
}

test('image viewer keeps its flex root separate from the artwork surface', () => {
  installDOM();
  const container = new Element('div');
  container.className = 'artwork-view';
  const existing = new Element('p');
  container.append(existing);

  const handle = mountImageViewer(container, '/artworks/example.jpg', 'Example work');
  assert.equal(container.className, 'artwork-view');
  assert.equal(container.children.length, 2);
  const viewer = container.children[1];
  assert.equal(viewer.className, 'image-viewer');
  assert.equal(viewer.children[0].className, 'image-stage');
  assert.equal(viewer.children[1].className, 'image-tools');

  handle.dispose();
  assert.deepEqual(container.children, [existing]);
});
