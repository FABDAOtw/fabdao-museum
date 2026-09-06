import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only remote source inspection. Only the original self-contained GLB is
// copied into the museum; remote executable artwork HTML is never published here.
const root = fileURLToPath(new URL('../', import.meta.url));
const collection = JSON.parse(await readFile(path.join(root, 'public/data/collection.json'), 'utf8'));
const selections = [
  ['ethereum_0x70270e65bc37832ef845fa330c2b71501970dab9_81', 'interactive', null],
  ['tezos_KT19FqQ3V6gtkxNnFBhgXRqmMZ2zhiQz7zWa_86', 'interactive', null],
  ['tezos_KT1AFq5XorPduoYyWxs5gEyrFK6fVjJVbtCj_25336', 'model', 'green-sofa.glb'],
];
const temp = await mkdtemp(path.join(tmpdir(), 'fab-original-media-'));
const mediaRoot = path.join(root, 'public/media');
await mkdir(mediaRoot, { recursive: true });
const records = [];
try {
  for (const [id, kind, localName] of selections) {
    const artwork = collection.artworks.find(item => item.id === id);
    if (!artwork) throw new Error(`Missing catalogue artwork: ${id}`);
    const source = new URL(artwork.artifactUrl);
    if (source.protocol !== 'https:' || !['ipfs.io', 'generator.artblocks.io'].includes(source.hostname)) throw new Error('Unreviewed original-source host');
    const bodyPath = path.join(temp, `${records.length}.body`);
    const headerPath = path.join(temp, `${records.length}.headers`);
    const output = execFileSync('curl', [
      '--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https',
      '--retry', '2', '--retry-delay', '2', '--retry-max-time', '15',
      '--max-time', '60', '--max-filesize', '25000000', '--dump-header', headerPath,
      '--output', bodyPath, '--write-out', '%{http_code}\n%{url_effective}', source.href,
    ], { encoding: 'utf8' });
    const [httpStatus, resolvedUrl] = output.trim().split('\n');
    const bytes = await readFile(bodyPath);
    if (bytes.length > 25000000) throw new Error('Original exceeds the media size limit');
    const rawHeaders = await readFile(headerPath, 'utf8');
    const finalHeaderBlock = rawHeaders.trim().split(/\r?\n\r?\n/).at(-1);
    const headers = {};
    for (const line of finalHeaderBlock.split(/\r?\n/).slice(1)) {
      const split = line.indexOf(':');
      if (split > 0) headers[line.slice(0, split).toLowerCase()] = line.slice(split + 1).trim();
    }
    if (kind === 'model') {
      if (bytes.subarray(0, 4).toString() !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid or truncated GLB');
      const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      if ([...(json.buffers || []), ...(json.images || [])].some(item => item.uri)) throw new Error('GLB unexpectedly references external files');
      await writeFile(path.join(mediaRoot, localName), bytes);
    }
    records.push({
      artworkId: id, title: artwork.title, kind, sourceUrl: source.href, resolvedUrl,
      originalSourcePage: artwork.sourceUrl, localPath: localName ? `/media/${localName}` : null,
      httpStatus: Number(httpStatus), contentType: headers['content-type'], bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      embeddingHeaders: { xFrameOptions: headers['x-frame-options'] || null, contentSecurityPolicy: headers['content-security-policy'] || null },
      verificationScope: kind === 'model' ? 'HTTP content, GLB structure, self-contained resources and exact-file checksum; browser rendering verified separately.' : 'HTTP content and embedding response headers only; successful playback must be verified in a browser.',
      scriptHandling: kind === 'interactive' ? 'Remote iframe; sandbox allow-scripts, without allow-same-origin; user activation required.' : 'Original binary model, not executable HTML.',
    });
    console.log(`${artwork.title}: ${httpStatus}, ${bytes.length} bytes${localName ? `, cached ${localName}` : ', remote embed retained'}`);
  }
  await writeFile(path.join(mediaRoot, 'source-media-map.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), records }, null, 2) + '\n');
} finally {
  await rm(temp, { recursive: true, force: true });
}
