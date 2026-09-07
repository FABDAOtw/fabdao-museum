import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../domain-alias/worker.js';

test('domain alias preserves public asset paths and ranges without forwarding credentials', async () => {
  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url, options) => {
    requested = { url: String(url), options };
    return new Response('asset', { status: 206, headers: { 'Content-Range': 'bytes 0-4/10', 'Set-Cookie': 'unexpected=1' } });
  };
  try {
    const response = await worker.fetch(new Request('https://museum.fabdao.world/media/green-sofa.glb?lang=en&url=https://elsewhere.example', { headers: { Range: 'bytes=0-4', Cookie: 'private=1', Authorization: 'private' } }));
    assert.equal(new URL(requested.url).origin, 'https://fabdao-museum.mashbean.net');
    assert.equal(new URL(requested.url).pathname, '/media/green-sofa.glb');
    assert.equal(new URL(requested.url).searchParams.get('lang'), 'en');
    assert.equal(requested.options.headers.get('Range'), 'bytes=0-4');
    assert.equal(requested.options.headers.get('Cookie'), null);
    assert.equal(requested.options.headers.get('Authorization'), null);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), 'bytes 0-4/10');
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(await response.text(), 'asset');
  } finally { globalThis.fetch = original; }
});

test('alias keeps same-origin redirects on the new hostname and rejects writes', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 301, headers: { Location: 'https://fabdao-museum.mashbean.net/?lang=en' } });
  try {
    const response = await worker.fetch(new Request('https://museum.fabdao.world/index.html', { method: 'HEAD' }));
    assert.equal(response.headers.get('Location'), 'https://museum.fabdao.world/?lang=en');
    assert.equal((await worker.fetch(new Request('https://museum.fabdao.world/', { method: 'POST' }))).status, 405);
    globalThis.fetch = async () => { throw new Error('upstream unavailable'); };
    const error = await worker.fetch(new Request('https://museum.fabdao.world/'));
    assert.equal(error.status, 502);
    assert.equal(error.headers.get('Cache-Control'), 'no-store');
  } finally { globalThis.fetch = original; }
});
