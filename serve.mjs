// Локальний статичний сервер без залежностей.
// npm start                 → http://localhost:5173/
// npm run start:pages       → http://localhost:5173/avtonomno/ (як на GitHub Pages)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : '/';
const base = ('/' + baseArg.replace(/^\/+|\/+$/g, '') + '/').replace('//', '/');
const port = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8',
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://x');
    if (!url.pathname.startsWith(base)) {
      res.writeHead(302, { Location: base });
      return res.end();
    }
    let rel = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = resolve(root, rel);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Не знайдено');
  }
}).listen(port, () => console.log(`Автономно: http://localhost:${port}${base}`));
