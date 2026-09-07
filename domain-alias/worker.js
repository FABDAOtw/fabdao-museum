// The custom domain is in a separate Cloudflare account. Keep both hostnames
// on the same public release, streaming assets from the existing museum origin.
export default {
  async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const incoming = new URL(request.url);
    const upstream = new URL('https://fabdao-museum.mashbean.net');
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;
    const headers = new Headers();
    for (const key of ['Accept', 'Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    try {
      const response = await fetch(upstream, { method: request.method, headers, redirect: 'manual' });
      const output = new Response(response.body, response);
      output.headers.delete('Set-Cookie');
      const location = output.headers.get('Location');
      if (location) {
        const target = new URL(location, upstream);
        if (target.origin === upstream.origin) {
          target.host = incoming.host;
          target.protocol = incoming.protocol;
          output.headers.set('Location', target.href);
        }
      }
      return output;
    } catch {
      return new Response('The museum is temporarily unavailable. Please try again shortly.', {
        status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  },
};
