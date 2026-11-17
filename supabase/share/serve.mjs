import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.SHARE_LANDING_PORT ?? 8765);
const dir = path.dirname(fileURLToPath(import.meta.url));
const template = fs.readFileSync(path.join(dir, 'open.html'), 'utf8');
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function landingHtml(productId) {
  const intent = `intent://product/${productId}#Intent;scheme=farm2flavour;end`;
  return template.replaceAll('href="#"', `href="${intent}"`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const fromPath = url.pathname.match(UUID_RE)?.[0];
  const fromQuery = url.searchParams.get('id');
  const productId = fromPath ?? (fromQuery && UUID_RE.test(fromQuery) ? fromQuery : null);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (!productId) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(landingHtml(productId));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`share-landing http://127.0.0.1:${PORT}/p/<product-id>`);
});
