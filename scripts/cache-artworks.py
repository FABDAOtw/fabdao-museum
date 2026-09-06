#!/usr/bin/env python3
"""Cache genuine token previews for featured exhibits, or the complete catalogue with --all.
No generated or replacement art. Run after ingestion:
python3 scripts/cache-artworks.py --all && node scripts/ingest-collection.mjs --offline
Requires curl and macOS sips. Originals are fetched temporarily, capped at 16 MiB, and removed.
Resizes without cropping, to <= 1200px. Full interactive/video/PDF/GLB artifacts stay at their source.
"""
import concurrent.futures
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
OUT = ROOT / 'public' / 'artworks'
OUT.mkdir(parents=True, exist_ok=True)
collection = json.loads((DATA / 'collection.json').read_text())
manifest_path = DATA / 'media-manifest.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--all', action='store_true', help='Cache every available collection preview, not only the featured exhibits.')
parser.add_argument('--timeout', type=int, default=10, help='Maximum seconds per URL (default: 10).')
parser.add_argument('--attempts', type=int, default=3, help='Maximum distinct preview URLs tried per artwork (default: 3).')
parser.add_argument('--gateway', help='Prioritize another HTTPS IPFS gateway for a bounded recovery pass.')
args = parser.parse_args()
if args.gateway and not args.gateway.startswith('https://'):
    parser.error('--gateway must be an HTTPS URL')

def candidates(art):
    url = art.get('originalImage')
    urls = list(art.get('previewSources', []))
    if url:
        parsed = urllib.parse.urlparse(url)
        if '/ipfs/' in parsed.path:
            part = parsed.path.split('/ipfs/', 1)[1]
            if parsed.query:
                part += '?' + parsed.query
            if args.gateway:
                urls.append(f'{args.gateway.rstrip("/")}/ipfs/{part}')
            urls += [f'https://ipfs.io/ipfs/{part}', f'https://dweb.link/ipfs/{part}', f'https://ipfs.verse.works/ipfs/{part}']
        else:
            urls.append(url)
    if art.get('thumbnail') and 'QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc' not in art['thumbnail']:
        # A lightweight, genuine metadata thumbnail is a better fallback than repeatedly
        # downloading a large animated display image through different gateways.
        urls.insert(min(len(art.get('previewSources', [])) + 1, len(urls)), art['thumbnail'])
    return list(dict.fromkeys(urls))

def download(art):
    old = manifest.get(art['id'])
    if old and old.get('path') and (ROOT / 'public' / old['path'].lstrip('/')).exists():
        return art['id'], old
    stem = hashlib.sha256(art['id'].encode()).hexdigest()[:18]
    target = OUT / (stem + '.jpg')
    failures = []
    with tempfile.TemporaryDirectory(prefix='fabdao-preview-') as tmp:
        source = Path(tmp) / 'original'
        for url in candidates(art)[:args.attempts]:
            command = ['curl', '-sS', '-L', '--fail', '--connect-timeout', str(min(5, args.timeout)), '--max-time', str(args.timeout), '--max-filesize', '16777216', '--proto', '=https', '--proto-redir', '=https', url, '-o', str(source)]
            fetched = subprocess.run(command, capture_output=True)
            if fetched.returncode:
                failures.append({'url': url, 'error': fetched.stderr.decode(errors='replace').strip()[-220:]})
                continue
            # sips is an image decoder: a successful HTTP response that contains HTML/video is rejected.
            inspect = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(source)], capture_output=True, text=True)
            dimensions = re.findall(r'pixel(?:Width|Height): (\d+)', inspect.stdout)
            if inspect.returncode or len(dimensions) != 2:
                failures.append({'url': url, 'error': 'Response is not a decodable image preview'})
                continue
            resized = subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '87', '-Z', '1200', str(source), '--out', str(target)], capture_output=True, text=True)
            if resized.returncode or not target.exists():
                failures.append({'url': url, 'error': 'Image conversion failed'})
                continue
            inspect = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(target)], capture_output=True, text=True)
            width, height = map(int, re.findall(r'pixel(?:Width|Height): (\d+)', inspect.stdout))
            return art['id'], {'path': '/artworks/' + target.name, 'title': art['title'], 'source': url, 'originalUri': art.get('imageUri'), 'width': width, 'height': height, 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'transform': 'Resize only; original aspect ratio; JPEG preview; no crop or generated pixels.'}
    return art['id'], {'title': art['title'], 'status': 'unavailable', 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'attempts': failures, 'reason': 'No decodable HTTPS preview was available within the bounded retry policy.'}

selected = [a for a in collection['artworks'] if (args.all or a.get('featured')) and a.get('metadataStatus') == 'available']
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(download, art) for art in selected]
    for future in concurrent.futures.as_completed(futures):
        id_, result = future.result()
        manifest[id_] = result
        temporary = manifest_path.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(manifest_path)
        print(('OK ' if result.get('path') else 'FAIL ') + result['title'], flush=True)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'selected': len(selected), 'cached': sum(bool(manifest.get(a['id'], {}).get('path')) for a in selected)}, ensure_ascii=False))
